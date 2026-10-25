#!/usr/bin/env bash
# Deploy the chat widget and streaming backend to an existing public installation.
set -Eeuo pipefail
umask 077
fail() { printf '%s\n' "$*" >&2; exit 1; }
# BEGIN CHAT_TARGET_CHECK
validate_target() {
    local value="$1" part
    local -a parts
    (( ${#value} > 0 && ${#value} <= 253 )) || return 1
    if [[ "$value" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
        IFS=. read -r -a parts <<< "$value"
        for part in "${parts[@]}"; do (( 10#$part <= 255 )) || return 1; done
        return 0
    fi
    [[ "$value" == *.* && ! "$value" =~ ^[0-9.]+$ && "$value" != *. ]] || return 1
    IFS=. read -r -a parts <<< "$value"
    for part in "${parts[@]}"; do
        (( ${#part} > 0 && ${#part} <= 63 )) || return 1
        [[ "$part" =~ ^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$ ]] || return 1
    done
}
# END CHAT_TARGET_CHECK
[[ $# == 1 ]] || fail 'Usage: sudo bash update-linux-chat.sh PUBLIC_HOST'
host="$1"
validate_target "$host" || fail 'Specify a valid domain or IPv4 address, without scheme, port or path.'
(( EUID == 0 )) || fail 'Run this script with sudo.'
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
jar="$source_dir/forgeflow-chat-backend.jar"
frontend="$source_dir/forgeflow-chat-frontend.tar.gz"
web=/var/www/forgeflow
installed_jar=/opt/forgeflow/backend.jar
environment=/etc/forgeflow/backend.env
for executable in systemctl curl tar install cp mv rm mktemp flock runuser pg_dump grep nginx sha256sum find chmod mkdir cmp sleep; do
    command -v "$executable" >/dev/null || fail "Missing command: $executable"
done
[[ -f "$jar" && -f "$frontend" && -f "$installed_jar" && -f "$environment" && -f "$web/index.html" && ! -L "$web" ]] || fail 'Update files or existing installation missing.'
exec 9>/run/forgeflow-public.lock
flock -n 9 || fail 'Another ForgeFlow deployment is running.'
(cd -- "$source_dir" && sha256sum -c forgeflow-chat.sha256)
systemctl is-active --quiet forgeflow || fail 'The existing backend must be running before updating.'
nginx -t
curl --noproxy '*' -fsS --max-time 10 http://127.0.0.1:3001/api/v1/health |
    grep -Eq '"storage"[[:space:]]*:[[:space:]]*"postgresql"' || fail 'The PostgreSQL backend is not ready.'

# BEGIN CHAT_ARCHIVE_CHECK
validate_frontend() {
# Accept only regular static files/directories and relative paths from the prepared Vite archive.
local members
members="$(tar -tzf "$frontend")" || fail 'Frontend archive cannot be read.'
while IFS= read -r member; do
    [[ "$member" =~ ^\./[A-Za-z0-9_./-]*$ && "$member" != *'/../'* && "$member" != *'/..' ]] || fail 'Invalid frontend archive path.'
done <<< "$members"
tar -tvzf "$frontend" > /dev/null
if tar -tvzf "$frontend" | grep '^[^-d]' > /dev/null; then fail 'Frontend archive contains unsupported file types.'; fi
}
# END CHAT_ARCHIVE_CHECK
validate_frontend

# BEGIN CHAT_PUBLISH
publish_frontend() {
    # Copy every static entry first; retain old assets for already open browser tabs.
    (shopt -s dotglob nullglob
     for entry in "$backup/frontend/"*; do
         [[ "${entry##*/}" == index.html ]] && continue
         cp -a -- "$entry" "$web/" || exit 1
     done) || return 1
    local staged
    staged="$(mktemp "$web/.forgeflow-index.XXXXXX")" || return 1
    # Same-directory rename publishes the complete entry point in one filesystem operation.
    if ! install -m 0644 "$backup/frontend/index.html" "$staged" || ! mv -f -- "$staged" "$web/index.html"; then
        rm -f -- "$staged"
        return 1
    fi
}
# END CHAT_PUBLISH

backup="$(mktemp -d /opt/forgeflow/chat-update.XXXXXX)"
cp -p "$installed_jar" "$backup/backend.jar"
cp -p "$environment" "$backup/backend.env"
tar -czf "$backup/frontend.tar.gz" -C "$web" .
runuser -u postgres -- pg_dump --format=custom --dbname=forgeflow > "$backup/database.dump"
[[ -s "$backup/database.dump" ]] || fail 'Empty database backup; no update performed.'
mkdir "$backup/frontend"
umask 022
tar --no-same-owner --no-same-permissions -xzf "$frontend" -C "$backup/frontend"
umask 077
[[ -f "$backup/frontend/index.html" && -d "$backup/frontend/assets" ]] || fail 'Frontend archive has no production build.'
find "$backup/frontend" -type d -exec chmod 0755 {} +
find "$backup/frontend" -type f -exec chmod 0644 {} +
backend_changed=0
frontend_changed=0
ready() {
    local attempt
    for attempt in {1..40}; do
        if curl --noproxy '*' --silent --fail --max-time 3 http://127.0.0.1:3001/api/v1/health > "$backup/health.json" &&
                grep -Eq '"storage"[[:space:]]*:[[:space:]]*"postgresql"' "$backup/health.json"; then return 0; fi
        sleep 1
    done
    return 1
}
# BEGIN CHAT_ROLLBACK
rollback() {
    local result="$1"
    trap - ERR INT TERM
    if (( BASH_SUBSHELL > 0 )); then exit "$result"; fi
    set +e
    local restored=1
    if (( frontend_changed )); then tar --no-same-owner -xzpf "$backup/frontend.tar.gz" -C "$web" || restored=0; fi
    if (( backend_changed )); then
        systemctl stop forgeflow || restored=0
        install -o forgeflow -g forgeflow -m 0644 "$backup/backend.jar" "$installed_jar" || restored=0
        systemctl start forgeflow || restored=0
        ready || restored=0
    fi
    if (( restored )); then printf '\nUpdate failed. Previous application restored.\n' >&2
    else printf '\nUpdate failed; application restoration needs review.\n' >&2; fi
    printf 'Configuration was not modified. Additive migrations are retained.\nBackup: %s\n' "$backup" >&2
    exit "$result"
}
# END CHAT_ROLLBACK
trap 'rollback $?' ERR
trap 'rollback 130' INT
trap 'rollback 143' TERM
printf 'Backup: %s\nUpdating application; browser sessions will end.\n' "$backup"
backend_changed=1
systemctl stop forgeflow
install -o forgeflow -g forgeflow -m 0644 "$jar" "$installed_jar"
systemctl start forgeflow
if ! ready; then rollback 1; fi
frontend_changed=1
publish_frontend
curl --noproxy '*' -fsS --retry 5 --retry-delay 1 --max-time 10 --connect-to "$host:443:127.0.0.1:443" "https://$host/" > "$backup/public-index.html"
cmp -s "$backup/frontend/index.html" "$backup/public-index.html"
curl --noproxy '*' -fsS --retry 5 --retry-delay 1 --max-time 10 --connect-to "$host:443:127.0.0.1:443" "https://$host/api/v1/health" |
    grep -Eq '"storage"[[:space:]]*:[[:space:]]*"postgresql"'
# Initial requests still require authentication; this does not call the provider.
for route in '' '/00000000-0000-4000-8000-000000000000' '/00000000-0000-4000-8000-000000000000/executions'; do
    status="$(curl --noproxy '*' -sS --max-time 10 --output "$backup/ai-auth.json" --write-out '%{http_code}' \
        --connect-to "$host:443:127.0.0.1:443" "https://$host/api/v1/ai/conversations$route")"
    if [[ "$status" != 401 ]]; then
        printf 'A public AI history route did not enforce authentication.\n' >&2
        rollback 1
    fi
done
trap - ERR INT TERM
printf '\nChat update ready: https://%s\nBackup: %s\n' "$host" "$backup"
printf 'Reload with Ctrl+F5, sign in, then open the assistant at the bottom right. Existing AI settings were preserved.\n'
printf 'No provider request was made by this update script.\n'
