#!/usr/bin/env bash
# Read-only inventory before deploying ForgeFlow, Knowledge Hub and FlowPilot.
# Never sources application environments, prints credentials, installs packages or restarts services.
set -uo pipefail
export LC_ALL=C
export SYSTEMD_PAGER=cat

if (( EUID != 0 )); then
    printf 'Run: sudo bash check-linux-showcase.sh\n' >&2
    exit 1
fi

section() { printf '\n== %s ==\n' "$1"; }
version() {
    local executable="$1"
    shift
    if command -v "$executable" >/dev/null 2>&1; then
        timeout 15 "$executable" "$@" 2>&1 | head -n 3 || true
    else
        printf '%s: not installed or not in root PATH\n' "$executable"
    fi
}

section 'Read-only server inventory (no application or package changes)'
date -u '+UTC %Y-%m-%d %H:%M:%S'
if [[ -r /etc/os-release ]]; then
    # Read only public OS metadata; do not source shell files.
    grep -E '^(PRETTY_NAME|ID|VERSION_ID)=' /etc/os-release || true
fi
uname -m
printf 'Logical CPUs: '; getconf _NPROCESSORS_ONLN || true
free -m || true
df -h / /var /opt || true

section 'Installed runtimes (FlowPilot requires Python 3.12; Hub requires Node >=22.13)'
version python3 --version
version python3.12 --version
if command -v python3.12 >/dev/null 2>&1; then
    python3.12 -c 'import ssl, venv; print("Python 3.12 ssl and venv imports: OK")' || true
fi
version node --version
version npm --version
version java -version
version nginx -v
version psql --version
version redis-server --version
version git --version

section 'Service status (configuration and environment values are not printed)'
for service in forgeflow nginx postgresql redis-server knowledge-hub knowledge-hub-api flowpilot flowpilot-api; do
    printf '%s: ' "$service"
    systemctl is-active "$service" 2>/dev/null || true
done

section 'Listening TCP addresses and ports (no connection contents)'
if command -v ss >/dev/null 2>&1; then ss -H -lnt; fi

section 'Existing ForgeFlow installation paths'
for path in /opt/forgeflow/backend.jar /var/www/forgeflow/index.html /etc/forgeflow/backend.env /opt/knowledge-hub /opt/flowpilot; do
    if [[ -e "$path" ]]; then
        stat --format='%A %U:%G %n' -- "$path"
    else
        printf 'Absent: %s\n' "$path"
    fi
done

section 'Nginx configured hostnames and auth-request capability'
if command -v nginx >/dev/null 2>&1; then
    if nginx -V 2>&1 | grep -q -- '--with-http_auth_request_module'; then
        printf 'http_auth_request module: compiled in\n'
    else
        printf 'http_auth_request module: not confirmed\n'
    fi
    # Do not dump nginx config: it can contain private headers or other secrets.
    nginx -T 2>/dev/null | awk '
        $1 == "server_name" {
            for (i=2; i<=NF; i++) {
                name=$i; gsub(/;/,"",name);
                if (name ~ /^[A-Za-z0-9_.*-]+$/) print "server_name: " name;
            }
        }' | sort -u || true
fi

