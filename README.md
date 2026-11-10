# ForgeFlow — Installation, Startup and Operations

ForgeFlow combines project management, documentation, developer tools, RequestLab,
time tracking, business documents, Git and cloud access with AI Knowledge Hub,
FlowPilot, PulseWatch and DataScout. This README covers installation and operations.
User instructions and screenshots are available in the [German PDF manuals](docs/handbuecher/README.md).

Updated on November 10, 2026. The latest recorded production release is
`20261107T153355Z-ff262514`, including DataScout, on **https://forge-flow.de**.
RequestLab was added locally after that release. Release history is recorded in
[the project handoff](docs/HANDOFF.md).

## Choose a starting point

| Goal | Instructions |
| --- | --- |
| Try the interface with session-only sample data | Section 2 |
| Run ForgeFlow locally with persistent data | Sections 3 and 4 |
| Run all apps together locally | Also complete section 5 |
| Update the existing Ubuntu installation | Section 7 |
| Set up a new server | Section 8 |
| Run an additional app independently | Section 5 and that project's README |

## 1. Repository layout and prerequisites

Commands use **Windows PowerShell** unless a block is marked as Bash. Start in the
ForgeFlow repository root. Adjust installation paths to your machine and restart
terminals after changing PATH.

```text
showcase/
  dev-suite/                  This README, npm workspace and shared startup scripts
    frontend/                 React 18 / TypeScript / Vite
    backend/                  Java 21 / Spring Boot / Maven / Flyway
    integrations/             Integration with the separate apps
    deploy/showcase/          Docker, Nginx and systemd configuration
    scripts/                  Setup, startup, backup, tests and release packaging
    docs/                     Technical documentation
    output/pdf/               Individual user manuals
  ai-knowledge-hub/            Next.js + Python/FastAPI + PostgreSQL/pgvector
  flowpilot-codex-starter/     React + Python 3.12 + optional PostgreSQL/Redis
  pulse-watch/                React + Java 21 + PostgreSQL or H2 demo
  data-scout/                 React + Python/FastAPI + PostgreSQL + worker
```

| Component | Requirements |
| --- | --- |
| ForgeFlow frontend | Node.js 22.12+ or 24, npm and the root `package-lock.json` |
| ForgeFlow backend | JDK 21, Maven 3.9 and `JAVA_HOME` pointing to the JDK |
| Persistent ForgeFlow data | PostgreSQL 18 with `psql`, `pg_dump` and `pg_restore` |
| Knowledge Hub | Python 3.12+, its own backend virtual environment, Node dependencies and PostgreSQL with pgvector |
| FlowPilot | Python **3.12** and dependencies locked in `backend/uv.lock`. Redis is used for infrastructure/jobs |
| PulseWatch | Node dependencies and JDK 21/Maven. The local suite demo uses temporary H2 storage |
| DataScout | Docker Desktop running Linux containers, Compose and a configured `infra/.env` |
| Container services | Docker with Linux containers and Compose for the Hub database, DataScout and the Ubuntu multi-app deployment |

```powershell
node --version
npm.cmd --version
java -version
mvn.cmd -version
py -0p
```

`npm.cmd` works with PowerShell execution policies that block `npm.ps1`. Run suite
npm commands from `dev-suite/`. They delegate to the `frontend/` workspace.
Install the locked dependencies with the following command.

```powershell
npm.cmd ci
```

Install dependencies for each neighboring project separately. Preserve existing
`.env` files when applying configuration examples.

## 2. Quick frontend demo

```powershell
$env:VITE_DATA_MODE = 'local'
npm.cmd run dev
```

Open **http://localhost:5173**. Sample-data changes last for the current session and
are lost on reload. This command starts the suite frontend. Authentication, AI,
database persistence and embedded services require their respective backend setup.

After stopping with Ctrl+C, remove the process override.

```powershell
Remove-Item Env:VITE_DATA_MODE -ErrorAction SilentlyContinue
```

To run the suite demo **with all four local additional apps**, prepare the neighboring
projects as described in section 5, start Docker Desktop and run the following command.

```powershell
npm.cmd run start:demo
```

