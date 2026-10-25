#!/usr/bin/env bash
# Offline checks: no installation, networking, certificates or real containers.
set -Eeuo pipefail
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$script_dir/install-linux-nextcloud.sh"
test_root=$(cd -- "${TMPDIR:-/tmp}" && pwd -P)
case_dir=$(mktemp -d "$test_root/forgeflow-nextcloud-test.XXXXXX")
cleanup() {
    if [[ -d "$case_dir" && ! -L "$case_dir" && $(cd -- "$case_dir" && pwd -P) == "$test_root"/forgeflow-nextcloud-test.* ]]; then rm -rf -- "$case_dir"; fi
}
trap cleanup EXIT
for domain in cloud.forge-flow.de files.example.test; do cloud_domain_valid "$domain"; done
for domain in localhost 185.56.150.178 'https://cloud.example.test' 'a..test' '-a.test' 'a-.test' 'a.test;bad' '*.test' 'a.test/b'; do
    if cloud_domain_valid "$domain"; then printf 'Accepted invalid domain: %s\n' "$domain"; exit 1; fi
done
printf 'PASS: Invalid hostnames and configuration injection rejected\n'
cloud_compose > "$case_dir/compose.yaml"
grep -Fq "ports: ['127.0.0.1:8081:80']" "$case_dir/compose.yaml"
[[ $(grep -c '^    ports:' "$case_dir/compose.yaml") == 1 ]]
grep -Fq 'private: {internal: true}' "$case_dir/compose.yaml"
grep -Fq 'PASSWORD_FILE: /run/secrets/' "$case_dir/compose.yaml"
if grep -Eq 'privileged:|docker.sock|network_mode: host|NEXTCLOUD_ADMIN_PASSWORD:' "$case_dir/compose.yaml"; then exit 1; fi
printf 'PASS: Only app port is published on loopback; private DB/cache and file secrets\n'
cloud_nginx cloud.example.test http > "$case_dir/http.conf"
grep -Fq 'location ^~ /.well-known/acme-challenge/' "$case_dir/http.conf"
if grep -q 'proxy_pass\|listen 443\|default_server' "$case_dir/http.conf"; then exit 1; fi
cloud_nginx cloud.example.test https > "$case_dir/https.conf"
grep -Fq 'proxy_set_header X-Forwarded-For $remote_addr;' "$case_dir/https.conf"
grep -Fq 'proxy_pass http://127.0.0.1:8081;' "$case_dir/https.conf"
grep -Fq 'return 308 https://cloud.example.test$request_uri;' "$case_dir/https.conf"
if grep -q '3001\|default_server\|proxy_add_x_forwarded_for' "$case_dir/https.conf"; then exit 1; fi
printf 'PASS: Challenge-only HTTP and isolated HTTPS proxy with overwritten forwarding headers\n'
# Simulate old Nginx workers returning 404 before the new site becomes available.
curl() {
    local output='' headers='' arg count
    printf '%s\n' "$*" >> "$case_dir/curl-arguments"
    while (( $# )); do
        arg="$1"; shift
        case "$arg" in --output) output="$1"; shift ;; --dump-header) headers="$1"; shift ;; esac
    done
    count=$(cat "$case_dir/curl-count" 2>/dev/null || printf 0)
    count=$((count + 1)); printf '%s' "$count" > "$case_dir/curl-count"
    printf 'HTTP/1.1 200 OK\r\n' > "$headers"
    printf '%s' "$probe_expected" > "$output"
    if [[ "$probe_mode" == delayed && "$count" -lt 3 ]]; then printf '404'; return 22; fi
    if [[ "$probe_mode" != missing-marker ]]; then printf 'X-ForgeFlow-Nextcloud-Probe: 1\r\n' >> "$headers"; fi
    if [[ "$probe_mode" == wrong-content ]]; then printf 'other application' > "$output"; fi
    printf '200'
}
sleep() { :; }
probe_expected=fixture-token; probe_mode=delayed
cloud_check_challenge cloud.example.test "$probe_expected" 127.0.0.1
[[ $(cat "$case_dir/curl-count") == 3 ]]
grep -Fq -- '--noproxy *' "$case_dir/curl-arguments"
grep -Fq -- '--resolve cloud.example.test:80:127.0.0.1' "$case_dir/curl-arguments"
printf 'PASS: Challenge waits for new workers and bypasses environment proxies\n'
for probe_mode in missing-marker wrong-content; do
    printf 0 > "$case_dir/curl-count"
    if cloud_check_challenge cloud.example.test "$probe_expected" > "$case_dir/probe-error" 2>&1; then exit 1; fi
    [[ $(cat "$case_dir/curl-count") == 15 ]]
    grep -Fq 'ACME probe failed' "$case_dir/probe-error"
done
unset -f curl sleep
printf 'PASS: Wrong location and wrong response content remain rejected after bounded retries\n'
# Verify rollback restores an existing file, and removes only its own new link/site.
backup="$case_dir/backup"; site="$case_dir/site"; enabled="$case_dir/enabled"; had_link=1
mkdir "$backup"
printf 'previous site' > "$backup/site.conf"; printf 'new site' > "$site"
nginx() { :; }; systemctl() { :; }
cloud_restore_site
cmp "$backup/site.conf" "$site"
rm "$backup/site.conf"
ln -s "$site" "$enabled"
had_link=0
cloud_restore_site
[[ ! -e "$site" && ! -L "$enabled" ]]
printf 'PASS: Failed setup restores only its own virtual host\n'
bash -n "$script_dir/install-linux-nextcloud.sh"
bash -n "$script_dir/backup-linux-nextcloud.sh"
printf 'PASS: Installer and backup Bash syntax\n'