section 'PostgreSQL metadata only (no user records or credentials)'
pg_version=''
readonly_pg() {
    local database="$1"
    shift
    timeout 20 runuser -u postgres -- env \
        PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=10000' \
        psql -X -w -v ON_ERROR_STOP=1 -At --dbname="$database" "$@"
}
if command -v psql >/dev/null 2>&1 && command -v runuser >/dev/null 2>&1 && id postgres >/dev/null 2>&1; then
    pg_version="$(readonly_pg postgres -c 'SHOW server_version_num;' 2>/dev/null)" || pg_version=''
    if [[ "$pg_version" =~ ^[0-9]+$ ]]; then
        printf 'Server version number: %s\n' "$pg_version"
        readonly_pg postgres -c "
            SELECT 'Database: ' || datname || ' | owner=' || pg_get_userbyid(datdba)
                || ' | encoding=' || pg_encoding_to_char(encoding) || ' | connections=' || datallowconn
            FROM pg_database WHERE NOT datistemplate ORDER BY datname;
            SELECT 'Required ForgeFlow database: ' || CASE WHEN EXISTS
                (SELECT FROM pg_database WHERE datname='forgeflow') THEN 'FOUND' ELSE 'MISSING' END;
            SELECT 'Required Knowledge Hub database (ai_knowledge_hub or knowledge_hub): ' || CASE WHEN EXISTS
                (SELECT FROM pg_database WHERE datname IN ('ai_knowledge_hub','knowledge_hub'))
                THEN 'FOUND - verify configured name' ELSE 'MISSING' END;
            SELECT 'FlowPilot infrastructure database: ' || CASE WHEN EXISTS
                (SELECT FROM pg_database WHERE datname='flowpilot') THEN 'FOUND' ELSE 'MISSING' END;
            SELECT 'Role: ' || rolname || ' | login=' || rolcanlogin || ' | superuser=' || rolsuper
                || ' | create-db=' || rolcreatedb || ' | create-role=' || rolcreaterole
            FROM pg_roles WHERE rolname IN
                ('forgeflow','ai_knowledge_hub_app','knowledge_hub_app','knowledge_hub','flowpilot')
                OR oid IN (SELECT datdba FROM pg_database WHERE
                    datname IN ('forgeflow','ai_knowledge_hub','knowledge_hub','flowpilot'))
            ORDER BY rolname;
            SELECT 'Available pgvector: ' || name || ' ' || default_version
            FROM pg_available_extensions WHERE name = 'vector';" || true
        # Extension availability on the server is different from activation in the application DB.
        # Inspect only catalogs and the three tools' migration histories, never domain records.
        for database in forgeflow ai_knowledge_hub knowledge_hub flowpilot; do
            if ! exists="$(readonly_pg postgres -c "SELECT count(*) FROM pg_database WHERE datname='$database';" 2>/dev/null)"; then
                printf 'UNVERIFIED database: %s (catalog lookup failed)\n' "$database"
                continue
            fi
            [[ "$exists" == 1 ]] || continue
            section "Database detail: $database (read-only)"
            readonly_pg "$database" <<'SQL' || printf 'UNVERIFIED details: %s (query/connect failed)\n' "$database"
SELECT 'Extension: ' || extname || ' | version=' || extversion
FROM pg_extension ORDER BY extname;
SELECT 'Required Hub vector extension: ' || CASE WHEN EXISTS
    (SELECT FROM pg_extension WHERE extname='vector') THEN 'ACTIVE' ELSE 'MISSING' END
WHERE current_database() IN ('ai_knowledge_hub','knowledge_hub');
SELECT 'Schema: ' || nspname || ' | owner=' || pg_get_userbyid(nspowner)
    || ' | database-owner-usage=' || has_schema_privilege(d.datdba,n.oid,'USAGE')
    || ' | database-owner-create=' || has_schema_privilege(d.datdba,n.oid,'CREATE')
FROM pg_namespace n CROSS JOIN pg_database d WHERE d.datname=current_database()
    AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' ORDER BY nspname;
SELECT 'Migration table: ' || table_schema || '.' || table_name FROM information_schema.tables
WHERE table_name IN ('flyway_schema_history','alembic_version','flowpilot_migrations')
    AND table_type='BASE TABLE' ORDER BY table_schema,table_name;
SELECT 'Application tables: ' || count(*) FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_type='BASE TABLE';
SELECT format('SELECT %L || version || %L || success FROM %I.%I ORDER BY installed_rank DESC LIMIT 1',
    'Flyway latest: ', ' | success=', table_schema, table_name)
FROM information_schema.tables WHERE table_name='flyway_schema_history' AND table_type='BASE TABLE'
\gexec
SELECT format('SELECT %L || count(*) FROM %I.%I WHERE NOT success',
    'Flyway failed migrations: ', table_schema, table_name)