The launcher waits for all services and sets local app URLs in their processes.
Ctrl+C stops the apps started by the launcher and preserves databases and volumes.
To reuse an already running, ready DataScout on 5176/8002 in offline mode, run
`npm.cmd run start:demo -- -UseExistingDataScout`. Those existing containers retain
their independent lifecycle. PulseWatch uses port **5177** in the suite and 5175
when started independently.

RequestLab is integrated into the suite at `#/requestLab/client` and uses the suite's
server and ports. Existing `#/devTools/rest` links redirect there.

## 3. ForgeFlow database and first account

### Prepare PostgreSQL

Install PostgreSQL 18 with the command-line tools and start its service. pgAdmin is
optional. An existing PostgreSQL service can also host the application database.

```powershell
$taskPgBin = 'D:\Program Files\PostgreSQL\18\bin' # Adjust to your installation.
& "$taskPgBin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d postgres -W
```

For a new installation, run these commands in the **psql terminal**.

```sql
CREATE ROLE forgeflow LOGIN;
\password forgeflow
CREATE DATABASE forgeflow OWNER forgeflow;
\q
```

`\password` prompts for the database password with hidden input. For an existing
installation, use its configured database role and credentials.

```powershell
& "$taskPgBin\psql.exe" -h 127.0.0.1 -p 5432 -U forgeflow -d forgeflow -W -c 'SELECT current_database(), current_user;'
```

The expected database and user are both `forgeflow`. Flyway creates the application
tables automatically. A regular database owner role is sufficient.

### Configure the frontend

If `frontend/.env.local` is missing, create it using
[frontend/.env.example](frontend/.env.example). For API-backed ForgeFlow, include
these settings.

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=/api/v1
VITE_NEXTCLOUD_URL=https://cloud.forge-flow.de
```

Cloud access is optional. An empty cloud URL disables its external link. All
`VITE_*` and `NEXT_PUBLIC_*` values are exposed to the browser. Store passwords,
private keys and tokens in server-side configuration.

### Create the first administrator

Perform this bootstrap for a **new application database with no existing accounts**.
There is no built-in application password.

```powershell
mvn.cmd -f backend/pom.xml compile dependency:build-classpath "-Dmdep.outputFile=target/classpath.txt"
java -cp ("backend/target/classes;" + (Get-Content -Raw backend/target/classpath.txt).Trim()) de.forgeflow.auth.HashPassword
```

Enter an application password of at least 12 characters and at most 72 UTF-8 bytes.
Then configure the backend in the same terminal.

```powershell
$env:SPRING_PROFILES_ACTIVE = 'postgres'
$env:DB_URL = 'jdbc:postgresql://127.0.0.1:5432/forgeflow'
$env:DB_USER = 'forgeflow'
$taskDbSecret = Read-Host 'Database password for forgeflow' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $taskDbSecret).Password
$env:AUTH_USER_ID = 'initial-admin'
$env:AUTH_USER_EMAIL = Read-Host 'Application account email'
$env:AUTH_USER_NAME = 'Administrator'
$env:AUTH_PASSWORD_HASH = Read-Host 'Paste the complete generated BCrypt hash'
$env:APP_ORIGIN = 'http://localhost:5173'
$env:COOKIE_SECURE = 'false'
mvn.cmd -f backend/pom.xml spring-boot:run
```

Copy the complete hash, including its `$2a$`, `$2b$` or `$2y$` prefix. Use the original
application password when signing in. The database and application passwords are
independent credentials.

After a successful start, stop with Ctrl+C and clear the sensitive process variables.

```powershell
Remove-Item Env:DB_PASSWORD, Env:AUTH_PASSWORD_HASH -ErrorAction SilentlyContinue
```

Subsequent starts use the accounts stored in PostgreSQL. Manage existing accounts
through the application's account settings.

## 4. Persistent local startup

Check the database connection and save the Windows DPAPI configuration once.

```powershell
npm.cmd run setup:local -- -PostgresBin 'D:\Program Files\PostgreSQL\18\bin'
```

Adjust the path as needed. The database password is encrypted under `backend/.local/`
for the same Windows user on this computer.

To start ForgeFlow before preparing the additional apps, use the following commands.

```powershell
$env:FORGEFLOW_SKIP_SHOWCASE = 'true'
npm.cmd run start:local
```

Open **http://localhost:5173** and sign in with the account created in section 3.
The backend health endpoint is **http://127.0.0.1:3001/api/v1/health** and should report
`status=ok` and `storage=postgresql`.

Ctrl+C stops processes created by this launcher. PostgreSQL continues running and
retains stored data. Logs are written under `backend/.local/logs/`. By default, the
launcher checks or creates a daily backup before starting the backend. The `memory`
backend profile keeps data and attachments in memory for the process lifetime.

Use `COOKIE_SECURE=false` for local HTTP and open the suite at the exact configured
origin, `http://localhost:5173`. Origins include the hostname and port.
See [local operations](docs/local-operation.md).

