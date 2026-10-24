#!/usr/bin/env bash
# Update the existing ForgeFlow installation, including settings migration V4.
set -Eeuo pipefail
umask 077
fail() { printf '%s\n' "$*" >&2; exit 1; }

ip="${1:-}"
[[ "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || fail "Usage: sudo bash $0 PUBLIC_IPV4"
IFS=. read -r -a octets <<< "$ip"
for octet in "${octets[@]}"; do
    (( 10#$octet <= 255 )) || fail 'Invalid IPv4 address.'
done
(( EUID == 0 )) || fail 'Run this script with sudo.'
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
jar="$source_dir/forgeflow-settings-backend.jar"
frontend="$source_dir/forgeflow-settings-frontend.tar.gz"
web=/var/www/forgeflow
installed_jar=/opt/forgeflow/backend.jar

for executable in systemctl curl tar install cp runuser pg_dump flock nginx; do
    command -v "$executable" >/dev/null || fail "Missing command: $executable"
done
[[ -f "$jar" && -f "$frontend" && -f "$installed_jar" && -f "$web/index.html" ]] || fail 'Update files or existing installation missing.'
systemctl is-active --quiet forgeflow || fail 'The existing backend must be running before updating.'
nginx -t
curl --noproxy '*' -fsS --max-time 10 http://127.0.0.1:3001/api/v1/health |
    grep -Eq '"storage"[[:space:]]*:[[:space:]]*"postgresql"' || fail 'The PostgreSQL backend is not ready.'

# Use the same lock as initial public setup; do not run deployments concurrently.
exec 9>/run/forgeflow-public.lock
flock -n 9 || fail 'Another ForgeFlow deployment is running.'
backup="$(mktemp -d /opt/forgeflow/settings-update.XXXXXX)"
cp -p "$installed_jar" "$backup/backend.jar"
tar -czf "$backup/frontend.tar.gz" -C "$web" .
# The named database belongs to this installation; use local PostgreSQL peer auth.
# Redirection happens as root, so the database dump stays private in this directory.
runuser -u postgres -- pg_dump --format=custom --dbname=forgeflow > "$backup/database.dump"
[[ -s "$backup/database.dump" ]] || fail 'The database backup is empty; no update performed.'
backend_changed=0
frontend_changed=0

rollback() {
    local result="$1"
    trap - ERR INT TERM
    if (( BASH_SUBSHELL > 0 )); then exit "$result"; fi
    set +e
    local restore_failed=0
    if (( backend_changed )); then
        systemctl stop forgeflow || restore_failed=1
        install -o forgeflow -g forgeflow -m 0644 "$backup/backend.jar" "$installed_jar" || restore_failed=1
        systemctl start forgeflow || restore_failed=1
    fi
    if (( frontend_changed )); then tar --no-same-owner -xzpf "$backup/frontend.tar.gz" -C "$web" || restore_failed=1; fi
    if (( restore_failed )); then
        printf '\nUpdate failed and restoration was incomplete. Review the errors above. Backup: %s\n' "$backup" >&2
    else
        printf '\nUpdate failed. Previous application files restored from %s.\n' "$backup" >&2
    fi
    printf 'Additive database migrations are retained; the database dump is in that backup directory.\n' >&2
    exit "$result"
}
trap 'rollback $?' ERR
trap 'rollback 130' INT
trap 'rollback 143' TERM

backend_changed=1
systemctl stop forgeflow
install -o forgeflow -g forgeflow -m 0644 "$jar" "$installed_jar"
systemctl start forgeflow
curl --noproxy '*' -fsS --retry 20 --retry-connrefused --retry-delay 1 --max-time 10 \
    http://127.0.0.1:3001/api/v1/health |
    grep -Eq '"storage"[[:space:]]*:[[:space:]]*"postgresql"'

frontend_changed=1
umask 022
tar --no-same-owner --no-same-permissions -xzf "$frontend" -C "$web"
umask 077
curl --noproxy '*' -fsS --retry 5 --retry-delay 1 --max-time 10 \
    --connect-to "$ip:443:127.0.0.1:443" "https://$ip/" >/dev/null
curl --noproxy '*' -fsS --retry 5 --retry-delay 1 --max-time 10 \
    --connect-to "$ip:443:127.0.0.1:443" "https://$ip/api/v1/health" |
    grep -Eq '"storage"[[:space:]]*:[[:space:]]*"postgresql"'
trap - ERR INT TERM
printf '\nSettings update ready: https://%s/#/projectManager/settings\nBackup: %s\n' "$ip" "$backup"
printf 'Reload the browser and sign in again.\n'
