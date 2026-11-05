#!/usr/bin/env python3
"""Configure encrypted integrations on an existing Ubuntu installation; never prints secrets."""
import base64
import datetime
import os
import pathlib
import re
import secrets
import shutil
import subprocess
import tempfile

KEYS = ('INTEGRATION_SECRET_KEY', 'DEV_GIT_ROOT', 'DEV_DB_HOSTS', 'TRIAL_ACCOUNTS_ENABLED')


def values(text):
    result = {}
    for line in text.splitlines():
        match = re.match(r'^\s*([A-Z_][A-Z_0-9]*)\s*=(.*)$', line)
        if match and match[1] in KEYS:
            if match[1] in result:
                raise ValueError('Duplicate integration setting; review backend.env privately.')
            value = match[2].strip()
            if value[:1] in ('"', "'") and value[-1:] == value[:1]:
                value = value[1:-1]
            result[match[1]] = value
    return result


def configure(text):
    current = values(text)
    additions = {}
    if current.get('INTEGRATION_SECRET_KEY'):
        try:
            if len(base64.b64decode(current['INTEGRATION_SECRET_KEY'], validate=True)) != 32:
                raise ValueError()
        except ValueError:
            raise ValueError('Existing INTEGRATION_SECRET_KEY is invalid; no changes made.') from None
    else:
        additions['INTEGRATION_SECRET_KEY'] = base64.b64encode(secrets.token_bytes(32)).decode('ascii')
    defaults = {'DEV_GIT_ROOT': '/var/lib/forgeflow/git', 'DEV_DB_HOSTS': '127.0.0.1,localhost,::1', 'TRIAL_ACCOUNTS_ENABLED': 'true'}
    for key, value in defaults.items():
        if not current.get(key):
            additions[key] = value
    lines = [line for line in text.splitlines() if not any(re.match(r'^\s*' + key + r'\s*=', line) for key in additions)]
    if additions:
        lines.extend(key + '=' + value for key, value in additions.items())
        return '\n'.join(lines) + '\n'
    return text


def main():
    import pwd
    if os.geteuid() != 0:
        raise ValueError('Run with sudo: sudo python3 configure-linux-developer.py')
    environment = pathlib.Path('/etc/forgeflow/backend.env')
    if environment.is_symlink() or not environment.is_file() or environment.stat().st_uid != 0:
        raise ValueError('Expected an existing root-owned, regular /etc/forgeflow/backend.env.')
    account = pwd.getpwnam('forgeflow')
    before = environment.read_text(encoding='utf-8')
    after = configure(before)
    settings = values(after)
    root = pathlib.Path(settings['DEV_GIT_ROOT'])
    # Do not chmod an arbitrary pre-existing directory or follow symlinks.
    if not root.is_absolute() or root != root.resolve() or not str(root).startswith('/var/lib/forgeflow/') or root == pathlib.Path('/var/lib/forgeflow'):
        raise ValueError('DEV_GIT_ROOT must be a real absolute directory below /var/lib/forgeflow/. Adjust it privately first.')
    if root.exists() and (not root.is_dir() or root.stat().st_uid != account.pw_uid):
        raise ValueError('Existing Git directory must belong to forgeflow; no changes made.')
    if not shutil.which('git'):
        subprocess.run(['apt-get', 'update'], check=True)
        subprocess.run(['apt-get', 'install', '-y', 'git'], check=True)
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chown(root, account.pw_uid, account.pw_gid)
    root.chmod(0o700)
    backup = None
    if after != before:
        backup = environment.parent / ('backend.env.before-developer-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S') + '-' + secrets.token_hex(3))
        descriptor = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
            stream.write(before)
        descriptor, name = tempfile.mkstemp(prefix='.backend-developer-', dir=environment.parent)
        try:
            with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
                stream.write(after)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(name, environment)
        finally:
            if os.path.exists(name):
                os.unlink(name)
    environment.chmod(0o600)
    print('Developer integrations configured. Existing key and AI settings preserved. No credentials displayed.')
    print('Git directory: ' + str(root))
    if backup:
        print('Private environment backup: ' + str(backup))
    print('Deploy the application update next; this script does not restart ForgeFlow or contact GitHub/OpenAI.')
    print('Back up INTEGRATION_SECRET_KEY privately with the database. Do not rotate or delete it.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, OSError, subprocess.SubprocessError) as failure:
        # Error text is controlled above or consists of filesystem/command metadata, never file contents.
        raise SystemExit('Developer configuration failed: ' + str(failure)) from None