## 5. Prepare all additional apps locally

The four neighboring repositories shown in section 1 must be present. Complete
their setup first. The shared launcher expects installed dependencies and a prepared
Hub database. Each example below starts in `dev-suite/`.

### AI Knowledge Hub

```powershell
Push-Location ../ai-knowledge-hub
if (!(Test-Path infra/.env)) { Copy-Item infra/.env.example infra/.env }
# Set your own PostgreSQL password in infra/.env.
# Set POSTGRES_PORT=5433 if ForgeFlow already occupies 5432.
docker compose --env-file infra/.env -f infra/compose.yaml up -d --wait
Push-Location backend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e '.[dev]'
# Set DATABASE_URL in backend/.env to match the Hub database.
# Use AI_PROVIDER=fake for local demo operation.
.\.venv\Scripts\python.exe -m alembic upgrade head
Pop-Location
Push-Location frontend
npm.cmd ci
Pop-Location
Pop-Location
```

Select the Hub's own database before running Alembic. The `vector` extension must be
available. Compose initialization installs it when creating a new volume. An existing
PostgreSQL server with pgvector can also be used.

Use the credentials and port from `infra/.env` and `infra/compose.yaml`. If the Hub
container uses host port 5433, configure that port in `backend/.env` too. Use the
Hub's database credentials and URI-encode special characters where required.
See the [Hub README](../ai-knowledge-hub/README.md).

### FlowPilot

```powershell
Push-Location ../flowpilot-codex-starter
npm.cmd ci
python -m venv .tools/bootstrap
.\.tools\bootstrap\Scripts\python.exe -m pip install uv==0.13.6
$env:UV_PYTHON_INSTALL_DIR = Join-Path $PWD '.tools/python'
$env:UV_CACHE_DIR = Join-Path $PWD '.cache/uv'
.\.tools\bootstrap\Scripts\uv.exe sync --project backend --python 3.12 --locked
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
.\backend\.venv\Scripts\python.exe -m flowpilot.integrations.keys
Pop-Location
```

Save the generated integration key privately in the intended backend configuration.
The shared demo runs with its bundled mock services. Persistent workflows and jobs
require configured PostgreSQL/Redis connections, an explicit
`python -m flowpilot.migrate` run from the prepared backend environment and a running
worker. Run migrations before starting the normal API.
See the [FlowPilot README](../flowpilot-codex-starter/README.md).

### PulseWatch

```powershell
Push-Location ../pulse-watch
npm.cmd ci
Pop-Location
```

The suite launcher builds the Java backend and starts the demo profile with temporary
H2 storage and internal test cases. For independent persistent operation, configure
its account and PostgreSQL using `setup:local` and `setup:account`.
See the [PulseWatch README](../pulse-watch/README.md).

### DataScout

Start Docker Desktop with Linux containers. Prepare DataScout's private environment
file and set a random URL-safe `POSTGRES_PASSWORD` of at least 24 letters/digits
before the first database initialization.

```powershell
Push-Location ../data-scout
if (!(Test-Path infra/.env)) { Copy-Item infra/.env.example infra/.env }
# Configure POSTGRES_PASSWORD in infra/.env before starting services.
# When switching from a running standalone instance, stop its app services.
docker compose --env-file infra/.env -f infra/compose.yaml stop backend worker frontend
Pop-Location
```

The shared launcher builds and starts DataScout with `infra/compose.yaml` and
`infra/compose.suite.yaml`. Suite mode uses frontend port 5176, API port 8002 and
PostgreSQL host port 55432. Collection runs against offline fixtures. Existing volumes
retain their database credentials, so preserve the configured password for them.

