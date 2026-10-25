#!/usr/bin/env bash
# Separate Nextcloud deployment for the existing ForgeFlow Nginx host.
set -Eeuo pipefail

cloud_fail() { printf 'Nextcloud: %s\n' "$*" >&2; exit 1; }
cloud_domain_valid() {
    [[ ${#1} -le 253 && "$1" == *.* && "$1" != *..* && "$1" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] || return 1
    local label
    local -a labels
    IFS=. read -ra labels <<< "$1"
    for label in "${labels[@]}"; do
        [[ ${#label} -le 63 && "$label" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]] || return 1
    done
    [[ ! "$1" =~ ^[0-9.]+$ ]]
}

cloud_compose() {
    cat <<'YAML'
name: forgeflow-nextcloud
services:
  db:
    image: ${POSTGRES_IMAGE:?}
    restart: unless-stopped
    environment:
      POSTGRES_DB: nextcloud
      POSTGRES_USER: nextcloud
      POSTGRES_PASSWORD_FILE: /run/secrets/database_password
    secrets: [database_password]
    volumes: [database:/var/lib/postgresql/data]
    networks: [private]
    healthcheck:
      test: [CMD-SHELL, 'pg_isready -U nextcloud -d nextcloud']
      interval: 10s
      timeout: 5s
      retries: 30
    logging: &logging
      driver: json-file
      options: {max-size: 10m, max-file: '3'}
  redis:
    image: ${REDIS_IMAGE:?}
    restart: unless-stopped
    networks: [private]
    logging: *logging
  app:
    image: ${NEXTCLOUD_IMAGE:?}
    restart: unless-stopped
    ports: ['127.0.0.1:8081:80']
    volumes: [nextcloud:/var/www/html]
    secrets: [database_password, admin_password]
    environment:
      POSTGRES_HOST: db
      POSTGRES_DB: nextcloud
      POSTGRES_USER: nextcloud
      POSTGRES_PASSWORD_FILE: /run/secrets/database_password
      NEXTCLOUD_ADMIN_USER: forgeflow-admin
      NEXTCLOUD_ADMIN_PASSWORD_FILE: /run/secrets/admin_password
      NEXTCLOUD_TRUSTED_DOMAINS: ${CLOUD_DOMAIN:?}
      REDIS_HOST: redis
      APACHE_DISABLE_REWRITE_IP: '1'
      TRUSTED_PROXIES: ${TRUSTED_PROXY:?}
      OVERWRITEHOST: ${CLOUD_DOMAIN:?}
      OVERWRITEPROTOCOL: https
      OVERWRITECLIURL: https://${CLOUD_DOMAIN:?}
      PHP_MEMORY_LIMIT: 512M
      PHP_UPLOAD_LIMIT: 1G
    depends_on:
      db: {condition: service_healthy}
      redis: {condition: service_started}
    networks: [proxy, private]
    logging: *logging
volumes:
  database:
  nextcloud:
networks:
  proxy:
  private: {internal: true}
secrets:
  database_password: {file: ./secrets/database-password}
  admin_password: {file: ./secrets/admin-password}
YAML
}

cloud_nginx() {
    local domain="$1" mode="$2"
    cloud_domain_valid "$domain" || return 1
    [[ "$mode" == http || "$mode" == https ]] || return 1
    cat <<NGINX
# Managed by ForgeFlow Nextcloud installer: $domain
server {
    listen 80;
    server_name $domain;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/forgeflow-nextcloud-acme;
        default_type text/plain;
        add_header X-ForgeFlow-Nextcloud-Probe "1" always;
        try_files \$uri =404;
    }
NGINX
    if [[ "$mode" == http ]]; then printf '    location / { return 404; }\n}\n'; return; fi
    cat <<NGINX
    location / { return 308 https://$domain\$request_uri; }
}
server {
    listen 443 ssl;
    server_name $domain;
    ssl_certificate /etc/letsencrypt/live/forgeflow-nextcloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/forgeflow-nextcloud/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    client_max_body_size 1g;
    client_body_timeout 600s;
    add_header Strict-Transport-Security "max-age=15552000" always;
    location = /.well-known/carddav { return 301 https://$domain/remote.php/dav/; }
    location = /.well-known/caldav { return 301 https://$domain/remote.php/dav/; }
    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $domain;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Host $domain;
        proxy_set_header X-Forwarded-Proto https;
        proxy_connect_timeout 10s;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_request_buffering off;
        proxy_buffering off;
    }
}
NGINX
}

cloud_restore_site() {
    # Restore only files owned by this deployment. Never touch other virtual hosts.
    if [[ -f "$backup/site.conf" ]]; then cp -p "$backup/site.conf" "$site"; else rm -f -- "$site"; fi
    if [[ "$had_link" == 0 && -L "$enabled" && $(readlink "$enabled") == "$site" ]]; then rm -- "$enabled"; fi
    nginx -t && systemctl reload nginx
}

cloud_check_challenge() {
    local domain="$1" expected="$2" target="${3:-}" response_file header_file status=000 marker=no attempt
    response_file=$(mktemp)
    header_file=$(mktemp)
    local -a route=()
    [[ -z "$target" ]] || route=(--resolve "$domain:80:$target")
    for ((attempt=1; attempt<=15; attempt++)); do
        status=$(curl --silent --fail --noproxy '*' --connect-timeout 3 --max-time 5 --max-filesize 8192 \
            --output "$response_file" --dump-header "$header_file" --write-out '%{http_code}' \
            "${route[@]}" "http://$domain/.well-known/acme-challenge/$expected") || true
        marker=no
        if tr -d '\r' < "$header_file" | grep -Fxiq 'X-ForgeFlow-Nextcloud-Probe: 1'; then marker=yes; fi
        if [[ "$status" == 200 && "$marker" == yes && $(cat "$response_file") == "$expected" ]]; then
            rm -f -- "$response_file" "$header_file"
            return 0
        fi
        if (( attempt < 15 )); then sleep 1; fi
    done
    printf 'ACME probe failed via %s: HTTP %s, Nextcloud location marker=%s, after %s attempts.\n' "${target:-public DNS}" "$status" "$marker" "$((attempt - 1))" >&2
    rm -f -- "$response_file" "$header_file"
    return 1
}

cloud_challenge_diagnostics() {
    printf 'Challenge path permissions:\n' >&2
    if command -v namei >/dev/null; then namei -l "$1" >&2 || true; fi
    printf 'Configured Nginx listeners and server names (before rollback):\n' >&2
    nginx -T 2>/dev/null | awk '/^# configuration file / || /^[[:space:]]*(listen|server_name)[[:space:]]/ { print }' >&2 || true
}

cloud_main() {
    local domain="${1:-cloud.forge-flow.de}" expected_ip="${2:-185.56.150.178}" mode="${3:-install}"
    cloud_domain_valid "$domain" || cloud_fail 'Use a lowercase DNS name, without protocol or path.'
    [[ "$mode" == install || "$mode" == --check ]] || cloud_fail 'Usage: script [domain] [public-ipv4] [--check]'
    [[ $EUID -eq 0 ]] || cloud_fail 'Run using sudo bash.'
    local command_name
    for command_name in nginx curl python3 systemctl ss flock; do command -v "$command_name" >/dev/null || cloud_fail "Missing prerequisite: $command_name"; done
    local certbot
    certbot=$(command -v certbot || true)
    [[ -n "$certbot" ]] || certbot=/snap/bin/certbot
    [[ -x "$certbot" ]] || cloud_fail 'The existing Certbot installation was not found.'
    systemctl is-active --quiet snap.certbot.renew.timer || systemctl is-active --quiet certbot.timer || cloud_fail 'No active Certbot renewal timer found. Configure the existing Certbot timer first.'
    local ID VERSION_ID UBUNTU_CODENAME VERSION_CODENAME
    source /etc/os-release
    [[ "$ID" == ubuntu && "$VERSION_ID" =~ ^(22\.04|24\.04|26\.04|26\.10)$ ]] || cloud_fail 'Supported Ubuntu releases: 22.04, 24.04, 26.04, 26.10. No changes made.'
    python3 - "$domain" "$expected_ip" <<'PY'
import ipaddress, shutil, socket, sys
domain, expected = sys.argv[1:]
ipaddress.IPv4Address(expected)
try:
    addresses = {result[4][0] for result in socket.getaddrinfo(domain, 80, socket.AF_INET, socket.SOCK_STREAM)}
except socket.gaierror:
    raise SystemExit(f'DNS lookup failed for {domain}. Create its A record pointing to {expected}, wait for DNS propagation, then retry. If the record already resolves publicly, check this server\'s DNS resolver. No installation changes made.') from None
if addresses != {expected}:
    raise SystemExit(f'DNS A record for {domain} must resolve only to {expected}; found {sorted(addresses)}')
try:
    ipv6 = socket.getaddrinfo(domain, 80, socket.AF_INET6, socket.SOCK_STREAM)
except socket.gaierror:
    ipv6 = []
if ipv6:
    raise SystemExit('Remove the cloud AAAA record first; this installer configures an IPv4-only virtual host.')
memory = int(next(line.split()[1] for line in open('/proc/meminfo') if line.startswith('MemTotal:')))
if memory < 1900000:
    raise SystemExit('At least 2 GiB total RAM is required for this combined host.')
free = shutil.disk_usage('/var/lib').free
if free < 10 * 1024**3:
    raise SystemExit('At least 10 GiB free disk space is required before installing.')
print(f'DNS and resources checked: {memory // 1024} MiB RAM, {free // 1024**3} GiB free.')
PY
    nginx -t
    curl -fsS --max-time 10 http://127.0.0.1:3001/api/v1/health | python3 -c 'import json,sys; assert json.load(sys.stdin)["status"] == "ok"'
    local root=/opt/forgeflow-nextcloud site=/etc/nginx/sites-available/forgeflow-nextcloud enabled=/etc/nginx/sites-enabled/forgeflow-nextcloud
    [[ ! -L "$root" && ! -L "$site" ]] || cloud_fail 'Unexpected installation path symlink.'
    [[ ! -e "$root" || -f "$root/managed" ]] || cloud_fail 'The installation directory already exists without a ForgeFlow marker.'
    [[ ! -f "$root/managed" || $(cat "$root/managed") == "$domain" ]] || cloud_fail 'The existing deployment uses a different domain.'
    [[ ! -f "$root/ready" ]] || cloud_fail 'Nextcloud is already installed. Use the documented backup/update procedure; credentials were not reset.'
    [[ ! -e "$site" ]] || grep -Fxq "# Managed by ForgeFlow Nextcloud installer: $domain" "$site" || cloud_fail 'An unmanaged Nextcloud virtual host already exists.'
    [[ ! -e "$enabled" && ! -L "$enabled" ]] || [[ -L "$enabled" && $(readlink "$enabled") == "$site" ]] || cloud_fail 'An unmanaged enabled site already exists.'
    nginx -T 2>/dev/null | python3 -c '
import re,sys
domain, allowed = sys.argv[1:]; current = ""
for line in sys.stdin:
    match = re.match(r"# configuration file (.*):$", line.strip())
    if match: current = match[1]
    match = re.match(r"\s*server_name\s+([^;]+);", line)
    if match and domain in match[1].split() and current not in (allowed, allowed.replace("sites-available", "sites-enabled")):
        raise SystemExit("Conflicting domain virtual host: " + current)
' "$domain" "$site"
    if ss -H -ltn 'sport = :8081' | grep -q .; then
        [[ -f "$root/managed" ]] && docker ps --filter label=com.docker.compose.project=forgeflow-nextcloud --filter label=com.docker.compose.service=app --format '{{.ID}}' | grep -q . || cloud_fail 'Port 8081 is already in use.'
    fi
    if command -v docker >/dev/null; then
        docker compose version >/dev/null || cloud_fail 'Docker exists but Compose v2 is missing. Install it for your existing Docker distribution first.'
    else
        for command_name in docker.io docker-compose docker-compose-v2 podman-docker containerd runc; do
            if dpkg-query -W -f='${Status}' "$command_name" 2>/dev/null | grep -q 'install ok installed'; then cloud_fail "Conflicting package $command_name. Review the existing container installation first; nothing is removed automatically."; fi
        done
    fi
    if [[ "$mode" == --check ]]; then printf 'Preflight passed. No installation or configuration changes made.\n'; return; fi
    exec 9>/run/lock/forgeflow-nextcloud.lock
    flock -n 9 || cloud_fail 'Another Nextcloud setup is running.'
    [[ ! -f "$root/ready" ]] || cloud_fail 'Nextcloud setup has already completed.'
    umask 077
    install -d -m 0700 "$root" "$root/secrets"
    printf '%s\n' "$domain" > "$root/managed"
    local backup had_link=0 modified=0
    backup=$(mktemp -d "$root/setup-backup.XXXXXX")
    [[ ! -e "$site" ]] || cp -p "$site" "$backup/site.conf"
    [[ ! -L "$enabled" ]] || had_link=1
    # The EXIT trap runs once, including failures in commands/subshells. Data is retained.
    trap 'task_cloud_exit=$?; trap - EXIT; if (( task_cloud_exit != 0 )); then rm -f -- "$root/ready"; if (( modified )); then cloud_restore_site || printf "Cloud virtual-host rollback failed; inspect %s\n" "$backup" >&2; fi; printf "Setup incomplete. Nextcloud data and secrets retained in %s. ForgeFlow was not restarted.\n" "$root" >&2; fi' EXIT
    install -d -m 0755 /var/www/forgeflow-nextcloud-acme /var/www/forgeflow-nextcloud-acme/.well-known /var/www/forgeflow-nextcloud-acme/.well-known/acme-challenge
    modified=1
    cloud_nginx "$domain" http > "$site"
    chmod 0644 "$site"
    [[ -L "$enabled" ]] || ln -s "$site" "$enabled"
    nginx -t && systemctl reload nginx
    local token token_file
    token=$(python3 -c 'import secrets; print(secrets.token_hex(24))')
    token_file="/var/www/forgeflow-nextcloud-acme/.well-known/acme-challenge/$token"
    printf '%s' "$token" > "$token_file"; chmod 0644 "$token_file"
    if ! cloud_check_challenge "$domain" "$token" 127.0.0.1; then
        cloud_challenge_diagnostics "$token_file"
        cloud_fail 'Local ACME self-check failed. Certbot has not been called; see routing/permissions above.'
    fi
    if ! cloud_check_challenge "$domain" "$token"; then
        cloud_challenge_diagnostics "$token_file"
        cloud_fail 'Public ACME self-check failed; check routing, DNS and provider firewall. Certbot has not been called.'
    fi
    rm -- "$token_file"
    "$certbot" certonly --webroot -w /var/www/forgeflow-nextcloud-acme --cert-name forgeflow-nextcloud --keep-until-expiring -d "$domain"
    if ! command -v docker >/dev/null; then
        [[ ! -e /etc/apt/sources.list.d/docker.sources && ! -e /etc/apt/sources.list.d/docker.list ]] || cloud_fail 'Existing Docker repository found; review it before installing.'
        apt-get update
        apt-get install -y ca-certificates curl
        install -d -m 0755 /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/forgeflow-docker.asc
        chmod 0644 /etc/apt/keyrings/forgeflow-docker.asc
        cat > /etc/apt/sources.list.d/docker.sources <<APT
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/forgeflow-docker.asc
APT
        chmod 0644 /etc/apt/sources.list.d/docker.sources
        apt-get update
        apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    fi
    systemctl enable --now docker
    local secret_file
    for secret_file in database-password admin-password; do
        if [[ ! -f "$root/secrets/$secret_file" ]]; then python3 -c 'import secrets; print(secrets.token_hex(32))' > "$root/secrets/$secret_file"; fi
        # Parent directories are root-only. Container UIDs must be able to read the mounted secret file.
        chmod 0644 "$root/secrets/$secret_file"
    done
    cloud_compose > "$root/compose.yaml"
    if [[ ! -f "$root/.env" ]]; then
        printf 'CLOUD_DOMAIN=%s\nTRUSTED_PROXY=127.0.0.1\nNEXTCLOUD_IMAGE=nextcloud:35-apache\nPOSTGRES_IMAGE=postgres:17-alpine\nREDIS_IMAGE=redis:8-alpine\n' "$domain" > "$root/.env"
    fi
    local -a compose=(docker compose --project-name forgeflow-nextcloud --project-directory "$root" --env-file "$root/.env" -f "$root/compose.yaml")
    "${compose[@]}" pull
    # Pin all resolved images by digest. Re-running setup does not silently upgrade existing data.
    local image_key image_ref image_digest
    for image_key in NEXTCLOUD_IMAGE POSTGRES_IMAGE REDIS_IMAGE; do
        image_ref=$(sed -n "s/^$image_key=//p" "$root/.env")
        image_digest=$(docker image inspect "$image_ref" --format '{{index .RepoDigests 0}}')
        [[ "$image_digest" =~ ^[a-z0-9/._-]+@sha256:[a-f0-9]{64}$ ]] || cloud_fail 'Unable to pin a downloaded image digest.'
        sed -i "s|^$image_key=.*|$image_key=$image_digest|" "$root/.env"
    done
    "${compose[@]}" create
    local gateway
    gateway=$(docker network inspect forgeflow-nextcloud_proxy --format '{{(index .IPAM.Config 0).Gateway}}')
    python3 - "$gateway" <<'PY'
import ipaddress, sys
assert ipaddress.ip_address(sys.argv[1]).is_private
PY
    sed -i "s/^TRUSTED_PROXY=.*/TRUSTED_PROXY=$gateway/" "$root/.env"
    "${compose[@]}" up -d
    local attempt ready=0
    for ((attempt=0; attempt<120; attempt++)); do
        if "${compose[@]}" exec -T --user www-data app php occ status --output=json > "$root/status.json" 2>/dev/null && python3 -c 'import json,sys; value=json.load(sys.stdin); assert value.get("installed") and not value.get("maintenance") and not value.get("needsDbUpgrade")' < "$root/status.json" 2>/dev/null; then ready=1; break; fi
        (( attempt % 10 != 0 )) || printf 'Waiting for Nextcloud initialization (%ss)...\n' "$((attempt * 2))"
        sleep 2
    done
    [[ "$ready" == 1 ]] || cloud_fail 'Nextcloud did not initialize. Inspect the private container logs; rerun setup after correcting the cause.'
    "${compose[@]}" exec -T --user www-data app php occ background:cron
    "${compose[@]}" exec -T --user www-data app php occ config:system:set maintenance_window_start --type=integer --value=3
    cloud_nginx "$domain" https > "$site"
    chmod 0644 "$site"
    nginx -t && systemctl reload nginx
    curl -fsS --noproxy '*' --retry 5 --retry-all-errors --retry-delay 1 --max-time 30 --resolve "$domain:443:127.0.0.1" "https://$domain/status.php" | python3 -c 'import json,sys; value=json.load(sys.stdin); assert value.get("installed") and not value.get("maintenance") and not value.get("needsDbUpgrade")'
    curl -fsS --noproxy '*' --retry 5 --retry-all-errors --retry-delay 1 --max-time 30 "https://$domain/status.php" | python3 -c 'import json,sys; value=json.load(sys.stdin); assert value.get("installed") and not value.get("maintenance")'
    curl -fsS --max-time 10 http://127.0.0.1:3001/api/v1/health | python3 -c 'import json,sys; assert json.load(sys.stdin)["status"] == "ok"'
    local hook=/etc/letsencrypt/renewal-hooks/deploy/forgeflow-nextcloud-nginx
    [[ ! -e "$hook" ]] || grep -Fxq '# ForgeFlow Nextcloud certificate hook' "$hook" || cloud_fail 'An unmanaged certificate hook already exists.'
    install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
    cat > "$hook" <<'HOOK'
#!/bin/sh
# ForgeFlow Nextcloud certificate hook
set -eu
if [ "${RENEWED_LINEAGE:-}" = /etc/letsencrypt/live/forgeflow-nextcloud ]; then
    /usr/sbin/nginx -t
    /bin/systemctl reload nginx
fi
HOOK
    chmod 0755 "$hook"
    [[ ! -e /etc/systemd/system/forgeflow-nextcloud-cron.service ]] || grep -Fq 'Description=ForgeFlow Nextcloud background jobs' /etc/systemd/system/forgeflow-nextcloud-cron.service || cloud_fail 'An unmanaged cron service already exists.'
    [[ ! -e /etc/systemd/system/forgeflow-nextcloud-cron.timer ]] || grep -Fq 'Description=ForgeFlow Nextcloud background schedule' /etc/systemd/system/forgeflow-nextcloud-cron.timer || cloud_fail 'An unmanaged cron timer already exists.'
    cat > /etc/systemd/system/forgeflow-nextcloud-cron.service <<'SERVICE'
[Unit]
Description=ForgeFlow Nextcloud background jobs
After=docker.service
Requires=docker.service
ConditionPathExists=/opt/forgeflow-nextcloud/ready
[Service]
Type=oneshot
WorkingDirectory=/opt/forgeflow-nextcloud
ExecStart=/usr/bin/docker compose --project-name forgeflow-nextcloud exec -T --user www-data app php -f /var/www/html/cron.php
TimeoutStartSec=300
SERVICE
    cat > /etc/systemd/system/forgeflow-nextcloud-cron.timer <<'TIMER'
[Unit]
Description=ForgeFlow Nextcloud background schedule
[Timer]
OnBootSec=5min
OnUnitActiveSec=5min
Persistent=true
[Install]
WantedBy=timers.target
TIMER
    chmod 0644 /etc/systemd/system/forgeflow-nextcloud-cron.{service,timer}
    systemctl daemon-reload
    printf '%s\n' "$domain" > "$root/ready"
    systemctl enable --now forgeflow-nextcloud-cron.timer
    modified=0
    trap - EXIT
    printf '\nNextcloud ready: https://%s\nAccount: forgeflow-admin\nInitial password: sudo cat /opt/forgeflow-nextcloud/secrets/admin-password\nSeparate Nextcloud login; change the initial password after signing in.\nNo ForgeFlow credentials were read or copied.\nState: %s; setup backup: %s\n' "$domain" "$root" "$backup"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then cloud_main "$@"; fi
