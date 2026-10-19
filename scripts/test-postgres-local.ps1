. (Join-Path $PSScriptRoot 'local-common.ps1')
$settings = Get-LocalConfiguration
$database = $settings.DatabaseName + '_test'
if ($database.Length -gt 63 -or $database -eq $settings.DatabaseName) { throw 'Ungültiger Name der separaten Testdatenbank.' }
$secret = Get-LocalDatabasePassword
$arguments = @(Get-PostgresArguments $settings $database) + @('--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--tuples-only', '--no-align', '--command', 'SELECT current_database()')
$actual = Invoke-PostgresTool $settings 'psql' $arguments $secret
if ($actual.Trim() -cne $database) { throw 'Die Verbindung zeigt nicht auf die erwartete Testdatenbank.' }
$names = @('JAVA_HOME', 'TEST_POSTGRES_URL', 'TEST_POSTGRES_USER', 'TEST_POSTGRES_PASSWORD')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$locationBefore = Get-Location
try {
    Set-LocalJava
    $maven = Find-LocalMaven
    $env:TEST_POSTGRES_URL = 'jdbc:postgresql://' + $settings.DatabaseHost + ':' + $settings.DatabasePort + '/' + $database
    $env:TEST_POSTGRES_USER = $settings.DatabaseUser
    $env:TEST_POSTGRES_PASSWORD = [Net.NetworkCredential]::new('', $secret).Password
    Set-Location -LiteralPath $script:LocalProjectRoot
    Write-Output "Backend-Tests verwenden ausschließlich die separate Datenbank $database."
    & $maven -f backend/pom.xml test
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL-Tests fehlgeschlagen (Exit $LASTEXITCODE)." }
} finally {
    Set-Location -LiteralPath $locationBefore.Path
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