The local demo shares fixture data. The production integration checks the live
ForgeFlow session and uses private per-account PostgreSQL schemas and an
account-scoped worker. Its collection also runs offline.
See the [DataScout README](../data-scout/README.md) and
[server integration guide](../data-scout/docs/SUITE-REMOTE.md).

### Start together

```powershell
Remove-Item Env:FORGEFLOW_SKIP_SHOWCASE -ErrorAction SilentlyContinue
npm.cmd run start:local
```

| App | Frontend | Backend | Shared local mode |
| --- | --- | --- | --- |
| ForgeFlow | localhost:5173 | 127.0.0.1:3001 | PostgreSQL, regular sign-in |
| Knowledge Hub | localhost:3000 | 127.0.0.1:8000 | local-demo, fake AI, separate database |
| FlowPilot | localhost:5174 | 127.0.0.1:8001 | Demo, mock AI/HTTP |
| PulseWatch | localhost:5177 | 127.0.0.1:8082 | Demo/H2, internal test cases |
| DataScout | localhost:5176 | 127.0.0.1:8002 | Offline fixtures, separate database and worker |

All ten application ports must be available, together with the configured database
ports. Startup can take several minutes. Local demo settings apply to the launched
processes. Local additional apps use their demo identities. The production suite
integration uses the active ForgeFlow session. Standalone apps have their own
navigation and authentication.

## 6. Initial application configuration

1. Review your profile, appearance and language in Settings. ForgeFlow supports
   German, English and French.
2. As an administrator, select globally visible apps under **Applications**. API
   authorization is enforced separately from navigation visibility.
3. Under **AI**, select the apps that show an AI button. Project Manager is enabled
   by default and provides domain-data tools. Other enabled apps provide general
   chat. Write proposals require confirmation.
4. Maintain the shared industry list under **Global settings**.
5. Create additional regular users through administrator account management.
6. Configure sender details, taxes, currency, bank details and payment terms before
   creating business documents. Customer portal accounts see explicitly shared content.

Knowledge Hub, FlowPilot and PulseWatch use English when the suite language is French.
DataScout's interface is currently English. Cloud/Nextcloud manages its own language
and accounts. User instructions are in the [German manuals](docs/handbuecher/README.md).

## 7. Update the existing Ubuntu server

The deployment scripts target `forge-flow.de` using SSH access through
`dreinerts@185.56.150.178`. Adapt the host-specific scripts before using another
server. The update installer requires the existing base installation described
in section 8.

### Server prerequisites

- Ubuntu with running ForgeFlow and PostgreSQL 18 services, Nginx and valid HTTPS.
- Canonical origin `APP_ORIGIN=https://forge-flow.de` and `COOKIE_SECURE=true`.
- Docker Engine with Compose, Python 3, Git and PostgreSQL client tools.
- At least 1.5 GB available RAM and 5 GiB free disk space before container builds.
- Existing application accounts, production secrets and databases.
- Local Node/Maven builds for the suite and server-side container builds for the additional apps.

### Build current artifacts

Run lint and the relevant tests before packaging. Build a fresh Spring Boot JAR
after backend changes.

```powershell
npm.cmd run lint
npm.cmd test
mvn.cmd -f backend/pom.xml package
# Optional with PostgreSQL 18 installed, run isolated database tests and package the JAR.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-postgres-isolated.ps1
```

Build the suite frontend with explicit production settings.

```powershell
$env:VITE_DATA_MODE = 'api'
$env:VITE_API_BASE_URL = '/api/v1'
$env:VITE_KNOWLEDGE_HUB_URL = 'https://forge-flow.de/knowledge-hub'
$env:VITE_FLOWPILOT_URL = 'https://forge-flow.de/flowpilot/'
$env:VITE_PULSEWATCH_URL = 'https://forge-flow.de/pulsewatch/'
$env:VITE_DATASCOUT_URL = 'https://forge-flow.de/datascout/'
$env:VITE_SHOWCASE_ADMIN_ONLY = 'false'
npm.cmd run build
```

Build FlowPilot, PulseWatch and DataScout with their production paths.

