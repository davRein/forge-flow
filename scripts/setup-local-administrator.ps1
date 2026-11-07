param([string]$StatusFile)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-common.ps1')
$settings = Get-LocalConfiguration
$secret = Get-LocalDatabasePassword
$jar = Join-Path $script:LocalProjectRoot 'backend/target/backend-0.1.0-SNAPSHOT.jar'
if (-not (Test-Path -LiteralPath $jar -PathType Leaf)) { throw 'Zuerst das aktuelle Backend bauen (scripts/verify-backend.ps1).' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($jar)
try { if (-not $archive.GetEntry('BOOT-INF/classes/de/forgeflow/admin/SetupAdministrator.class')) { throw 'Das Backend-JAR enthaelt die neue Kontoverwaltung noch nicht. Bitte zuerst neu bauen.' } }
finally { $archive.Dispose() }
# A verified backup must precede migrations or account insertion.
$backup = & (Join-Path $PSScriptRoot 'backup-local.ps1')
Write-Host 'Gepruefte Datenbanksicherung wurde erstellt.'
$names = @('JAVA_HOME', 'FORGEFLOW_ADMIN_DB_URL', 'FORGEFLOW_ADMIN_DB_USER', 'FORGEFLOW_ADMIN_DB_PASSWORD', 'FORGEFLOW_ADMIN_STATUS_FILE')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    Set-LocalJava
    $env:FORGEFLOW_ADMIN_DB_URL = 'jdbc:postgresql://' + $settings.DatabaseHost + ':' + $settings.DatabasePort + '/' + $settings.DatabaseName
    $env:FORGEFLOW_ADMIN_DB_USER = $settings.DatabaseUser
    $env:FORGEFLOW_ADMIN_DB_PASSWORD = [Net.NetworkCredential]::new('', $secret).Password
    $env:FORGEFLOW_ADMIN_STATUS_FILE = $StatusFile
    & (Join-Path $env:JAVA_HOME 'bin/java.exe') '-Dloader.main=de.forgeflow.admin.SetupAdministrator' -cp $jar org.springframework.boot.loader.launch.PropertiesLauncher
    if ($LASTEXITCODE -ne 0) { throw 'Administrator-Einrichtung wurde nicht abgeschlossen. Bestehende Konten wurden nicht ersetzt.' }
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
