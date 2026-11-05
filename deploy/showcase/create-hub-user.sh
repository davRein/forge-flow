#!/usr/bin/env bash
set -Eeuo pipefail
(( EUID == 0 )) || { printf 'Run with sudo.\n' >&2; exit 1; }
[[ -t 0 ]] || { printf 'Use an interactive SSH terminal for account setup.\n' >&2; exit 1; }
printf 'Knowledge Hub uses a separate login. Review https://forge-flow.de/knowledge-hub/privacy first.\n'
read -r -p 'Email for the Hub account: ' email
[[ "$email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || { printf 'Invalid email.\n' >&2; exit 1; }
docker compose --project-name forgeflow-showcase --project-directory /opt/forgeflow-showcase/current \
    --env-file /etc/forgeflow/showcase/images.env exec hub-api python -m app.manage create-user --email "$email"
