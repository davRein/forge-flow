#!/usr/bin/env bash
# Ubuntu + the existing ForgeFlow systemd/Nginx installation. Run with sudo.
set -Eeuo pipefail
umask 077

fail() { printf '%s\n' "$*" >&2; exit 1; }

# BEGIN HTTP_CHALLENGE_CHECK
check_http_challenge() {
    local response expected url target
    # Repair existing restrictive directories as well as creating missing ones.
    install -d -m 0755 "$webroot" "$webroot/.well-known" "$webroot/.well-known/acme-challenge"
    challenge_probe="$(mktemp "$webroot/.well-known/acme-challenge/forgeflow-probe.XXXXXX")"
    expected="forgeflow-${challenge_probe##*/}"
    printf '%s' "$expected" > "$challenge_probe"
    chmod 0644 "$challenge_probe"
    url="http://$ip/.well-known/acme-challenge/${challenge_probe##*/}"

    # Check both Nginx routing locally (same Host header) and the public-IP route.
    for target in 127.0.0.1 "$ip"; do
        if ! response="$(curl --noproxy '*' -fsS --max-time 10 \
            --retry 5 --retry-delay 1 --retry-connrefused \
            --connect-to "$ip:80:$target:80" "$url")" || [[ "$response" != "$expected" ]]; then
            printf 'HTTP challenge self-check failed via %s: %s\n' "$target" "$url" >&2
            printf 'Check Nginx routing and webroot permissions. Certbot has not been called.\n' >&2
            if command -v namei >/dev/null; then namei -l "$challenge_probe" >&2; fi
            return 1
        fi
    done
    rm -f -- "$challenge_probe"
    challenge_probe=''
    printf 'HTTP challenge self-check passed.\n'
}
# END HTTP_CHALLENGE_CHECK

