#!/usr/bin/env bash
# Consistent backup of this deployment only; never reads ForgeFlow credentials.
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { printf 'Run using sudo bash.\n' >&2; exit 1; }
root=/opt/forgeflow-nextcloud
[[ -f "$root/ready" && ! -L "$root" ]] || { printf 'Managed Nextcloud installation not found.\n' >&2; exit 1; }
exec 9>/run/lock/forgeflow-nextcloud.lock
flock -n 9 || { printf 'Another Nextcloud operation is running.\n' >&2; exit 1; }
umask 077
compose=(docker compose --project-name forgeflow-nextcloud --project-directory "$root" --env-file "$root/.env" -f "$root/compose.yaml")
"${compose[@]}" exec -T --user www-data app php occ status --output=json | python3 -c 'import json,sys; value=json.load(sys.stdin); assert value.get("installed") and not value.get("maintenance") and not value.get("needsDbUpgrade"), "Nextcloud must be healthy and outside maintenance before backup"'
install -d -m 0700 /var/backups/forgeflow-nextcloud
backup=$(mktemp -d /var/backups/forgeflow-nextcloud/backup.XXXXXX)
cron_active=0
systemctl is-active --quiet forgeflow-nextcloud-cron.timer && cron_active=1
maintenance=0
stopped=0
restore_service() {
    local result=0
    if (( stopped )); then "${compose[@]}" up -d app || result=1; fi
    if (( maintenance )); then
        local ready=0 attempt
        for ((attempt=0; attempt<30; attempt++)); do
            if "${compose[@]}" exec -T --user www-data app php occ maintenance:mode --off; then ready=1; break; fi
            sleep 2
        done
        (( ready )) || result=1
    fi
    if (( cron_active )); then systemctl start forgeflow-nextcloud-cron.timer || result=1; fi
    return "$result"
}
trap 'task_backup_exit=$?; trap - EXIT; restore_service || { printf "Nextcloud needs manual service recovery.\n" >&2; task_backup_exit=1; }; if (( task_backup_exit )); then printf "Backup incomplete: %s\n" "$backup" >&2; fi; exit "$task_backup_exit"' EXIT
systemctl stop forgeflow-nextcloud-cron.timer
systemctl stop forgeflow-nextcloud-cron.service
maintenance=1
"${compose[@]}" exec -T --user www-data app php occ maintenance:mode --on
stopped=1
"${compose[@]}" stop app
"${compose[@]}" exec -T --user postgres db pg_dump -U nextcloud -d nextcloud -Fc > "$backup/database.dump"
"${compose[@]}" run --rm --no-deps -T --entrypoint tar app -czf - -C /var/www/html . > "$backup/nextcloud.tar.gz"
tar -tzf "$backup/nextcloud.tar.gz" > /dev/null
cp -p "$root/compose.yaml" "$root/.env" "$root/managed" "$backup/"
cp -a "$root/secrets" "$backup/"
cp -p /etc/nginx/sites-available/forgeflow-nextcloud "$backup/nginx.conf"
"${compose[@]}" exec -T --user postgres db pg_restore -l < "$backup/database.dump" > "$backup/database-contents.txt"
(cd "$backup" && sha256sum database.dump nextcloud.tar.gz compose.yaml .env managed nginx.conf secrets/admin-password secrets/database-password > SHA256SUMS)
printf '%s\n' "$(date -u +%FT%TZ)" > "$backup/complete"
restore_service
maintenance=0; stopped=0; cron_active=0
trap - EXIT
printf 'Backup complete: %s\nCopy this root-protected directory to separate storage. It contains private files and secrets.\n' "$backup"
