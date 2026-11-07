"""Refuse a backend downgrade that would ignore already assigned app restrictions."""
import json
import subprocess
import sys
import zipfile

ALL = ['projectManager', 'git', 'wiki', 'devTools', 'timeTracker', 'business', 'cloud', 'knowledgeHub', 'flowPilot', 'pulseWatch', 'dataScout', 'requestLab']

def safe(jar, query):
    with zipfile.ZipFile(jar) as archive:
        if 'BOOT-INF/classes/de/forgeflow/auth/AppPermissions.class' in archive.namelist():
            return True
    if query("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='ff_accounts' AND column_name='allowed_apps';") == '0':
        return True
    apps = json.dumps(ALL, separators=(',', ':'))
    count = query("SELECT count(*) FROM ff_accounts WHERE NOT administrator AND NOT portal_only AND allowed_apps IS NOT NULL AND (jsonb_typeof(allowed_apps::jsonb)<>'array' OR jsonb_array_length(allowed_apps::jsonb)<>12 OR NOT allowed_apps::jsonb @> '" + apps + "'::jsonb);")
    return count == '0'

def query(sql):
    return subprocess.run(['runuser', '-u', 'postgres', '--', 'psql', '-X', '-w', '-At', '-v', 'ON_ERROR_STOP=1', '-d', 'forgeflow', '-c', sql], check=True, capture_output=True, text=True).stdout.strip()

if __name__ == '__main__':
    try:
        if len(sys.argv) == 2 and safe(sys.argv[1], query):
            sys.exit(0)
    except (OSError, zipfile.BadZipFile, subprocess.SubprocessError, ValueError):
        pass
    sys.exit('Backend downgrade blocked: current account app restrictions must remain enforced.')
