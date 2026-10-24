#!/usr/bin/env bash
# Backend-only update of the existing ForgeFlow installation. Configuration is preserved.
set -Eeuo pipefail
umask 077
fail() { printf '%s\n' "$*" >&2; exit 1; }
[[ $# == 0 ]] || fail 'Usage: sudo bash update-linux-ai.sh'
(( EUID == 0 )) || fail 'Run this script with sudo.'
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
jar="$source_dir/forgeflow-ai-backend.jar"
installed_jar=/opt/forgeflow/backend.jar
environment=/etc/forgeflow/backend.env
for executable in systemctl curl install cp mktemp flock runuser pg_dump grep; do
    command -v "$executable" >/dev/null || fail "Missing command: $executable"
done
[[ -f "$jar" && -f "$installed_jar" && -f "$environment" ]] || fail 'Update JAR or existing installation missing.'
exec 9>/run/forgeflow-public.lock
flock -n 9 || fail 'Another ForgeFlow deployment is running.'
systemctl is-active --quiet forgeflow || fail 'The existing backend must be running before updating.'
curl --noproxy '*' -fsS --max-time 10 http://127.0.0.1:3001/api/v1/health |
    grep -Eq '"storage"[[:space:]]*:[[:space:]]*"postgresql"' || fail 'The PostgreSQL backend is not ready.'

backup="$(mktemp -d /opt/forgeflow/ai-update.XXXXXX)"
cp -p "$installed_jar" "$backup/backend.jar"
cp -p "$environment" "$backup/backend.env"
runuser -u postgres -- pg_dump --format=custom --dbname=forgeflow > "$backup/database.dump"
[[ -s "$backup/database.dump" ]] || fail 'Empty database backup; no update performed.'
backend_changed=0
ready() {
    local attempt
    for attempt in {1..30}; do
        if curl --noproxy '*' --silent --fail --max-time 3 http://127.0.0.1:3001/api/v1/health > "$backup/health.json" &&
                grep -Eq '"storage"[[:space:]]*:[[:space:]]*"postgresql"' "$backup/health.json"; then return 0; fi
        sleep 1
    done
    return 1
}
rollback() {
    local result="$1"
    trap - ERR INT TERM
    if (( BASH_SUBSHELL > 0 )); then exit "$result"; fi
    set +e
    if (( backend_changed )); then
        local restored=1
        systemctl stop forgeflow || restored=0
        install -o forgeflow -g forgeflow -m 0644 "$backup/backend.jar" "$installed_jar" || restored=0
        systemctl start forgeflow || restored=0
        ready || restored=0
        if (( restored )); then printf '\nUpdate failed. Previous backend restored.\n' >&2
        else printf '\nUpdate failed; backend restoration needs review.\n' >&2; fi
    fi
    printf 'Configuration was not modified. Additive database migrations, if any, are retained.\nBackup: %s\n' "$backup" >&2
    exit "$result"
}
trap 'rollback $?' ERR
trap 'rollback 130' INT
trap 'rollback 143' TERM

printf 'Backup: %s\nUpdating backend; existing browser sessions will end.\n' "$backup"
backend_changed=1
systemctl stop forgeflow
install -o forgeflow -g forgeflow -m 0644 "$jar" "$installed_jar"
systemctl start forgeflow
if ! ready; then rollback 1; fi
trap - ERR INT TERM
printf '\nAI backend update ready. Configuration and frontend were preserved.\nBackup: %s\n' "$backup"
printf 'AI remains disabled unless AI_ENABLED=true is configured. Sign in again after this restart.\n'
