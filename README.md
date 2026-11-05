# ForgeFlow – Installation and Setup

Local development uses Windows PowerShell; the deployed application runs on Ubuntu.
Run project commands from the repository root, `D:\Projects\react\showcase\dev-suite`.
The frontend is in `frontend/`, the Java backend in `backend/`. Skip completed setup steps.

## 1. Prerequisites

- Node.js 22 with npm.
- Java JDK 21; `JAVA_HOME` must point to the JDK.
- Maven 3.9; Java and Maven must be available on your `PATH`.
- PostgreSQL 18 with the server and command-line tools (`psql`, `pg_dump`, `pg_restore`).

Verify the installed tools in your terminal:

```powershell
node --version
npm.cmd --version
java -version
mvn.cmd -version
```

## 2. Set Up PostgreSQL

Use the [PostgreSQL Windows installer](https://www.postgresql.org/download/windows/).
Select the server and Command Line Tools; pgAdmin is optional. No additional packages
from Stack Builder are required for this application. Keep port `5432`, set a password
for the `postgres` administrator account, and start the PostgreSQL service.

In PowerShell, set your installation path and connect as the database administrator:

```powershell
$taskPgBin = 'D:\Program Files\PostgreSQL\18\bin' # Adjust to your installation path
& "$taskPgBin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d postgres -W
```

In **psql**, create a dedicated database account and the application database:

```sql
CREATE ROLE forgeflow LOGIN;
\password forgeflow
CREATE DATABASE forgeflow OWNER forgeflow;
\q
```

`\password forgeflow` prompts for the new database password without displaying it.
This is a psql command and does not work in the pgAdmin query editor.
The application uses the `forgeflow` account.

Verify the connection using that account's password:

```powershell
& "$taskPgBin\psql.exe" -h 127.0.0.1 -p 5432 -U forgeflow -d forgeflow -W -c 'SELECT current_database(), current_user;'
```

Both values must be `forgeflow`. The backend creates the tables and applies migrations
automatically at startup; no manual table creation is required.

## 3. Prepare the Project

```powershell
npm.cmd ci
```

Create or update `frontend/.env.local` with the following contents:

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=/api/v1
VITE_NEXTCLOUD_URL=https://cloud.forge-flow.de
```

Vite reads this file from `frontend/`. `api` requires a backend login; `local` uses temporary
example data without a backend. The Cloud URL is optional; an empty value disables its link.
Never put passwords, hashes or API keys in `VITE_*` settings: these values reach the browser.

## 4. Create the First Application Account

This is only required for a new application database. Compile the backend and generate
a BCrypt hash for your chosen application login password:

```powershell
mvn.cmd -f backend/pom.xml compile dependency:build-classpath "-Dmdep.outputFile=target/classpath.txt"
java -cp ("backend/target/classes;" + (Get-Content -Raw backend/target/classpath.txt).Trim()) de.forgeflow.auth.HashPassword
```

The password must contain at least 12 characters and occupy no more than 72 UTF-8 bytes.
Then configure the backend in the same terminal:

```powershell
$env:SPRING_PROFILES_ACTIVE = 'postgres'
$env:DB_URL = 'jdbc:postgresql://127.0.0.1:5432/forgeflow'
$env:DB_USER = 'forgeflow'
$taskDbSecret = Read-Host 'Database password for forgeflow' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $taskDbSecret).Password
$env:AUTH_USER_ID = 'initial-admin'
$env:AUTH_USER_EMAIL = Read-Host 'Email for the application account'
$env:AUTH_USER_NAME = 'Administrator'
$env:AUTH_PASSWORD_HASH = Read-Host 'Paste the complete generated BCrypt hash'
$env:APP_ORIGIN = 'http://localhost:5173'
$env:COOKIE_SECURE = 'false'
mvn.cmd -f backend/pom.xml spring-boot:run
```

At the hash prompt, paste the generated line starting with `$2a$`, `$2b$`, or `$2y$`.
Use the original password when logging in later. The database password and application
login password are independent; there is no default application password.

After a successful startup, stop the backend with **Ctrl+C**.

## 5. Configure Local Startup

```powershell
npm.cmd run setup:local
npm.cmd run start:local
```

Setup checks the database connection and stores the connection password in `backend/.local/`,
encrypted for the same Windows user on the same PC.
If needed, specify the PostgreSQL installation path explicitly:
`npm.cmd run setup:local -- -PostgresBin 'D:\Program Files\PostgreSQL\18\bin'`.

Open **http://localhost:5173**. The backend uses port `3001`; both ports must be available
before starting the application. **Ctrl+C** stops both processes.
The local frontend launcher also starts the neighboring AI Knowledge Hub and FlowPilot
frontends/APIs in explicit fake/mock mode and embeds them into the suite navigation.
Their installed dependencies and Knowledge Hub's configured PostgreSQL/pgvector database
are prerequisites. Ports `3000`, `8000`, `5174` and `8001` must also be free.
Standalone operation remains available; setup and opt-out details:
[integrated apps](docs/local-operation.md#integrierte-apps-und-standalone-betrieb).
For subsequent starts, run `npm.cmd run start:local`. Run setup again after changing the database password.

`COOKIE_SECURE=false` is intended for local HTTP development. The startup scripts require Windows;
for direct backend configuration, see [backend/README.md](backend/README.md).
For local configuration and backup details, see [docs/local-operation.md](docs/local-operation.md).

## 6. Complete Application Setup

Sign in with the application email and original password chosen in step 4.
Under **Settings → Global settings → Customer industries**, review the shared industry list.
Before issuing quotes or invoices, configure the sender, address, currency, rate, tax and
payment terms under **Business → Billing settings**. Additional application accounts are
created by an administrator; customer portal accounts are created under **Business → Customer portal**.

## 7. Ubuntu Deployment

The current ForgeFlow address is **https://forge-flow.de**; SSH uses `185.56.150.178`.
The server runs Java 21, PostgreSQL 18, Nginx, systemd and Certbot. Build tools run on the
development PC; Node.js and Maven are not required on a server using the packaged application.
The update command below requires an already configured ForgeFlow installation.

Nginx serves `frontend/dist/` from `/var/www/forgeflow` and proxies `/api/` to
`127.0.0.1:3001`. The backend JAR is `/opt/forgeflow/backend.jar`, its service is `forgeflow`,
and its private environment file is `/etc/forgeflow/backend.env`. Keep the PostgreSQL profile
and database credentials there. For the public domain, configure:

```dotenv
APP_ORIGIN=https://forge-flow.de
COOKIE_SECURE=true
```

Use the canonical domain without `www`; do not append a slash to `APP_ORIGIN`.
HTTPS certificates are managed on Ubuntu through Certbot/Let's Encrypt, independently of
the IONOS SSL products. The Certbot renewal timer must remain active.

After source changes, [build a fresh deployment package](docs/linux-server.md#build-the-current-deployment-package).
Upload both application parts and their checksum manifest from Windows PowerShell:

```powershell
scp scripts/update-linux-chat.sh scripts/test-linux-chat.sh `
  node_modules/.tmp/forgeflow-chat-backend.jar `
  node_modules/.tmp/forgeflow-chat-frontend.tar.gz `
  node_modules/.tmp/forgeflow-chat.sha256 `
  dreinerts@185.56.150.178:

