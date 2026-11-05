#!/usr/bin/env python3
"""Provision only the two separate showcase databases; never prints secrets."""
import base64
import json
import os
import pathlib
import re
import secrets
import subprocess
import tempfile
from ai_config import environments, read_configuration

ROOT = pathlib.Path('/etc/forgeflow/showcase')
PROJECTS = {'knowledge': ('ai_knowledge_hub', 'ai_knowledge_hub_app'), 'flowpilot': ('flowpilot', 'flowpilot')}


def private_write(path, content, owner=0):
    if path.is_symlink():
        raise ValueError('Refusing a symlink at a managed configuration path.')
    descriptor, temporary = tempfile.mkstemp(prefix='.showcase-', dir=path.parent)
    try:
        os.fchmod(descriptor, 0o600)
        os.fchown(descriptor, owner, owner)
        with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def pg(database, sql):
    # SQL arrives on stdin, not argv. Suppress ordinary statement/duration logs for secret DDL.
    command = ['runuser', '-u', 'postgres', '--', 'env',
               'PGOPTIONS=-c log_statement=none -c log_min_duration_statement=-1 -c log_duration=off -c log_min_duration_sample=-1',
               'psql', '-X', '-w', '-At', '-v', 'ON_ERROR_STOP=1', '--dbname=' + database]
    result = subprocess.run(command, input=sql, text=True, capture_output=True, timeout=40)
    if result.returncode:
        raise ValueError('PostgreSQL operation failed; no SQL, credentials or connection details printed.')
    return result.stdout.strip()


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def role_state(role):
    return pg('postgres', 'SELECT rolcanlogin::int || \':\' || rolsuper::int || \':\' || rolcreatedb::int || \':\' || rolcreaterole::int '
              'FROM pg_roles WHERE rolname=' + literal(role) + ';')


def database_owner(database):
    return pg('postgres', 'SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=' + literal(database) + ';')


def new_settings():
    return {
        'version': 1,
        'knowledge_password': secrets.token_urlsafe(48),
        'flowpilot_password': secrets.token_urlsafe(48),
        'security_key': secrets.token_urlsafe(48),
        'redis_password': secrets.token_urlsafe(48),
        'credential_key': base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('ascii'),
    }


def validate_settings(settings):
    if settings.get('version') != 1:
        raise ValueError('Unknown managed settings version; no changes made.')
    for key in ('knowledge_password', 'flowpilot_password', 'security_key', 'redis_password'):
        if not isinstance(settings.get(key), str) or not re.fullmatch(r'[A-Za-z0-9_-]{48,128}', settings[key]):
            raise ValueError('Invalid managed secret; review settings privately.')
    if len(base64.b64decode(settings['credential_key'], altchars=b'-_', validate=True)) != 32:
        raise ValueError('Invalid credential key; review settings privately.')


def environment_files(settings, ai=None):
    hub_ai, flow_ai = environments({'mode': 'disabled'} if ai is None else ai)
    return {
        'knowledge.env': '\n'.join([
            'APP_MODE=authenticated', 'APP_ENV=production', 'ALLOW_REGISTRATION=false',
            'AUTH_COOKIE_SECURE=true', *hub_ai,
            'ALLOWED_HOSTS=["forge-flow.de"]', 'CORS_ORIGINS=["https://forge-flow.de"]',
            'MAX_PDF_PAGES=100', 'MAX_EXTRACTED_CHARS=500000',
            'SECURITY_KEY=' + settings['security_key'],
            'SUITE_AUTH_URL=http://127.0.0.1:3001/api/v1/auth/showcase-session',
            'SUITE_ORIGIN=https://forge-flow.de',
            'DATABASE_URL=postgresql+psycopg://ai_knowledge_hub_app:' + settings['knowledge_password']
            + '@127.0.0.1:5432/ai_knowledge_hub', '',
        ]),
        'flowpilot.env': '\n'.join([
            'FLOWPILOT_MODE=infrastructure', *flow_ai, 'FLOWPILOT_HTTP_MODE=mock',
            'FLOWPILOT_CORS_ORIGINS=["https://forge-flow.de"]', 'FLOWPILOT_QUEUE_NAMESPACE=forgeflow-showcase',
            'FLOWPILOT_SUITE_AUTH_URL=http://127.0.0.1:3001/api/v1/auth/showcase-session',
            'FLOWPILOT_SUITE_ORIGIN=https://forge-flow.de',
            'FLOWPILOT_CREDENTIAL_KEY=' + settings['credential_key'],
            'FLOWPILOT_DATABASE_URL=postgresql://flowpilot:' + settings['flowpilot_password']
            + '@127.0.0.1:5432/flowpilot',
            'FLOWPILOT_REDIS_URL=redis://:' + settings['redis_password'] + '@127.0.0.1:6381/0', '',
        ]),
        'redis.conf': '\n'.join([
            'bind 127.0.0.1', 'port 6381', 'protected-mode yes', 'dir /data',
            'appendonly yes', 'appendfsync everysec', 'save 60 1', 'maxmemory 96mb',
            'maxmemory-policy noeviction', 'logfile ""', 'requirepass ' + settings['redis_password'], '',
        ]),
    }


