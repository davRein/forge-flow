. (Join-Path $PSScriptRoot 'local-common.ps1')
$testRoot = Join-Path $script:LocalProjectRoot ('node_modules/.tmp/local-script-tests/' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
$passed = 0
function Assert-Check([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}
function Assert-Fails([scriptblock]$Operation, [string]$MessagePattern) {
    $failed = $false
    try { & $Operation | Out-Null } catch {
        if ($_.Exception.Message -notmatch $MessagePattern) { throw }
        $failed = $true
    }
    Assert-Check $failed 'Ein erwarteter Fehler blieb aus.'
}
Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.ps1' -File | ForEach-Object {
    $tokens = $null; $parseErrors = $null
    [void][Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$tokens, [ref]$parseErrors)
    Assert-Check (-not $parseErrors) ('Skript ist syntaktisch ungültig: ' + $_.Name)
}
$passed++

$settings = @{ Version = 1; DatabaseHost = '127.0.0.1'; DatabasePort = 5432; DatabaseName = 'forgeflow_test'; DatabaseUser = 'forgeflow'; PostgresBin = 'D:\Program Files\PostgreSQL\18\bin'; BackupOnStart = $true; SecretFile = ('database-secret-' + [Guid]::NewGuid().ToString('N') + '.xml') }
$settings | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $testRoot 'config.json') -Encoding UTF8
$fixture = 'Nur-ein-Testgeheimnis-2026'
ConvertTo-SecureString -String $fixture -AsPlainText -Force | Export-Clixml -LiteralPath (Join-Path $testRoot $settings.SecretFile)
$secret = Get-LocalDatabasePassword -ConfigRoot $testRoot
Assert-Check ([Net.NetworkCredential]::new('', $secret).Password -ceq $fixture) 'DPAPI-Roundtrip fehlgeschlagen.'
Assert-Check (-not ([IO.File]::ReadAllText((Join-Path $testRoot $settings.SecretFile)).Contains($fixture))) 'Testgeheimnis steht im Klartext in der Datei.'
$originalSecret = $settings.SecretFile
$settings.SecretFile = '../../outside.xml'
$settings | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $testRoot 'config.json') -Encoding UTF8
Assert-Fails { Get-LocalDatabasePassword -ConfigRoot $testRoot } 'Geheimnisverweis'
$settings.SecretFile = $originalSecret
$settings | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $testRoot 'config.json') -Encoding UTF8
$passed++

$null = Get-LocalConfiguration -ConfigRoot $testRoot
$settings.DatabaseHost = 'example.invalid'
$settings | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $testRoot 'config.json') -Encoding UTF8
Assert-Fails { Get-LocalConfiguration -ConfigRoot $testRoot } 'Ungültige lokale'
$passed++

$archive = Join-Path $testRoot 'fixture.dump'
[IO.File]::WriteAllText($archive, 'integrity-fixture')
[IO.File]::WriteAllText($archive + '.sha256', (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash)
Assert-Check ((Assert-LocalBackup $archive) -eq $archive) 'Die Prüfsumme wurde nicht akzeptiert.'
[IO.File]::AppendAllText($archive, 'corrupted')
Assert-Fails { Assert-LocalBackup $archive } 'SHA256'
$passed++

Assert-Fails { & (Join-Path $PSScriptRoot 'restore-local.ps1') -BackupFile $archive -Database 'forgeflow' } 'NEUE Datenbank'
Assert-Fails { & (Join-Path $PSScriptRoot 'restore-local.ps1') -BackupFile $archive -Database 'forgeflow_test' } 'NEUE Datenbank'
Assert-Fails { & (Join-Path $PSScriptRoot 'restore-local.ps1') -BackupFile $archive -Database 'forgeflow_restore_x;drop_database' } 'NEUE Datenbank'
$passed++
# A stale Vite server can occupy IPv6 localhost while a second server binds IPv4.
# Verify both address families with actual listeners on temporary ports.
foreach ($address in @([Net.IPAddress]::Loopback, [Net.IPAddress]::IPv6Loopback)) {
    if ($address.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetworkV6 -and -not [Net.Sockets.Socket]::OSSupportsIPv6) { continue }
    $listener = [Net.Sockets.TcpListener]::new($address, 0)
    try {
        $listener.Start()
        $testPort = $listener.LocalEndpoint.Port
        Assert-Fails { Assert-LocalPortFree -Port $testPort } 'bereits belegt'
    } finally { $listener.Stop() }
    Assert-LocalPortFree -Port $testPort
}
$passed++
Write-Output "$passed Prüfgruppen erfolgreich: Syntax, DPAPI, lokale Zielkonfiguration, Backup-Integrität, Wiederherstellungsschutz und IPv4/IPv6-Portprüfung."
Write-Output 'Ein echter Dump-/Restore-Test benötigt die lokale Datenbankeinrichtung und das Administratorkennwort.'
