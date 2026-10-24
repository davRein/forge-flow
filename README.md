# Dev Suite – Installation and Setup

These steps cover local installation on Windows using PowerShell.
Run all project commands from the repository root, `D:\Projects\Vite\dev-suite`.
Skip any steps that have already been completed.

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
```

Do not put database passwords or password hashes in this file.

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
For subsequent starts, run `npm.cmd run start:local`. Run setup again after changing the database password.

`COOKIE_SECURE=false` is intended for local HTTP development. The startup scripts require Windows;
for direct backend configuration, see [backend/README.md](backend/README.md).
For local configuration and backup details, see [docs/local-operation.md](docs/local-operation.md).

## 6. Configure Shared Customer Industries

Sign in as an administrator and open **Settings → Global settings → Customer industries**.
Review the initial industry list and save your choices. This list is shared by all users.
Flyway applies the customer postal-code and shared-settings migration automatically when
the updated backend starts; no manual SQL setup is needed.