def check_login(database, role, password):
    environment = dict(os.environ, PGPASSWORD=password, PGCONNECT_TIMEOUT='5')
    result = subprocess.run(['psql', '-X', '-w', '-At', '-h', '127.0.0.1', '-U', role,
                             '-d', database, '-c', 'SELECT current_user=' + literal(role) + ' AND current_database()=' + literal(database) + ';'],
                            env=environment, capture_output=True, text=True, timeout=15)
    if result.returncode or result.stdout.strip() != 't':
        raise ValueError('Application-role connection verification failed for ' + database + '; existing credentials were not reset.')


def main():
    if os.geteuid() != 0:
        raise ValueError('Run provisioning with sudo.')
    if ROOT.is_symlink() or (ROOT.exists() and ROOT.stat().st_uid != 0):
        raise ValueError('Expected a root-owned managed directory.')
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    ROOT.chmod(0o700)
    settings_path = ROOT / 'settings.json'
    if settings_path.is_symlink():
        raise ValueError('Managed settings must not be a symlink.')
    if settings_path.exists():
        if settings_path.stat().st_uid != 0 or settings_path.stat().st_mode & 0o077:
            raise ValueError('Managed settings must be private and root-owned.')
        settings = json.loads(settings_path.read_text(encoding='utf-8'))
    else:
        for database, role in PROJECTS.values():
            if database_owner(database) or role_state(role):
                raise ValueError('An unmanaged database/role already exists; reconcile its configuration without resetting credentials.')
        if any((ROOT / name).exists() for name in ('knowledge.env', 'flowpilot.env', 'redis.conf')):
            raise ValueError('Existing unmanaged service configuration; no replacement performed.')
        settings = new_settings()
        private_write(settings_path, json.dumps(settings, indent=2) + '\n')
    validate_settings(settings)
    # Validate every existing target before performing DDL or writing service environments.
    for database, role in PROJECTS.values():
        owner = database_owner(database)
        state = role_state(role)
        if owner and owner != role:
            raise ValueError('Unexpected existing database owner for ' + database + '; no ownership changes performed.')
        if state and state != '1:0:0:0':
            raise ValueError('Existing role privileges differ from the managed least-privilege role: ' + role)
    files = environment_files(settings, read_configuration())
    for name in files:
        path = ROOT / name
        if path.is_symlink():
            raise ValueError('Refusing a symlink at a managed configuration path.')
    for key, (database, role) in PROJECTS.items():
        if not role_state(role):
            pg('postgres', 'CREATE ROLE "' + role + '" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '
               + literal(settings[key + '_password']) + ';')
        if not database_owner(database):
            pg('postgres', 'CREATE DATABASE "' + database + '" OWNER "' + role + '" ENCODING \'UTF8\';')
            pg('postgres', 'REVOKE ALL ON DATABASE "' + database + '" FROM PUBLIC;')
        check_login(database, role, settings[key + '_password'])
        print('Verified application database and limited login role: ' + database)
    pg('ai_knowledge_hub', 'CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;')
    for name, content in files.items():
        private_write(ROOT / name, content, 10001 if name == 'redis.conf' else 0)
    data = pathlib.Path('/var/lib/forgeflow-showcase/redis')
    if data.is_symlink() or data.resolve() != data:
        raise ValueError('Unexpected Redis data path; no ownership changes performed.')
    if data.exists() and data.stat().st_uid != 10001:
        raise ValueError('Existing Redis data directory has an unexpected owner.')
    data.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chown(data, 10001, 10001)
    data.chmod(0o700)
    print('pgvector activated in the Hub database. Managed secrets preserved; no values printed.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError, subprocess.SubprocessError):
        # Avoid raw exceptions: subprocess and driver exceptions may contain submitted secrets.
        raise SystemExit('Showcase provisioning did not complete. Existing databases/passwords were not replaced. Review target ownership/configuration privately.') from None
