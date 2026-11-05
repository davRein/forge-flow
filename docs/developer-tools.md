# Developer tools and global settings

The header gear beside global search opens **Settings** at `#/settings/general`.
Profile/password, account management, appearance, language, Project Manager defaults and
shared customer industries remain available there. Settings no longer belong to the Project
Manager tabs. Old `#/projectManager/settings` links redirect to the global menu, preserving
the selected settings category. Git appears immediately below Project Manager in the sidebar.

## Test accounts

The login screen offers **Create a 6-hour test account**. Supply your own email and a password
of at least 12 characters and at most 72 UTF-8 bytes. Registration creates an empty private
workspace and signs in immediately; it grants neither administrator nor customer-portal rights.
It does not send email or create Nextcloud/GitHub/database accounts.

The server stores an absolute expiry time. Changing profile/password, logging in again or
restarting the application does not extend it. Requests are rejected once six hours have elapsed.
The browser checks the session at expiry and on focus. A scheduled cleanup removes expired
accounts, their workspace, attachments, documentation, settings, history, time/business data,
REST collections, snippets and AI conversations/executions every 30 seconds while running;
after downtime it resumes at startup. PostgreSQL deletion is transactional. Memory adapters
reject late writes that could recreate erased data. The cleanup removes live application data;
existing administrator backups retain their original retention policy.

Trial registration is limited to 3 attempts per client IP per 15 minutes, 30 active accounts
globally and 20 AI generation/message attempts per trial lifetime. Existing AI concurrency/rate
limits also apply. Trials cannot create users or portal accounts, connect external databases,
execute SQL, store GitHub tokens or clone repositories. Set `TRIAL_ACCOUNTS_ENABLED=false`
in the backend environment and restart to disable new trial registration. Existing trials retain
their expiry. There is no email verification or CAPTCHA in this implementation.

## Snippeter

Under **Dev Tools → Snippeter**, choose a programming language, enter a title and instructions,
then generate code using the existing backend AI configuration. Code remains editable and is
shown in a lexical syntax preview. Source is rendered as text, never interpreted as HTML.
Save explicitly to keep a private snippet; saved entries can be reopened, edited or deleted.
Generation does not save or execute source. Review generated code before using it; truncated
answers are marked. Changing pages with an unsaved draft asks whether to stay or discard.

PostgreSQL stores snippets across sessions and restarts. The memory backend is temporary.
Without a backend (`VITE_DATA_MODE=local`), manually written snippets can be saved only for
the current browser session; AI and external integrations are unavailable. API errors never
fall back to demonstration data. Conflicts require manual reload, protected by the draft guard.

## DB Scripter

The first supported engine is **PostgreSQL**. Connections belong to the signed-in regular user;
the application does not reuse ForgeFlow's configured database credentials. Enter host, port,
database, username, password and TLS mode explicitly. Edit with an empty password to retain
the saved value. Test a saved connection before use. `require` encrypts transport; `verify-full`
also verifies the server identity using the JVM trust configuration. Use `disable` only for
loopback/local connections where appropriate.

Only exact hosts listed in the backend `DEV_DB_HOSTS` setting can be contacted; the default
is `127.0.0.1,localhost,::1`. Remote access requires an explicit administrator configuration
change. The target database role defines the available privileges: this tool is not a SQL
sandbox. Use a separate role with the minimum required rights, rather than a superuser.

Choose a saved connection and write SQL or ask AI to generate it from your description. Only
the instructions and PostgreSQL dialect are sent to the AI provider: credentials, schema and
query results are not automatically sent. Schema knowledge must be supplied deliberately in
the instructions if needed. SQL scripts use the same private save/reopen workflow as snippets.

**Review execution** prepares a confirmation without executing anything. The dialog displays
the exact SQL, target database/host/user and read-only/write mode. **Execute now** sends a
single-use ticket bound to that account, session version, SQL and connection snapshot, valid
for two minutes. The UI defaults to read-only. Generating, saving or cancelling never executes
SQL. Changed credentials invalidate prepared confirmations.

Executions run in one explicit transaction with rollback on error, query timeout 15 seconds,
lock timeout 3 seconds and at most two concurrent executions. Transaction/session control
statements are rejected, while quoted procedural bodies are supported. At most 20 top-level
statements/results, 50 columns, 200 displayed rows per result, 4000 characters per value and
one million returned characters are allowed. Database failures expose a sanitized SQLSTATE,
without raw SQL, connection strings or credentials. A network failure around commit can leave
the outcome unknown: inspect the target database before retrying; execution is never retried
automatically. Displayed results are transient and are not saved with scripts.

