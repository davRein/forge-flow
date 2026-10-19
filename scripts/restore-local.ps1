param(
    [Parameter(Mandatory = $true)][string]$BackupFile,
    [string]$Database = ('forgeflow_restore_' + [DateTime]::UtcNow.ToString('yyyyMMdd_HHmmss') + '_' + [Guid]::NewGuid().ToString('N').Substring(0, 8)),
    [ValidatePattern('^[a-z][a-z0-9_]{0,62}$')][string]$AdminUser = 'postgres',
    [switch]$Verify
)
. (Join-Path $PSScriptRoot 'local-common.ps1')
# Validate before requesting any credentials or opening a database connection.
if ($Database -notmatch '^forgeflow_restore_[a-z0-9_]{1,44}$') {
    throw 'Wiederherstellung ist ausschließlich in eine NEUE Datenbank mit Präfix forgeflow_restore_ erlaubt.'
}
$archive = Assert-LocalBackup $BackupFile
$settings = Get-LocalConfiguration
if ($Database -eq $settings.DatabaseName) { throw 'Die Anwendungsdatenbank darf nicht überschrieben werden.' }
$secret = Get-LocalDatabasePassword
$adminSecret = Read-Host "PostgreSQL-Administratorkennwort für $AdminUser (wird nicht gespeichert)" -AsSecureString
$created = $false
$completed = $false
try {
    $arguments = @(Get-PostgresArguments $settings 'postgres' $AdminUser) + @('--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--command', "SELECT 1 FROM pg_database WHERE datname = '$Database'")
    $exists = Invoke-PostgresTool $settings 'psql' $arguments $adminSecret
    if ($exists.Trim()) { throw 'Die Zieldatenbank existiert bereits. Einen neuen Namen verwenden.' }
    $createArguments = @('--host', $settings.DatabaseHost, '--port', [string]$settings.DatabasePort, '--username', $AdminUser,
        '--no-password', '--maintenance-db=postgres', '--template=template0', '--owner', $settings.DatabaseUser, $Database)
    $null = Invoke-PostgresTool $settings 'createdb' $createArguments $adminSecret
    $created = $true

    $restoreArguments = @(Get-PostgresArguments $settings $Database) + @('--no-owner', '--no-privileges', '--exit-on-error', '--single-transaction', $archive)
    $null = Invoke-PostgresTool $settings 'pg_restore' $restoreArguments $secret
    $query = "SELECT 'accounts=' || (SELECT count(*) FROM ff_accounts) || ', projects=' || (SELECT count(*) FROM ff_projects) || ', files=' || (SELECT count(*) FROM ff_files); SELECT count(*) FROM ff_files WHERE size <> octet_length(content); SELECT count(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND NOT convalidated; SELECT count(*) FROM flyway_schema_history WHERE NOT success;"
    $checkArguments = @(Get-PostgresArguments $settings $Database) + @('--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--command', $query)
    $result = Invoke-PostgresTool $settings 'psql' $checkArguments $secret
    $lines = @($result -split '\r?\n' | Where-Object { $_.Trim() })
    if ($lines.Count -ne 4 -or $lines[1].Trim() -ne '0' -or $lines[2].Trim() -ne '0' -or $lines[3].Trim() -ne '0') {
        throw 'Die wiederhergestellten Dateigrößen, Beziehungen oder Migrationen sind ungültig.'
    }
    $completed = $true
    Write-Output "Wiederherstellung geprüft: $Database; $($lines[0])"
    if (-not $Verify) { Write-Output 'Die Kopie bleibt erhalten. Die Anwendung wurde nicht auf die Kopie umgestellt.' }
} finally {
    # Only this invocation's newly created copy may be removed. Existing DBs are never dropped.
    if ($created -and $Verify) {
        $dropArguments = @('--host', $settings.DatabaseHost, '--port', [string]$settings.DatabasePort,
            '--username', $AdminUser, '--no-password', '--maintenance-db=postgres', $Database)
        $null = Invoke-PostgresTool $settings 'dropdb' $dropArguments $adminSecret
        Write-Output 'Die in diesem Prüflauf erstellte Wiederherstellungskopie wurde entfernt.'
    } elseif ($created -and -not $completed) {
        Write-Warning "Die unvollständige Wiederherstellungskopie $Database bleibt zur Untersuchung erhalten. Die Anwendungsdatenbank ist unverändert."
    }
}