```powershell
Push-Location ../flowpilot-codex-starter/frontend
$env:VITE_BASE_PATH = '/flowpilot/'
$env:VITE_API_PREFIX = '/flowpilot-api'
$env:VITE_SUITE_ORIGIN = 'https://forge-flow.de'
npm.cmd run build
Pop-Location

Push-Location ../pulse-watch/frontend
$env:VITE_BASE_PATH = '/pulsewatch/'
$env:VITE_API_BASE_URL = '/pulsewatch-api/api/v1'
$env:VITE_SUITE_ORIGIN = 'https://forge-flow.de'
npm.cmd run build
Pop-Location

Push-Location ../data-scout/frontend
$env:VITE_BASE_PATH = '/datascout/'
$env:VITE_API_PREFIX = '/datascout-api'
$env:VITE_SUITE_ORIGIN = 'https://forge-flow.de'
npm.cmd run build
Pop-Location
```

Use a dedicated build terminal and close it afterwards so that subsequent local
starts use their intended settings. Knowledge Hub is built from packaged sources
inside Docker. The installer manages its environment and private provider settings
on the server.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-showcase-release.ps1
```

The packager checks artifact freshness, production paths, Docker contexts, Python
pins, Linux line endings and checksums. It writes
`node_modules/.tmp/forgeflow-showcase.tar.gz`, its `.sha256` file and an LF-normalized
`install-linux-showcase.sh`. The package includes application sources and build
artifacts. Private configuration and data stay in their respective environments.

### Transfer and install

```powershell
scp node_modules/.tmp/forgeflow-showcase.tar.gz `
  node_modules/.tmp/forgeflow-showcase.tar.gz.sha256 `
  node_modules/.tmp/install-linux-showcase.sh dreinerts@185.56.150.178:
ssh -t dreinerts@185.56.150.178 'sudo bash ~/install-linux-showcase.sh ~/forgeflow-showcase.tar.gz'
```

Enter SSH and sudo passwords in the terminal. Wait for **Deployment ready**. The
installer backs up applications, databases and configuration before making changes,
builds containers, runs migrations and checks services. Migrations V16–V19 cover app/AI
selection, French, DataScout and RequestLab. Deploy the JAR and frontend together.

If installation fails, retain the complete terminal output and private backup path.
Follow the documented rollback procedure for the installed version. Application-file
and Nginx restoration require separate consideration of database compatibility.

### Verify the update

```powershell
Invoke-RestMethod https://forge-flow.de/api/v1/health
curl.exe -fsS https://forge-flow.de/
```

Expect `ok`, `postgresql` and the current frontend asset name in the HTML. Anonymous
requests to `/knowledge-hub/`, `/flowpilot/`, `/pulsewatch/` and `/datascout/` must
return 401. Refresh with Ctrl+F5, sign in again and check the authenticated views.
Verify AI model access through the configured provider separately.

The complete procedure and rollback details are in the
[deployment guide](docs/showcase-deployment.md).

## 8. New servers and optional integrations

Prepare the ForgeFlow base installation on a new server first. It requires a
PostgreSQL role and database, Java 21 runtime, service user, JAR at
`/opt/forgeflow/backend.jar`, `forgeflow` systemd service, private
`/etc/forgeflow/backend.env`, frontend at `/var/www/forgeflow`, Nginx proxy to
`127.0.0.1:3001`, DNS and TLS/Certbot. Bootstrap the first administrator using the
PostgreSQL profile as described in section 3. The Ubuntu update checks for this base.
See [base server and HTTPS setup](docs/linux-server.md) and
[backend configuration](backend/README.md).

| Integration | Setup and scope |
| --- | --- |
| ForgeFlow AI | Configure `AI_ENABLED=true`, `OPENAI_API_KEY` and an explicit `AI_MODEL` on the backend. AI is disabled by default. [AI setup](docs/ai-assistant.md) |
| Hub/FlowPilot AI | The production installer reads private suite provider settings. Optional `/etc/forgeflow/showcase/ai.json` takes precedence. Hub requires consent. FlowPilot initially allows five calls per UTC day. [Provider operations](docs/showcase-deployment.md) |
| Git and external PostgreSQL connections | Configure a persistent `INTEGRATION_SECRET_KEY`, Git and target hosts through `DEV_DB_HOSTS`. Back up the key with the database. [Developer integrations](docs/developer-tools.md) |
| Nextcloud | Separate DNS/TLS/Docker installation, accounts and backups. [Nextcloud setup](docs/nextcloud.md) |
| Trial accounts | Six-hour lifetime. `TRIAL_ACCOUNTS_ENABLED=false` disables new registration. The backend cleans up expired trial data |
| FlowPilot HTTP/email | The documented showcase uses simulated adapters |
| PulseWatch alerts | Alert events and local email previews |
| DataScout collection | Offline fixtures in the suite integration, with private per-account storage in production. [Server setup](../data-scout/docs/SUITE-REMOTE.md) |

## 9. Backups, restoration and restarts

```powershell
npm.cmd run backup:local
# Review restore parameters for a selected backup and a new target.
Get-Help ./scripts/restore-local.ps1 -Detailed
```

Review the restore parameters in [local operations](docs/local-operation.md). The
script restores into a **new** database whose name starts with `forgeflow_restore_`.
DPAPI configuration is tied to its Windows user and computer.

On Ubuntu, keep regular private backups of all application databases, including
DataScout, private `/etc/forgeflow/` configuration, Redis data, Git clones and any
Nextcloud volumes. Plan recurring backups in addition to installer snapshots.
Backend restarts can end application sessions. The PostgreSQL profile retains
stored domain data and attachments.

```bash
sudo systemctl status forgeflow forgeflow-showcase nginx
sudo journalctl -u forgeflow -n 100 --no-pager
sudo docker compose --project-name forgeflow-showcase \
  --project-directory /opt/forgeflow-showcase/current \
  --env-file /etc/forgeflow/showcase/images.env ps