ip="${1:-}"
[[ "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || fail "Usage: sudo bash $0 PUBLIC_IPV4"
IFS=. read -r -a octets <<< "$ip"
for octet in "${octets[@]}"; do
    (( 10#$octet <= 255 )) || fail 'Invalid IPv4 address.'
done
(( EUID == 0 )) || fail 'Run this script with sudo.'

site=/etc/nginx/sites-available/forgeflow
enabled=/etc/nginx/sites-enabled/forgeflow
environment=/etc/forgeflow/backend.env
webroot=/var/www/letsencrypt
certbot=/snap/bin/certbot
certificate=/etc/letsencrypt/live/forgeflow-ip
hook=/etc/letsencrypt/renewal-hooks/deploy/forgeflow-nginx-reload

for executable in nginx systemctl curl dpkg awk sed install flock; do
    command -v "$executable" >/dev/null || fail "Missing command: $executable"
done
[[ -x "$certbot" ]] || fail 'Install Certbot first: sudo snap install --classic certbot'
version="$("$certbot" --version | awk '{print $2}')"
dpkg --compare-versions "$version" ge 5.4.0 || fail 'Certbot 5.4+ required: sudo snap refresh certbot'
[[ -f "$site" && -f "$environment" && -f /var/www/forgeflow/index.html ]] || fail 'Existing ForgeFlow installation is incomplete.'
[[ "$(readlink -f "$enabled")" == "$site" ]] || fail 'Enable the existing ForgeFlow Nginx site first.'
systemctl is-active --quiet nginx || fail 'Start Nginx first.'
systemctl is-active --quiet forgeflow || fail 'Start the ForgeFlow backend first.'
systemctl cat snap.certbot.renew.timer >/dev/null 2>&1 || fail 'The Certbot snap renewal timer is missing. Check: sudo snap services certbot'
nginx -t
curl -fsS --max-time 10 http://127.0.0.1:3001/api/v1/health |
    grep -Eq '"storage"[[:space:]]*:[[:space:]]*"postgresql"' || fail 'The PostgreSQL backend is not ready.'

# IP-address TLS clients may omit SNI, so this site must be the 443 default.
# Do not take that role away from an unrelated, existing default TLS site.
tls_conflicts="$(nginx -T 2>/dev/null | awk -v own_site="$site" -v own_enabled="$enabled" '
    # BEGIN TLS_DEFAULT_CHECK
    /^# configuration file / {
        file=$0
        sub(/^# configuration file /, "", file)
        sub(/:$/, "", file)
        line=0
        next
    }
    {
        line++
        sub(/#.*/, "")
        if ($0 ~ /^[[:space:]]*listen[[:space:]]/ &&
            $0 ~ /(^|[[:space:]:])443([[:space:];]|$)/ &&
            $0 ~ /[[:space:]]default_server([[:space:];]|$)/ &&
            file != own_site && file != own_enabled) {
            print file ":" line ": " $0
        }
    }
    # END TLS_DEFAULT_CHECK
')"
if [[ -n "$tls_conflicts" ]]; then
    printf '%s\n' "$tls_conflicts" >&2
    fail 'Another site already uses default_server on port 443. Its Nginx configuration must be reviewed first.'
fi

exec 9>/run/forgeflow-public.lock
flock -n 9 || fail 'Another ForgeFlow public setup is running.'
backup="$(mktemp -d /etc/forgeflow/public-backup.XXXXXX)"
cp -p "$site" "$backup/nginx.conf"
cp -p "$environment" "$backup/backend.env"
if [[ -f "$hook" ]]; then cp -p "$hook" "$backup/reload-hook"; fi
backend_changed=0
challenge_probe=''

# BEGIN PUBLIC_ROLLBACK
rollback() {
    local result="$1"
    trap - ERR INT TERM
    # ERR is inherited by subshells; only the main shell restores configuration.
    if (( BASH_SUBSHELL > 0 )); then exit "$result"; fi
    set +e
    if [[ -n "$challenge_probe" ]]; then rm -f -- "$challenge_probe"; fi
    cp -p "$backup/nginx.conf" "$site"
    cp -p "$backup/backend.env" "$environment"
    if [[ -f "$backup/reload-hook" ]]; then
        cp -p "$backup/reload-hook" "$hook"
    elif [[ -f "$hook" ]]; then
        # This hook belongs to this setup; keep it inert after rollback.
        chmod a-x "$hook"
    fi
    nginx -t && systemctl reload nginx
    if (( backend_changed )); then systemctl restart forgeflow; fi
    printf '\nSetup failed. Previous Nginx/backend configuration restored from %s.\n' "$backup" >&2
    printf 'Issued certificates and firewall allowances, if any, are retained.\n' >&2
    exit "$result"
}
# END PUBLIC_ROLLBACK
trap 'rollback $?' ERR
trap 'rollback 130' INT
trap 'rollback 143' TERM

cat > "$site" <<EOF
server {
    listen 80;
    server_name $ip;
    location ^~ /.well-known/acme-challenge/ {
        root $webroot;
        default_type text/plain;
        try_files \$uri =404;
    }
    location / { return 404; }
}
EOF
nginx -t
systemctl reload nginx
if command -v ufw >/dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
fi

check_http_challenge

printf '\nRequesting the IP certificate. Provider firewalls must allow TCP ports 80 and 443.\n'
printf 'Certbot may ask for contact details and acceptance of its terms.\n'
(
    # Webroot challenge files must remain readable by the Nginx worker.
    umask 022
    "$certbot" certonly --webroot --webroot-path "$webroot" \
        --preferred-profile shortlived --ip-address "$ip" \
        --cert-name forgeflow-ip --keep-until-expiring
)
[[ -f "$certificate/fullchain.pem" && -f "$certificate/privkey.pem" ]]

cat > "$site" <<EOF
server {
    listen 80;
    server_name $ip;
    location ^~ /.well-known/acme-challenge/ {
        root $webroot;
        default_type text/plain;
        try_files \$uri =404;
    }
    location / { return 301 https://$ip\$request_uri; }
}
server {
    listen 443 ssl default_server;
    server_name $ip;
    ssl_certificate $certificate/fullchain.pem;
    ssl_certificate_key $certificate/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    root /var/www/forgeflow;
    index index.html;
    client_max_body_size 25m;
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
    location / { try_files \$uri \$uri/ /index.html; }
}
EOF

# Preserve every other setting, including all database/bootstrap credentials.
sed -E '/^[[:space:]]*(APP_ORIGIN|COOKIE_SECURE)=/d' "$environment" > "$backup/backend.env.next"
printf '\nAPP_ORIGIN=https://%s\nCOOKIE_SECURE=true\n' "$ip" >> "$backup/backend.env.next"
install -m 0600 "$backup/backend.env.next" "$environment"
backend_changed=1
systemctl restart forgeflow
nginx -t
systemctl reload nginx

install -d -m 0755 "$(dirname "$hook")"
cat > "$hook" <<'EOF'
#!/bin/sh
/usr/sbin/nginx -t && /usr/bin/systemctl reload nginx
EOF
chmod 0755 "$hook"
systemctl enable --now snap.certbot.renew.timer
(
    umask 022
    "$certbot" renew --cert-name forgeflow-ip --dry-run --run-deploy-hooks
)

# Connect locally while still checking the certificate for the public IP.
curl -fsS --retry 15 --retry-connrefused --retry-delay 2 --max-time 10 \
    --connect-to "$ip:443:127.0.0.1:443" "https://$ip/" >/dev/null
curl -fsS --retry 15 --retry-connrefused --retry-delay 2 --max-time 10 \
    --connect-to "$ip:443:127.0.0.1:443" "https://$ip/api/v1/health" |
    grep -Eq '"storage"[[:space:]]*:[[:space:]]*"postgresql"'
trap - ERR INT TERM
printf '\nReady: https://%s\nConfiguration backup: %s\n' "$ip" "$backup"
