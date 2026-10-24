#!/usr/bin/env bash
# Test the deployment preflight without root, Nginx, or server access.
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
parser="$(sed -n '/# BEGIN TLS_DEFAULT_CHECK/,/# END TLS_DEFAULT_CHECK/p' "$script_dir/enable-linux-public.sh")"
[[ -n "$parser" ]] || { printf 'TLS check not found.\n' >&2; exit 1; }

check() {
    local name="$1" expected="$2" actual
    actual="$(awk -v own_site=/etc/nginx/sites-available/forgeflow \
        -v own_enabled=/etc/nginx/sites-enabled/forgeflow "$parser")"
    if [[ "$actual" != "$expected" ]]; then
        printf 'FAIL: %s\nExpected: %s\nActual: %s\n' "$name" "$expected" "$actual" >&2
        exit 1
    fi
    printf 'PASS: %s\n' "$name"
}

check 'Ubuntu default site with commented TLS listeners' '' <<'EOF'
# configuration file /etc/nginx/sites-enabled/default:
server {
    listen 80 default_server;
    # listen 443 ssl default_server;
    # listen [::]:443 ssl default_server;
}
EOF

check 'Inline comments and other ports are ignored' '' <<'EOF'
# configuration file /etc/nginx/sites-enabled/default:
    listen 80; # listen 443 ssl default_server;
    listen 1443 ssl default_server;
    listen 443 ssl; # default_server
EOF

check 'Existing ForgeFlow listeners are allowed' '' <<'EOF'
# configuration file /etc/nginx/sites-enabled/forgeflow:
    listen 443 ssl default_server;
# configuration file /etc/nginx/sites-available/forgeflow:
    listen [::]:443 ssl default_server;
EOF

check 'Active IPv4 conflict reports its source' \
    '/etc/nginx/sites-enabled/other:2:     listen 443 ssl default_server;' <<'EOF'
# configuration file /etc/nginx/sites-enabled/other:
server {
    listen 443 ssl default_server;
}
EOF

check 'Active IPv6 conflict is detected' \
    '/etc/nginx/sites-enabled/other:1: listen [::]:443 default_server ssl;' <<'EOF'
# configuration file /etc/nginx/sites-enabled/other:
listen [::]:443 default_server ssl;
EOF

check 'Explicit bind address conflict is detected' \
    '/etc/nginx/sites-enabled/other:1: listen 185.56.150.178:443 ssl default_server;' <<'EOF'
# configuration file /etc/nginx/sites-enabled/other:
listen 185.56.150.178:443 ssl default_server;
EOF

check 'A different file named forgeflow still conflicts' \
    '/etc/nginx/conf.d/forgeflow:1: listen 443 ssl default_server;' <<'EOF'
# configuration file /etc/nginx/conf.d/forgeflow:
listen 443 ssl default_server;
EOF

# Exercise the actual HTTP check with simulated HTTP responses, without a server.
test_dir="$(mktemp -d /tmp/forgeflow-public-test.XXXXXX)"
cleanup() {
    case "$test_dir" in
        /tmp/forgeflow-public-test.*) rm -rf -- "$test_dir" ;;
        *) printf 'Unexpected test directory; leaving it intact.\n' >&2 ;;
    esac
}
trap cleanup EXIT
sed -n '/# BEGIN HTTP_CHALLENGE_CHECK/,/# END HTTP_CHALLENGE_CHECK/p' \
    "$script_dir/enable-linux-public.sh" > "$test_dir/http-check.sh"
source "$test_dir/http-check.sh"
webroot="$test_dir/webroot"
ip=185.56.150.178
challenge_probe=''
scenario=success
curl() {
    printf '%s\n' "$@" >> "$test_dir/curl-arguments"
    case "$scenario" in
        success) cat "$challenge_probe" ;;
        not_found) return 22 ;;
        wrong_content) printf 'A different website' ;;
        public_wrong_content)
            if [[ "$*" == *":80:127.0.0.1:80"* ]]; then
                cat "$challenge_probe"
            else
                printf 'A different website'
            fi
            ;;
    esac
}

umask 077
check_http_challenge
[[ -z "$challenge_probe" ]]
[[ -z "$(find "$webroot" -type f -print -quit)" ]]
grep -Fxq '185.56.150.178:80:127.0.0.1:80' "$test_dir/curl-arguments"
grep -Fxq '185.56.150.178:80:185.56.150.178:80' "$test_dir/curl-arguments"
grep -Fxq -- '--noproxy' "$test_dir/curl-arguments"
printf 'PASS: Exact challenge content checked locally and via public IP; probe cleaned up\n'

for scenario in not_found wrong_content public_wrong_content; do
    if check_http_challenge > "$test_dir/http-output" 2>&1; then
        printf 'FAIL: HTTP check accepted %s\n' "$scenario" >&2
        exit 1
    fi
    grep -Fq 'Certbot has not been called.' "$test_dir/http-output"
    rm -f -- "$challenge_probe"
    challenge_probe=''
    printf 'PASS: HTTP check rejects %s\n' "$scenario"
done

if [[ "$OSTYPE" == linux* ]]; then
    chmod 0700 "$webroot" "$webroot/.well-known"
    scenario=success
    check_http_challenge
    for directory in "$webroot" "$webroot/.well-known" "$webroot/.well-known/acme-challenge"; do
        [[ "$(stat -c %a "$directory")" == 755 ]]
    done
    printf 'PASS: Existing restrictive webroot permissions repaired\n'
else
    printf 'SKIP: POSIX directory permission assertions require Linux\n'
fi

# A failing Certbot subshell must trigger exactly one restoration in its parent.
sed -n '/# BEGIN PUBLIC_ROLLBACK/,/# END PUBLIC_ROLLBACK/p' \
    "$script_dir/enable-linux-public.sh" > "$test_dir/rollback-function.sh"
mkdir "$test_dir/backup"
printf 'original site' > "$test_dir/backup/nginx.conf"
printf 'original environment' > "$test_dir/backup/backend.env"
printf 'changed site' > "$test_dir/site"
printf 'changed environment' > "$test_dir/environment"
printf 'temporary challenge' > "$test_dir/probe"
cat > "$test_dir/rollback-case.sh" <<'EOF'
set -Eeuo pipefail
source "$1/rollback-function.sh"
backup="$1/backup"
site="$1/site"
environment="$1/environment"
hook="$1/no-hook"
challenge_probe="$1/probe"
backend_changed=1
nginx() { return 0; }
systemctl() { printf '%s\n' "$*" >> "$backup/service-calls"; }
trap 'rollback $?' ERR
( exit 37 )
EOF
if bash "$test_dir/rollback-case.sh" "$test_dir" > "$test_dir/rollback-output" 2>&1; then
    printf 'FAIL: Subshell failure was ignored\n' >&2
    exit 1
else
    [[ "$?" == 37 ]]
fi
[[ "$(grep -c 'Setup failed.' "$test_dir/rollback-output")" == 1 ]]
[[ "$(cat "$test_dir/site")" == 'original site' ]]
[[ "$(cat "$test_dir/environment")" == 'original environment' ]]
[[ ! -e "$test_dir/probe" ]]
[[ "$(grep -c 'restart forgeflow' "$test_dir/backup/service-calls")" == 1 ]]
printf 'PASS: Subshell failure restores configuration once, cleans probe, and preserves exit code\n'
