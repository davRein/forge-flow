#!/usr/bin/env bash
# Offline regression checks; never invoke root/system services or connect to a server.
set -Eeuo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
test_dir="$(mktemp -d /tmp/forgeflow-chat-test.XXXXXX)"
cleanup() {
    case "$test_dir" in /tmp/forgeflow-chat-test.*) rm -rf -- "$test_dir" ;; *) printf 'Unexpected test directory; retained.\n' >&2 ;; esac
}
trap cleanup EXIT
sed -n '/# BEGIN CHAT_ARCHIVE_CHECK/,/# END CHAT_ARCHIVE_CHECK/p' "$script_dir/update-linux-chat.sh" > "$test_dir/archive-check.sh"
sed -n '/# BEGIN CHAT_ROLLBACK/,/# END CHAT_ROLLBACK/p' "$script_dir/update-linux-chat.sh" > "$test_dir/rollback.sh"
sed -n '/# BEGIN CHAT_PUBLISH/,/# END CHAT_PUBLISH/p' "$script_dir/update-linux-chat.sh" > "$test_dir/publish.sh"
mkdir -p "$test_dir/static/assets"
printf 'original index' > "$test_dir/static/index.html"
printf 'asset' > "$test_dir/static/assets/test.js"
tar -czf "$test_dir/good.tar.gz" -C "$test_dir/static" .
cat > "$test_dir/archive-case.sh" <<'EOF'
set -Eeuo pipefail
source "$1/archive-check.sh"
fail() { printf '%s\n' "$*" >&2; exit 1; }
frontend="$1/$2"
validate_frontend
EOF
bash "$test_dir/archive-case.sh" "$test_dir" good.tar.gz
printf 'PASS: Production frontend archive is accepted\n'
printf 'broken gzip' > "$test_dir/broken.tar.gz"
if bash "$test_dir/archive-case.sh" "$test_dir" broken.tar.gz > "$test_dir/result" 2>&1; then exit 1; fi
printf 'PASS: Invalid archive is rejected before installation\n'
# Generate a parent-directory path without writing outside the temporary test fixture.
tar -czf "$test_dir/parent.tar.gz" --transform='s|^\./assets|./../assets|' -C "$test_dir/static" .
if bash "$test_dir/archive-case.sh" "$test_dir" parent.tar.gz > "$test_dir/result" 2>&1; then exit 1; fi
printf 'PASS: Parent-directory archive paths are rejected\n'
if [[ "$OSTYPE" == linux* ]]; then
    ln -s /etc/passwd "$test_dir/static/assets/link"
    tar -czf "$test_dir/link.tar.gz" -C "$test_dir/static" .
    if bash "$test_dir/archive-case.sh" "$test_dir" link.tar.gz > "$test_dir/result" 2>&1; then exit 1; fi
    printf 'PASS: Archive symlinks are rejected\n'
else
    printf 'SKIP: Symlink creation check requires Linux\n'
fi
mkdir "$test_dir/backup" "$test_dir/web"
printf 'old backend' > "$test_dir/backup/backend.jar"
printf 'new backend' > "$test_dir/backend.jar"
printf 'new frontend' > "$test_dir/web/index.html"
tar -czf "$test_dir/backup/frontend.tar.gz" -C "$test_dir/static" index.html
cat > "$test_dir/rollback-case.sh" <<'EOF'
set -Eeuo pipefail
source "$1/rollback.sh"
backup="$1/backup"
installed_jar="$1/backend.jar"
web="$1/web"
backend_changed=1
frontend_changed=1
systemctl() { printf '%s\n' "$*" >> "$backup/service-calls"; }
install() { cp "${@: -2:1}" "${@: -1}"; }
ready() { return 0; }
trap 'rollback $?' ERR
# Failure inside a subshell must restore exactly once in the parent.
(false)
EOF
if bash "$test_dir/rollback-case.sh" "$test_dir" > "$test_dir/result" 2>&1; then exit 1; fi
[[ "$(cat "$test_dir/backend.jar")" == 'old backend' ]]
[[ "$(cat "$test_dir/web/index.html")" == 'original index' ]]
[[ "$(grep -c '^stop forgeflow$' "$test_dir/backup/service-calls")" == 1 ]]
[[ "$(grep -c '^start forgeflow$' "$test_dir/backup/service-calls")" == 1 ]]
grep -q 'Previous application restored' "$test_dir/result"
printf 'PASS: Failed update restores both application parts exactly once\n'

mkdir -p "$test_dir/backup/frontend/assets" "$test_dir/web/assets"
printf 'previous asset' > "$test_dir/web/assets/old.js"
printf 'new asset' > "$test_dir/backup/frontend/assets/new.js"
printf 'complete new index' > "$test_dir/backup/frontend/index.html"
cat > "$test_dir/publish-case.sh" <<'EOF'
set -Eeuo pipefail
source "$1/publish.sh"
backup="$1/backup"
web="$1/web"
cp() {
    if [[ "${FAIL_COPY:-0}" == 1 ]]; then return 1; fi
    command cp "$@"
}
mv() {
    [[ "$(cat "$web/index.html")" == 'original index' ]]
    [[ "$(cat "$web/assets/new.js")" == 'new asset' ]]
    [[ "$(cat "$web/assets/old.js")" == 'previous asset' ]]
    if [[ "${FAIL_RENAME:-0}" == 1 ]]; then return 1; fi
    command mv "$@"
}
if [[ "${FAIL_RENAME:-0}" == 1 || "${FAIL_COPY:-0}" == 1 ]]; then
    if publish_frontend; then exit 1; fi
    [[ "$(cat "$web/index.html")" == 'original index' ]]
    [[ "$(find "$web" -name '.forgeflow-index.*' | wc -l)" == 0 ]]
    exit 0
fi
publish_frontend
[[ "$(cat "$web/index.html")" == 'complete new index' ]]
[[ "$(find "$web" -name '.forgeflow-index.*' | wc -l)" == 0 ]]
EOF
bash "$test_dir/publish-case.sh" "$test_dir"
printf 'PASS: Complete entry point is renamed only after assets; old assets retained\n'
printf 'original index' > "$test_dir/web/index.html"
FAIL_RENAME=1 bash "$test_dir/publish-case.sh" "$test_dir"
printf 'PASS: Failed publication retains the old entry point and removes staging file\n'
FAIL_COPY=1 bash "$test_dir/publish-case.sh" "$test_dir"
printf 'PASS: Failed asset copy cannot publish the new entry point\n'
