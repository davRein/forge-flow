#!/usr/bin/env python3
"""Interactive operator command for the installed suite; never prints credentials."""
import os
import pathlib
import re
import shutil
import subprocess
import sys
from uuid import uuid4
import zipfile
from datetime import datetime, timezone


def main():
    if os.geteuid() != 0 or not sys.stdin.isatty():
        raise ValueError("Start with sudo in an interactive terminal.")
    jar = pathlib.Path('/opt/forgeflow/backend.jar')
    with zipfile.ZipFile(jar) as archive:
        if 'BOOT-INF/classes/de/forgeflow/admin/SetupAdministrator.class' not in archive.namelist():
            raise ValueError('Deploy the current account-management release first.')
    values = {}
    for line in pathlib.Path('/etc/forgeflow/backend.env').read_text().splitlines():
        key, sep, value = line.partition('=')
        if sep and key.strip() in {'DB_URL', 'DB_USER', 'DB_PASSWORD'}:
            values[key.strip()] = value.strip().strip('"')
    match = re.fullmatch(r'jdbc:postgresql://(localhost|127\.0\.0\.1):([0-9]+)/([a-z][a-z0-9_]{0,62})', values.get('DB_URL', ''))
    if not match or not re.fullmatch(r'[a-z][a-z0-9_]{0,62}', values.get('DB_USER', '')) or not values.get('DB_PASSWORD'):
        raise ValueError('Expected a configured loopback PostgreSQL database.')
    java = shutil.which('java')
    if not java:
        raise ValueError('Java 21 is required.')
    directory = pathlib.Path('/var/backups/forgeflow')
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    backup = directory / ('before-administrator-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid4().hex[:12] + '.dump')
    with backup.open('xb') as output:
        subprocess.run(['runuser', '-u', 'postgres', '--', 'pg_dump', '--format=custom', '--dbname=' + match[3]], stdout=output, stderr=subprocess.DEVNULL, check=True)
    subprocess.run(['pg_restore', '--list', str(backup)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    env = {**os.environ, 'FORGEFLOW_ADMIN_DB_URL': values['DB_URL'], 'FORGEFLOW_ADMIN_DB_USER': values['DB_USER'], 'FORGEFLOW_ADMIN_DB_PASSWORD': values['DB_PASSWORD'], 'FORGEFLOW_ADMIN_STATUS_FILE': '/opt/forgeflow/administrator-setup-status.json'}
    print('Verified database backup created. Enter email and password in this terminal.')
    result = subprocess.run([java, '-Dloader.main=de.forgeflow.admin.SetupAdministrator', '-cp', str(jar), 'org.springframework.boot.loader.launch.PropertiesLauncher'], env=env).returncode
    if result:
        return 20
    import json
    state = json.loads(pathlib.Path(env['FORGEFLOW_ADMIN_STATUS_FILE']).read_text()).get('status')
    print('Administrator status: ' + str(state))
    return 0 if state in {'created', 'existing'} else 20


if __name__ == '__main__':
    os.umask(0o077)
    try:
        sys.exit(main())
    except (OSError, ValueError, subprocess.SubprocessError, zipfile.BadZipFile):
        sys.exit('Administrator setup failed; no existing account credentials were replaced. Check configuration and backup availability.')
