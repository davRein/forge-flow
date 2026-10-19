param(
    [string]$DatabaseName = 'forgeflow',
    [string]$DatabaseUser = 'forgeflow',
    [ValidateRange(1, 65535)][int]$DatabasePort = 5432,
    [string]$PostgresBin,
    [string]$BootstrapUserId,
    [switch]$NoBackupOnStart
)
. (Join-Path $PSScriptRoot 'local-common.ps1')
if ([Environment]::OSVersion.Platform -ne 'Win32NT') { throw 'Diese Einrichtung verwendet Windows-DPAPI. Unter Linux Prozessvariablen verwenden.' }
if ($DatabaseName -notmatch '^[a-z][a-z0-9_]{0,62}$' -or $DatabaseUser -notmatch '^[a-z][a-z0-9_]{0,62}$') { throw 'Ungültiger Datenbank- oder Benutzername.' }
if (-not $PostgresBin) {
    $psql = Get-Command psql.exe -ErrorAction SilentlyContinue
    if ($psql) { $PostgresBin = Split-Path -Parent $psql.Source }
    else {
        $PostgresBin = @('D:\Program Files\PostgreSQL\18\bin', 'C:\Program Files\PostgreSQL\18\bin') |
            Where-Object { Test-Path -LiteralPath (Join-Path $_ 'psql.exe') } | Select-Object -First 1
    }
}
if (-not $PostgresBin) { throw 'PostgreSQL nicht gefunden. -PostgresBin mit dem bin-Verzeichnis angeben.' }
if ([string]::IsNullOrWhiteSpace($BootstrapUserId)) {
    $BootstrapUserId = if ($env:AUTH_USER_ID) { $env:AUTH_USER_ID } else { 'initial-admin' }
}
if ([string]::IsNullOrWhiteSpace($BootstrapUserId) -or $BootstrapUserId.Length -gt 128) { throw 'Ungültige Kennung des bisherigen Anwendungskontos.' }
$settings = [pscustomobject]@{
    Version = 1
    DatabaseHost = '127.0.0.1'
    DatabasePort = $DatabasePort
    DatabaseName = $DatabaseName
    DatabaseUser = $DatabaseUser
    PostgresBin = [IO.Path]::GetFullPath($PostgresBin)
    BackupOnStart = -not $NoBackupOnStart
    SecretFile = ('database-secret-' + [Guid]::NewGuid().ToString('N') + '.xml')
    BootstrapUserId = $BootstrapUserId
}
if ($env:DB_PASSWORD) { $secret = ConvertTo-SecureString -String $env:DB_PASSWORD -AsPlainText -Force }
else { $secret = Read-Host "Datenbankpasswort für $DatabaseUser (wird lokal verschlüsselt gespeichert)" -AsSecureString }
$arguments = @(Get-PostgresArguments $settings) + @('--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--command', 'SELECT 1')
$null = Invoke-PostgresTool $settings 'psql' $arguments $secret

New-Item -ItemType Directory -Path $script:LocalConfigRoot -Force | Out-Null
$secretPath = Join-Path $script:LocalConfigRoot $settings.SecretFile
$secret | Export-Clixml -LiteralPath ($secretPath + '.tmp')
Move-Item -LiteralPath ($secretPath + '.tmp') -Destination $secretPath -Force
$configPath = Join-Path $script:LocalConfigRoot 'config.json'
[IO.File]::WriteAllText($configPath + '.tmp', ($settings | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
# Publish the settings only after their encrypted secret is complete. Old settings keep
# referring to their old secret if setup is interrupted before this move.
Move-Item -LiteralPath ($configPath + '.tmp') -Destination $configPath -Force
Write-Output 'Verbindung geprüft und lokale Konfiguration eingerichtet. Keine Zugangsdaten wurden ausgegeben.'
Write-Output 'Start: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1'