ssh -t dreinerts@185.56.150.178 'bash ~/test-linux-chat.sh && sudo bash ~/update-linux-chat.sh forge-flow.de'
```

Despite its historical name, this script updates the complete application. It checks the
package and backs up the database and application before deployment. Flyway applies migrations
automatically; existing accounts remain. Reload with **Ctrl+F5** and sign in again.
Server configuration, service commands and diagnostics: [Ubuntu guide](docs/linux-server.md).

## 8. Optional Nextcloud Setup

Nextcloud uses **https://cloud.forge-flow.de** and a separate Docker Compose installation.
Create an IONOS **A record `cloud` → `185.56.150.178`** first; remove an incorrect AAAA record
for that subdomain. The installer requires the existing Nginx/Certbot setup, Ubuntu
22.04/24.04/26.04/26.10, at least 2 GiB RAM, 10 GiB free disk space and local port 8081.
It installs Docker if needed and uses separate persistent Nextcloud, PostgreSQL and Redis data.

From Windows PowerShell:

```powershell
scp scripts/install-linux-nextcloud.sh scripts/backup-linux-nextcloud.sh `
  scripts/test-linux-nextcloud.sh dreinerts@185.56.150.178:
ssh dreinerts@185.56.150.178
```

Then on Ubuntu, after DNS resolves to the expected IP:

```bash
getent ahostsv4 cloud.forge-flow.de
bash ~/test-linux-nextcloud.sh
sudo bash ~/install-linux-nextcloud.sh cloud.forge-flow.de 185.56.150.178 --check
sudo bash ~/install-linux-nextcloud.sh cloud.forge-flow.de 185.56.150.178
```

`--check` does not install anything. Wait for **Nextcloud ready** before signing in as
**`forgeflow-admin`**. Read the generated initial password on Ubuntu:

```bash
sudo cat /opt/forgeflow-nextcloud/secrets/admin-password
```

ForgeFlow, customer portal and Nextcloud accounts are separate; SSO is not configured.
The password file retains the initial value after a password change. Nextcloud needs its
own backups; ForgeFlow backups do not include its Docker volumes.
[DNS troubleshooting, CLI password reset and backups](docs/nextcloud.md).

## 9. Optional AI Configuration

The assistant is disabled by default. Enable it only in the backend environment with
`AI_ENABLED=true`, `OPENAI_API_KEY` and an explicit `AI_MODEL`; never put the key in the frontend.
[Configuration and limits](docs/ai-assistant.md).

## 10. Optional Developer Integrations

Snippeter AI generation uses the same backend AI configuration. PostgreSQL connections and
GitHub access additionally require a persistent encryption key and Git on the Ubuntu server.
Before deploying this release, run from Windows PowerShell:

```powershell
scp scripts/configure-linux-developer.py scripts/test-linux-developer.py dreinerts@185.56.150.178:
ssh -t dreinerts@185.56.150.178 'python3 ~/test-linux-developer.py && sudo python3 ~/configure-linux-developer.py'
```

The helper preserves existing settings, installs Git if needed, adds `INTEGRATION_SECRET_KEY`
to the private backend environment and creates `/var/lib/forgeflow/git` for the service account.
It does not restart ForgeFlow. Then deploy the complete application using section 7.
Back up this key privately with the database; do not regenerate it during updates.

Database targets are PostgreSQL only and limited to `DEV_DB_HOSTS` (default: loopback).
Enter a separate target database role in the application. GitHub needs a Personal Access Token
with read access to Metadata and Contents for the selected repositories. Clones are stored
on the Ubuntu server and need a separate file backup.

Test-account registration is enabled by default. Set `TRIAL_ACCOUNTS_ENABLED=false` in
`/etc/forgeflow/backend.env` and restart to disable it. Test accounts expire after six hours;
the running backend purges their live data on its next cleanup cycle.
Migration V14 requires the matching backend: do not downgrade only the JAR after this update.
[Configuration, limits and verification](docs/developer-tools.md).
