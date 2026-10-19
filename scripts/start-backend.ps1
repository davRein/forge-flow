param([switch]$SkipBackup)
. (Join-Path $PSScriptRoot 'local-common.ps1')
$settings = Get-LocalConfiguration
$secret = Get-LocalDatabasePassword
if ($settings.BackupOnStart -and -not $SkipBackup) {
    Write-Output 'Prüfe tägliche Datenbanksicherung ...'
    & (Join-Path $PSScriptRoot 'backup-local.ps1') -IfOlderThanHours 24
}
$names = @('JAVA_HOME', 'DB_URL', 'DB_USER', 'DB_PASSWORD', 'SPRING_PROFILES_ACTIVE', 'APP_ORIGIN', 'COOKIE_SECURE',
    'AUTH_USER_ID', 'AUTH_USER_EMAIL', 'AUTH_PASSWORD_HASH', 'PORT')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$locationBefore = Get-Location
try {
    Set-LocalJava
    $maven = Find-LocalMaven
    $env:SPRING_PROFILES_ACTIVE = 'postgres'
    $env:DB_URL = 'jdbc:postgresql://' + $settings.DatabaseHost + ':' + $settings.DatabasePort + '/' + $settings.DatabaseName
    $env:DB_USER = $settings.DatabaseUser
    $env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
    $env:APP_ORIGIN = 'http://localhost:5173'
    $env:COOKIE_SECURE = 'false'
    $env:PORT = '3001'
    if ($settings.PSObject.Properties.Name -contains 'BootstrapUserId') { $env:AUTH_USER_ID = $settings.BootstrapUserId }
    # Normal starts use the provisioned database accounts, including later profile changes.
    Remove-Item Env:AUTH_USER_EMAIL, Env:AUTH_PASSWORD_HASH -ErrorAction SilentlyContinue
    Set-Location -LiteralPath $script:LocalProjectRoot
    & $maven -f backend/pom.xml spring-boot:run
    if ($LASTEXITCODE -ne 0) { throw "Backend beendet (Exit $LASTEXITCODE)." }
} finally {
    Set-Location -LiteralPath $locationBefore.Path
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