```

Review private logs for credentials before sharing them. Operate and back up
Nextcloud separately.

## 10. Troubleshooting

| Symptom | Check |
| --- | --- |
| `node`, `java` or `mvn` cannot be found | Check PATH, JDK 21 and `JAVA_HOME`, then reopen the IntelliJ terminal |
| A port is occupied or the launcher exits | Stop your previous launcher with Ctrl+C and inspect `backend/.local/logs/` |
| Sign-in reports `Invalid request origin` | Compare the browser URL with `APP_ORIGIN`, including hostname, scheme and port |
| API data is unavailable after sign-in | Check `VITE_DATA_MODE=api`, backend availability and session validity. API errors are reported to the user |
| An additional app is missing from navigation | Check the global app selection and any administrator-only setting |
| The AI button is missing | Check the global AI selection, current app and API mode. Project Manager is enabled by default |
| AI requests fail | Check server provider configuration, model access, quota and limits |
| Hub fails to start or returns 503 | Check its database connection, pgvector and Alembic migrations. Check database readiness as well as process health |
| FlowPilot reports Python/import errors | Use its dedicated Python 3.12 environment prepared through uv |
| DataScout fails to start | Check Docker Desktop, `infra/.env`, database credentials and host ports 5176, 8002 and 55432 |
| Changes disappear | Check the storage mode. Frontend local mode, memory storage and H2 demos have temporary data |
| Saving reports a conflict | Reload the server state and review your changes before retrying |
| The old interface appears after deployment | Refresh with Ctrl+F5 and compare the served asset name with the release |
| SSH reports `Permission denied` | Use a valid key or interactive password authentication to complete the transfer and installation |

## 11. Verification and further documentation

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd test
mvn.cmd -f backend/pom.xml test
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-postgres-isolated.ps1
```

The PostgreSQL helper uses a separate temporary cluster. Use isolated test data for
verification. If Java/Maven are missing from the agent's PATH,
`scripts/verify-backend.ps1` can prepare portable tools. Initial downloads require
network access. Keep build/test artifacts and secrets outside version control.

- [German PDF manuals with screenshots](docs/handbuecher/README.md)
- [Local operations, ports and backups](docs/local-operation.md)
- [Full deployment and production providers](docs/showcase-deployment.md)
- [Backend setup](backend/README.md) and [API contract](docs/backend-api.md)
- [Frontend documentation](docs/frontend.md)
- [Project handoff and known limitations](docs/HANDOFF.md)
- [Manual browser checks](docs/browser-check.md)