FROM information_schema.tables WHERE table_name='flyway_schema_history' AND table_type='BASE TABLE'
\gexec
SELECT format('SELECT %L || version_num FROM %I.%I ORDER BY version_num',
    'Alembic revision: ', table_schema, table_name)
FROM information_schema.tables WHERE table_name='alembic_version' AND table_type='BASE TABLE'
\gexec
SELECT format('SELECT %L || version FROM %I.%I ORDER BY version',
    'FlowPilot migration: ', table_schema, table_name)
FROM information_schema.tables WHERE table_name='flowpilot_migrations' AND table_type='BASE TABLE'
\gexec
SQL
        done
        printf '%s\n' \
            'Expected source heads: ForgeFlow Flyway V14; Hub Alembic 0003_authentication; FlowPilot 005_ai_budget.sql.' \
            'Knowledge Hub requires vector activated in its own DB, not only installed server-wide.' \
            'Owner/schema metadata does not verify application-password login; check configured service connections before deployment.' \
            'Nonstandard configured DB/role names must be reconciled with this inventory before creating anything.'
    else
        printf 'Local PostgreSQL metadata query unavailable; review peer access/service status.\n'
    fi
else
    printf 'PostgreSQL client or postgres system account unavailable.\n'
fi

section 'Separate Nextcloud database (only if the managed installation already exists)'
if [[ -f /opt/forgeflow-nextcloud/ready ]] && command -v docker >/dev/null 2>&1; then
    timeout 15 docker ps -a --filter label=com.docker.compose.project=forgeflow-nextcloud \
        --format '{{.Label "com.docker.compose.service"}}: {{.Status}}' || true
    cloud_database="$(timeout 15 docker ps \
        --filter label=com.docker.compose.project=forgeflow-nextcloud \
        --filter label=com.docker.compose.service=db --format '{{.ID}}' 2>/dev/null)" || cloud_database=''
    if [[ "$cloud_database" =~ ^[a-f0-9]{12,64}$ ]]; then
        timeout 20 docker exec --user postgres \
            --env 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=10000' \
            "$cloud_database" psql -X -w -v ON_ERROR_STOP=1 -At -U nextcloud -d nextcloud -c "
                SELECT 'Nextcloud database: ' || datname || ' | owner=' || pg_get_userbyid(datdba)
                FROM pg_database WHERE datname='nextcloud';
                SELECT 'Nextcloud schema tables: ' || count(*) FROM information_schema.tables
                WHERE table_schema='public' AND table_type='BASE TABLE';" \
            || printf 'UNVERIFIED: Nextcloud database connection.\n'
    else
        printf 'UNVERIFIED: managed Nextcloud database container not uniquely running.\n'
    fi
else
    printf 'No managed Nextcloud installation detected; no Nextcloud changes planned by this inventory.\n'
fi

section 'Package candidates from existing apt indexes (no apt update/install)'
if command -v apt-cache >/dev/null 2>&1; then
    packages=(python3.12 python3.12-venv python3-pip nodejs npm redis-server)
    if [[ "$pg_version" =~ ^[0-9]+$ ]]; then
        packages+=("postgresql-$((10#$pg_version / 10000))-pgvector")
    fi
    apt-cache policy "${packages[@]}" 2>/dev/null | awk '
        /^[^[:space:]]/ { package=$0 }
        /^[[:space:]]*(Installed|Candidate):/ { print package " " $0 }' || true
fi

section 'Requirements to resolve before publication'
printf '%s\n' \
    'Knowledge Hub: Node >=22.13, Python >=3.12, venv, own PostgreSQL DB/role, pgvector.' \
    'Knowledge Hub public mode: authenticated, secure cookies, closed registration, fake AI initially.' \
    'FlowPilot: Python >=3.12,<3.13; venv; mock AI/HTTP initially.' \
    'FlowPilot background jobs: separate PostgreSQL DB/role, Redis and worker in infrastructure mode.' \
    'FlowPilot currently has no account/tenant management: public management needs access protection.' \
    'Both: HTTPS proxy, persistent systemd services, backups, matching trusted suite origin.' \
    'Inventory complete. No packages, application files, databases or services were changed.'
