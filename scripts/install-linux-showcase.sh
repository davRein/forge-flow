#!/usr/bin/env bash
# Install the prepared release on the inventoried forge-flow.de host.
set -Eeuo pipefail
umask 077
fail() { printf '%s\n' "$*" >&2; exit 1; }
(( EUID == 0 )) || fail 'Run with sudo.'
[[ $# == 1 ]] || fail 'Usage: sudo bash install-linux-showcase.sh /absolute/path/forgeflow-showcase.tar.gz'
archive="$(realpath -- "$1")"
[[ -f "$archive" && -f "$archive.sha256" ]] || fail 'Release archive or SHA256 file missing.'
for tool in docker python3 nginx curl psql pg_dump pg_dumpall runuser systemctl flock install tar sha256sum ss; do
    command -v "$tool" >/dev/null || fail "Required command unavailable: $tool"
done
exec 9>/run/forgeflow-showcase.lock
flock -n 9 || fail 'Another showcase installation is running.'
(cd -- "$(dirname -- "$archive")" && sha256sum -c "$(basename -- "$archive").sha256")
nginx -t
[[ "$(docker info --format '{{.OSType}}')" == linux ]] || fail 'A working Linux Docker engine is required.'
docker compose version
[[ -x /usr/bin/docker ]] || fail 'The service expects /usr/bin/docker; review the existing Docker installation before proceeding.'
systemctl is-active --quiet forgeflow || fail 'Existing ForgeFlow must be active.'
curl --noproxy '*' -fsS --max-time 10 http://127.0.0.1:3001/api/v1/health | grep -q 'postgresql' || fail 'ForgeFlow PostgreSQL health failed.'
python3 - <<'PY'
import pathlib, shutil, zipfile
values = {}
for line in pathlib.Path('/etc/forgeflow/backend.env').read_text().splitlines():
    key, sep, value = line.partition('=')
    if sep and key.strip() in ('APP_ORIGIN','COOKIE_SECURE'):
        values[key.strip()] = value.strip().strip('\"\'')
if values.get('APP_ORIGIN') != 'https://forge-flow.de' or values.get('COOKIE_SECURE','').lower() != 'true':
    raise SystemExit('Existing suite must use https://forge-flow.de with secure cookies. No settings changed.')
with zipfile.ZipFile('/opt/forgeflow/backend.jar') as jar:
    if 'BOOT-INF/classes/de/forgeflow/auth/TrialAccounts.class' not in jar.namelist():
        raise SystemExit('Current JAR must already support V14 trial expiry for safe rollback.')
memory = int(next(line.split()[1] for line in pathlib.Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:')))
if memory < 1500000 or shutil.disk_usage('/opt').free < 5 * 1024**3:
    raise SystemExit('Need at least 1.5 GB available memory and 5 GiB free space before building.')
PY
pg_version="$(runuser -u postgres -- psql -X -w -At -d postgres -c 'SHOW server_version_num;')"
[[ "$pg_version" =~ ^18[0-9]{4}$ ]] || fail 'This release was prepared for the inventoried PostgreSQL 18 server.'
root=/opt/forgeflow-showcase
previous=''
if [[ -L "$root/current" ]]; then
    previous="$(readlink -f -- "$root/current")"
    [[ "$previous" == "$root/releases/"* && -f "$previous/compose.yaml" ]] || fail 'Unexpected previous release link.'
elif [[ -e "$root/current" ]]; then fail 'Unmanaged current release path; no replacement performed.'
else
    for port in 3300 3302 8000 8001 6381 8082 8084; do
        [[ -z "$(ss -H -lnt "sport = :$port")" ]] || fail "Local port $port is already in use; no process was stopped."
    done
    [[ -z "$(docker ps -aq --filter label=com.docker.compose.project=forgeflow-showcase)" ]] || fail 'Unmanaged showcase containers exist.'
fi
if [[ -z "$previous" ]] || ! grep -q '  datascout-api:' "$previous/compose.yaml"; then
    [[ -z "$(ss -H -lnt 'sport = :8002')" ]] || fail 'DataScout port 8002 is already occupied; no process stopped.'
fi
install -d -m 0700 "$root/releases" /etc/forgeflow/showcase
backup="$(mktemp -d /opt/forgeflow/showcase-update.XXXXXX)"
printf 'Private backup: %s\n' "$backup"
cp -p /opt/forgeflow/backend.jar "$backup/backend.jar"
tar -czf "$backup/frontend.tar.gz" -C /var/www/forgeflow .
runuser -u postgres -- pg_dumpall --globals-only > "$backup/roles.sql"
for database in forgeflow ai_knowledge_hub flowpilot forgeflow_pulsewatch forgeflow_datascout; do
    if [[ "$(runuser -u postgres -- psql -X -w -At -d postgres -c "SELECT count(*) FROM pg_database WHERE datname='$database';")" == 1 ]]; then
        runuser -u postgres -- pg_dump --format=custom --dbname="$database" > "$backup/$database.dump"
        [[ -s "$backup/$database.dump" ]] || fail "Empty backup: $database"
    fi
done
# Preserve only V18's menu addition for compatibility if old binaries are restored.
runuser -u postgres -- psql -X -w -At -v ON_ERROR_STOP=1 -d forgeflow -c "WITH staged AS (SELECT id, visible_apps, revision, CASE WHEN visible_apps::jsonb ? 'dataScout' THEN visible_apps::jsonb ELSE visible_apps::jsonb || jsonb_build_array('dataScout') END AS apps FROM ff_global_settings), expected AS (SELECT id, visible_apps, revision, CASE WHEN apps ? 'devTools' AND NOT (apps ? 'requestLab') THEN (SELECT jsonb_agg(element ORDER BY ordinal) FROM (SELECT value AS element, ordinality*2 AS ordinal FROM jsonb_array_elements(apps) WITH ORDINALITY UNION ALL SELECT to_jsonb('requestLab'::text), ordinality*2+1 FROM jsonb_array_elements(apps) WITH ORDINALITY WHERE value=to_jsonb('devTools'::text)) expanded) ELSE apps END AS new_apps FROM staged) SELECT format('UPDATE ff_global_settings SET visible_apps=%L, revision=%L WHERE id=%s AND visible_apps::jsonb=%L::jsonb;', visible_apps, revision, id, new_apps::text) FROM expected WHERE new_apps<>visible_apps::jsonb;" > "$backup/apps-menu-rollback.sql"
cp -a /etc/forgeflow/showcase "$backup/configuration"
if [[ -f /etc/systemd/system/forgeflow-showcase.service ]]; then cp -p /etc/systemd/system/forgeflow-showcase.service "$backup/service"; fi
previous_public=''
if [[ -L /var/www/forgeflow-showcase/current ]]; then
    previous_public="$(readlink -f /var/www/forgeflow-showcase/current)"
    [[ "$previous_public" == /var/www/forgeflow-showcase/releases/* && -d "$previous_public" ]] || fail 'Unexpected existing public release link.'
elif [[ -e /var/www/forgeflow-showcase/current ]]; then fail 'Unmanaged public release directory; no replacement performed.'; fi
stage="$(mktemp -d "$root/releases/.incoming.XXXXXX")"
python3 - "$archive" "$stage" <<'PY'
import pathlib, sys, tarfile
destination = pathlib.Path(sys.argv[2])
with tarfile.open(sys.argv[1], 'r:gz') as archive:
    members = archive.getmembers()
    if len(members) > 20000 or sum(item.size for item in members) > 1024**3:
        raise SystemExit('Oversized release archive.')
    for item in members:
        path = pathlib.PurePosixPath(item.name)
        if path.is_absolute() or '..' in path.parts or not (item.isdir() or item.isfile()):
            raise SystemExit('Unsafe release archive; symlinks and traversal are forbidden.')
    archive.extractall(destination, filter='data')
PY
(cd -- "$stage" && sha256sum -c SHA256SUMS > "$backup/verified-files.log")
release_id="$(python3 - "$stage/release.json" <<'PY'
import json, re, sys
data = json.load(open(sys.argv[1]))
if data.get('origin') != 'https://forge-flow.de' or not re.fullmatch(r'[0-9TZ-]+-[a-f0-9]{8}', data.get('release_id','')):
    raise SystemExit('Invalid release manifest.')
print(data['release_id'])
PY
)"
release="$root/releases/$release_id"
[[ ! -e "$release" ]] || fail 'Release already exists; prepare a new package or inspect the previous attempt.'
mv -- "$stage" "$release"
compose() { docker compose --project-name forgeflow-showcase --project-directory "$release" --env-file /etc/forgeflow/showcase/images.env -f "$release/compose.yaml" "$@"; }
started=0
main_changed=0
nginx_changed=0
rollback() {
    local code="$1" restored=1
    trap - ERR EXIT INT TERM
    set +e
    if (( nginx_changed )); then python3 "$release/docker/nginx_site.py" --restore "$backup" || restored=0; nginx -t && systemctl reload nginx || restored=0; fi
    if (( started )); then compose stop || restored=0; fi
    if [[ -f "$backup/configuration/images.env" ]]; then cp -p "$backup/configuration/images.env" /etc/forgeflow/showcase/images.env; fi
    if [[ -n "$previous" ]]; then
        ln -sfn -- "$previous" "$root/current"
        docker compose --project-name forgeflow-showcase --project-directory "$previous" --env-file /etc/forgeflow/showcase/images.env -f "$previous/compose.yaml" up -d --no-build || restored=0
    elif [[ -L "$root/current" ]]; then unlink "$root/current"; fi
    if [[ -n "$previous_public" ]]; then ln -sfn -- "$previous_public" /var/www/forgeflow-showcase/current
    elif [[ -L /var/www/forgeflow-showcase/current ]]; then unlink /var/www/forgeflow-showcase/current; fi
    if (( main_changed )); then
        systemctl stop forgeflow || restored=0
        if [[ -f "$backup/apps-menu-rollback.sql" ]]; then runuser -u postgres -- psql -X -w -v ON_ERROR_STOP=1 -d forgeflow -f "$backup/apps-menu-rollback.sql" >/dev/null || restored=0; fi
        if python3 "$release/scripts/check-account-rollback.py" "$backup/backend.jar"; then
            install -o forgeflow -g forgeflow -m 0644 "$backup/backend.jar" /opt/forgeflow/backend.jar || restored=0
            tar --no-same-owner -xzpf "$backup/frontend.tar.gz" -C /var/www/forgeflow || restored=0
            systemctl start forgeflow || restored=0
        else
            restored=0
            printf 'Backend remains stopped to preserve assigned app permissions. Review the current release; do not downgrade the JAR alone.\n' >&2
        fi
    fi
    if [[ -f "$backup/service" ]]; then cp -p "$backup/service" /etc/systemd/system/forgeflow-showcase.service
    else systemctl disable forgeflow-showcase.service >/dev/null 2>&1; rm -f /etc/systemd/system/forgeflow-showcase.service; fi
    systemctl daemon-reload || restored=0
    printf '\nDeployment failed; restoration status=%s. Backup: %s\n' "$restored" "$backup" >&2
    printf 'New databases/roles and additive migrations are retained; nothing was dropped. Review before retrying.\n' >&2
    exit "$code"
}
trap 'rollback $?' ERR
trap 'code=$?; if (( code )); then rollback "$code"; fi' EXIT
trap 'rollback 130' INT
trap 'rollback 143' TERM

if ! runuser -u postgres -- psql -X -w -At -d postgres -c "SELECT name FROM pg_available_extensions WHERE name='vector';" | grep -qx vector; then
    apt-get update
    apt-get -s --no-install-recommends install postgresql-18-pgvector > "$backup/apt-plan.log"
    if grep -Eq '^(Remv|Purg) |^Inst (postgresql-18|postgresql-common|nginx|docker-ce|docker.io|containerd.io) ' "$backup/apt-plan.log"; then
        fail "Package plan changes an existing core service; review $backup/apt-plan.log."
    fi
    DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=l apt-get install -y --no-install-recommends postgresql-18-pgvector
fi
python3 "$release/docker/provision.py"

# Resolve official base images to immutable digests once; preserve them on later deployments.
python_image=''; node_image=''; redis_image=''; maven_image=''; java_image=''; nginx_image=''
if [[ -f /etc/forgeflow/showcase/images.env ]]; then
    python_image="$(sed -n 's/^PYTHON_IMAGE=//p' /etc/forgeflow/showcase/images.env)"
    node_image="$(sed -n 's/^NODE_IMAGE=//p' /etc/forgeflow/showcase/images.env)"
    redis_image="$(sed -n 's/^REDIS_IMAGE=//p' /etc/forgeflow/showcase/images.env)"
    maven_image="$(sed -n 's/^MAVEN_IMAGE=//p' /etc/forgeflow/showcase/images.env)"
    java_image="$(sed -n 's/^JAVA_IMAGE=//p' /etc/forgeflow/showcase/images.env)"
    nginx_image="$(sed -n 's/^NGINX_IMAGE=//p' /etc/forgeflow/showcase/images.env)"
fi
for image in python:3.12-slim-bookworm node:22-bookworm-slim redis:8-alpine maven:3.9.11-eclipse-temurin-21 eclipse-temurin:21-jre-jammy nginx:1.29.2-alpine; do
    case "$image" in
        python:*) current="$python_image";;
        node:*) current="$node_image";;
        redis:*) current="$redis_image";;
        maven:*) current="$maven_image";;
        eclipse-temurin:*) current="$java_image";;
        nginx:*) current="$nginx_image";;
    esac
    if [[ -z "$current" ]]; then docker pull "$image"; digest="$(docker image inspect "$image" --format '{{index .RepoDigests 0}}')"
    else digest="$current"; fi
    case "$image" in
        python:*) python_image="$digest";;
        node:*) node_image="$digest";;
        redis:*) redis_image="$digest";;
        maven:*) maven_image="$digest";;
        eclipse-temurin:*) java_image="$digest";;
        nginx:*) nginx_image="$digest";;
    esac
done
for digest in "$python_image" "$node_image" "$redis_image" "$maven_image" "$java_image" "$nginx_image"; do
    [[ "$digest" =~ ^[a-z0-9/._-]+@sha256:[a-f0-9]{64}$ ]] || fail 'Invalid pinned base image.'
done
printf 'RELEASE_ID=%s\nPYTHON_IMAGE=%s\nNODE_IMAGE=%s\nREDIS_IMAGE=%s\nMAVEN_IMAGE=%s\nJAVA_IMAGE=%s\nNGINX_IMAGE=%s\n' "$release_id" "$python_image" "$node_image" "$redis_image" "$maven_image" "$java_image" "$nginx_image" > /etc/forgeflow/showcase/images.env
compose config --quiet
for service in hub-api flow-api hub-web pulsewatch-api pulsewatch-web datascout-api; do COMPOSE_PARALLEL_LIMIT=1 compose build "$service"; done
compose run --rm --no-deps hub-api python -m alembic upgrade head
compose run --rm --no-deps flow-api python -m flowpilot.migrate
compose run --rm --no-deps flow-api python -m flowpilot.suite_gateway
compose run --rm --no-deps datascout-api python -m app.suite_gateway
ln -sfn -- "$release" "$root/current"
started=1
compose up -d --no-build
ready=0
for attempt in {1..60}; do
    if curl --noproxy '*' -fsS --max-time 3 -H 'Host: forge-flow.de' http://127.0.0.1:8000/health > "$backup/hub-health.json" &&
       curl --noproxy '*' -fsS --max-time 3 http://127.0.0.1:8001/api/v1/ready > "$backup/flow-ready.json" &&
       curl --noproxy '*' -fsSL --max-redirs 5 --max-time 3 http://127.0.0.1:3300/knowledge-hub > /dev/null &&
       curl --noproxy '*' -fsS --max-time 3 http://127.0.0.1:8082/api/v1/health | grep -q '"database":"UP"' &&
       curl --noproxy '*' -fsS --max-time 3 http://127.0.0.1:3302/ > /dev/null &&\
       curl --noproxy '*' -fsS --max-time 3 http://127.0.0.1:8002/api/v1/ready > /dev/null &&
       [[ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$(compose ps -q datascout-worker)")" == healthy ]]; then ready=1; break; fi
    sleep 2
done
(( ready )) || fail 'New application readiness failed; check private container logs.'
python3 - "$backup/hub-health.json" "$backup/flow-ready.json" <<'PY'
import json, sys
hub, flow = (json.load(open(path)) for path in sys.argv[1:])
assert hub['status']=='ok' and hub['mode']=='authenticated'
assert flow['status']=='ready' and flow['mode']=='infrastructure'
assert flow['dependencies']['postgresql']=='ok' and flow['dependencies']['redis']=='ok'
PY
public="/var/www/forgeflow-showcase/releases/$release_id"
install -d -m 0755 /var/www/forgeflow-showcase /var/www/forgeflow-showcase/releases "$public"
cp -a "$release/flow-web/." "$public/"
install -d -m 0755 "$public/datascout"
cp -a "$release/datascout/frontend/dist/." "$public/datascout/"
find "$public" -type d -exec chmod 0755 {} +
find "$public" -type f -exec chmod 0644 {} +
ln -sfn -- "$public" /var/www/forgeflow-showcase/current
nginx_changed=1
python3 "$release/docker/nginx_site.py" "$release/docker" "$backup"
systemctl reload nginx
main_changed=1
bash "$release/scripts/update-linux-chat.sh" forge-flow.de
for path in /knowledge-hub/ /knowledge-hub-api/health /flowpilot/ /flowpilot-api/api/v1/ready /pulsewatch/ /pulsewatch-api/api/v1/auth/session /datascout/ /datascout-api/api/v1/jobs /api/v1/auth/showcase-session; do
    status="$(curl --noproxy '*' -sS --max-time 15 --output /dev/null --write-out '%{http_code}' --connect-to forge-flow.de:443:127.0.0.1:443 "https://forge-flow.de$path")"
    [[ "$status" == 401 ]] || fail "Anonymous access did not fail closed: $path HTTP $status"
done
status="$(curl --noproxy '*' -sS --max-time 15 --output /dev/null --write-out '%{http_code}' --connect-to forge-flow.de:443:127.0.0.1:443 \
    -X POST -H 'Origin: https://untrusted.example' -H 'Content-Type: application/json' --data '{}' https://forge-flow.de/flowpilot-api/api/v1/workflows)"
[[ "$status" == 403 ]] || fail 'Cross-origin FlowPilot write did not fail closed.'
status="$(curl --noproxy '*' -sS --max-time 15 --output /dev/null --write-out '%{http_code}' --connect-to forge-flow.de:443:127.0.0.1:443 -X POST -H 'Origin: https://untrusted.example' https://forge-flow.de/datascout-api/api/v1/sources/demo-catalog/collect)"
[[ "$status" == 403 ]] || fail 'Cross-origin DataScout write did not fail closed.'
status="$(curl --noproxy '*' -sS --max-time 5 --output /dev/null --write-out '%{http_code}' -H 'X-ForgeFlow-User-Id: forged' http://127.0.0.1:8002/api/v1/jobs)"
[[ "$status" == 401 ]] || fail 'DataScout accepted an unverified client identity.'
install -m 0644 "$release/docker/forgeflow-showcase.service" /etc/systemd/system/forgeflow-showcase.service
systemctl daemon-reload
systemctl enable --now forgeflow-showcase.service
trap - ERR EXIT INT TERM
printf '\nDeployment ready: https://forge-flow.de\nBackup: %s\n' "$backup"
printf 'Showcase apps use the live Dev-Suite session and separate user workspaces. Hub registration remains closed.\n'
printf 'Databases: forgeflow (preserved), ai_knowledge_hub + vector, flowpilot, forgeflow_pulsewatch; private Redis: 127.0.0.1:6381.\n'
printf 'Existing Nextcloud containers/database were not changed. AI uses private server configuration; no production fake fallback. HTTP integrations remain mock.\n'
printf 'Reload with Ctrl+F5 and sign in again. No separate Hub or PulseWatch account is needed.\n'