## GitHub and server clones

Under **Git**, connect a GitHub Personal Access Token. A fine-grained token needs read access
to Metadata and Contents for each desired repository; organization approval/SSO requirements
still apply. **Load repositories** lists accessible repositories in pages of 50. The interface
does not load or clone automatically; use **Next** to continue through available pages.

**Clone** asks for confirmation, then creates a shallow HTTPS clone without submodules in a
private account directory below `DEV_GIT_ROOT`. The target is the Ubuntu server, not the
browser's Windows PC. No repository code is executed. Tokens are passed in process environment
configuration, never in command arguments, remote URLs, logs or persisted Git configuration.
Git helpers, hooks, templates, file protocol and redirects are disabled for this operation.

Limits: 20 repository entries per account, GitHub-reported size at most 100 MiB, at least
512 MiB free disk before starting, 45-second process timeout, 2 concurrent clones globally,
10 clone attempts per account/15 minutes. Reported size/free-space checks are not disk quotas;
administrators should monitor server usage. Existing paths are never overwritten. There is
no pull/push, branch management, local-PC clone, repository editor or automatic cleanup of
permanent-account clones yet. Disconnecting removes the encrypted token and keeps clones.
Interrupted jobs are displayed as failed after two minutes; reload metadata before retrying.

## Server setup

Run the helper once before deploying this release:

```powershell
scp scripts/configure-linux-developer.py scripts/test-linux-developer.py dreinerts@185.56.150.178:
ssh -t dreinerts@185.56.150.178 'python3 ~/test-linux-developer.py && sudo python3 ~/configure-linux-developer.py'
```

It installs Git if absent, adds a random 32-byte Base64 `INTEGRATION_SECRET_KEY` to the existing
root-owned `/etc/forgeflow/backend.env`, creates `/var/lib/forgeflow/git` owned by `forgeflow`
with mode 0700, and sets default host/trial values. Existing keys, AI settings and other values
are preserved. Changes are atomic, the previous environment is backed up privately, and no
secret is printed. The helper does not restart the application or contact GitHub/OpenAI.
It uses `/var/lib/forgeflow/...` only; custom existing Git paths must be reviewed manually.

Back up the environment key privately alongside the database and Git directory. A database
backup alone cannot decrypt saved integration credentials. Do not rotate/delete the key when
updating; changing it makes existing encrypted credentials unreadable. Restore tests should
include both database and key. Git directories are **not** in the existing database/frontend
update backups and require a separate private file backup if they must be preserved.

Then deploy with the existing [Ubuntu update instructions](linux-server.md). Migration V14
adds account expiry and private developer storage. Keep the matching backend/frontend package;
older backends do not enforce the trial expiry and must not be run against this migrated data.
Use the pre-update database backup for a controlled full rollback rather than downgrading only
the JAR.

## Manual verification after deployment

1. Reload with Ctrl+F5. Confirm Project Manager has no Settings tab and the header gear opens
   all existing settings. Test the old settings URL and a category deep link.
2. Generate or type a snippet, change its language, inspect the preview, save, reopen and verify
   persistence after login/backend restart. Leave an unsaved edit: Stay preserves it; Discard
   resets it. Repeat for SQL and a partially entered GitHub token.
3. Using a disposable PostgreSQL database/least-privilege role, save and test a connection.
   Review SQL and cancel: no query runs. Confirm a SELECT; verify displayed rows. Try a write
   with read-only selected; verify rejection. Confirm an intended write explicitly and inspect
   the target. Check rollback for a deliberately failing script in that disposable database.
4. Connect a restricted token, page through repositories, cancel a clone and then confirm a
   small disposable repository clone. Check the private path and unchanged remote repository.
   Disconnect and confirm the token is removed while clones remain.
5. Register a test account with a unique email. Verify no admin/portal/DB/Git privileges, an
   empty isolated workspace and expiry time in the header. At six hours access stops; within
   the following cleanup cycle the live account and owned rows disappear. Do not shorten
   production accounts' expiry directly for testing.

Automated coverage is described in `HANDOFF.md`; a real GitHub clone/provider generation is a
separate opt-in check with the user's token/API costs and was not performed automatically.
