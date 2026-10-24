Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:LocalProjectRoot = Split-Path -Parent $PSScriptRoot
$script:LocalConfigRoot = Join-Path $script:LocalProjectRoot 'backend/.local'

function Assert-LocalPortFree {
    param([ValidateRange(1, 65535)][int]$Port)
    foreach ($address in @([Net.IPAddress]::Loopback, [Net.IPAddress]::IPv6Loopback)) {
        if ($address.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetworkV6 -and -not [Net.Sockets.Socket]::OSSupportsIPv6) { continue }
        $client = [Net.Sockets.TcpClient]::new($address.AddressFamily)
        try {
            $pending = $client.BeginConnect($address, $Port, $null, $null)
            if ($pending.AsyncWaitHandle.WaitOne(500) -and $client.Connected) {
                throw "Port $Port ($address) ist bereits belegt. Den bisherigen Entwicklungsserver zuerst stoppen."
            }
        } finally { $client.Dispose() }
    }
}

function Get-LocalConfiguration {
    param([string]$ConfigRoot = $script:LocalConfigRoot)
    $path = Join-Path $ConfigRoot 'config.json'
    if (-not (Test-Path -LiteralPath $path)) { throw 'Zuerst scripts/configure-local.ps1 ausführen.' }
    $settings = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($settings.Version -ne 1 -or $settings.DatabaseHost -notin @('127.0.0.1', 'localhost') -or
            $settings.DatabaseName -notmatch '^[a-z][a-z0-9_]{0,62}$' -or
            $settings.DatabaseUser -notmatch '^[a-z][a-z0-9_]{0,62}$' -or
            $settings.DatabasePort -lt 1 -or $settings.DatabasePort -gt 65535) {
        throw 'Ungültige lokale Konfiguration. configure-local.ps1 erneut ausführen.'
    }
    return $settings
}

function Get-LocalDatabasePassword {
    param([string]$ConfigRoot = $script:LocalConfigRoot)
    $settings = Get-LocalConfiguration -ConfigRoot $ConfigRoot
    $filename = if ($settings.PSObject.Properties.Name -contains 'SecretFile') { $settings.SecretFile } else { 'database-secret.xml' }
    if ($filename -ne 'database-secret.xml' -and $filename -notmatch '^database-secret-[a-f0-9]{32}\.xml$') { throw 'Ungültiger lokaler Geheimnisverweis.' }
    $path = Join-Path $ConfigRoot $filename
    if (-not (Test-Path -LiteralPath $path)) { throw 'Das lokal verschlüsselte Datenbankpasswort fehlt. configure-local.ps1 ausführen.' }
    try {
        $secret = Import-Clixml -LiteralPath $path
        if ($secret -isnot [System.Security.SecureString]) { throw 'Ungültiges Format.' }
        return $secret
    } catch {
        throw 'Das Passwort kann nur vom Windows-Benutzer auf dem PC der Einrichtung entschlüsselt werden. configure-local.ps1 erneut ausführen.'
    }
}

function Get-PostgresArguments {
    param($Settings, [string]$Database = $Settings.DatabaseName, [string]$User = $Settings.DatabaseUser)
    return @('--host', $Settings.DatabaseHost, '--port', [string]$Settings.DatabasePort, '--username', $User, '--no-password', '--dbname', $Database)
}

function Invoke-PostgresTool {
    param($Settings, [string]$Tool, [string[]]$Arguments, [System.Security.SecureString]$Password)
    $executable = Join-Path $Settings.PostgresBin ($Tool + '.exe')
    if (-not (Test-Path -LiteralPath $executable)) { throw "PostgreSQL-Werkzeug fehlt: $executable" }
    $previousPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD', 'Process')
    $previousTimeout = [Environment]::GetEnvironmentVariable('PGCONNECT_TIMEOUT', 'Process')
    $previousPreference = $ErrorActionPreference
    try {
        $env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $Password).Password
        $env:PGCONNECT_TIMEOUT = '10'
        $ErrorActionPreference = 'Continue'
        $output = @(& $executable @Arguments 2>&1)
        $commandExit = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'
        if ($commandExit -ne 0) {
            throw ("PostgreSQL-Werkzeug {0} fehlgeschlagen (Exit {1}): {2}" -f $Tool, $commandExit, ($output -join [Environment]::NewLine))
        }
        return ($output -join [Environment]::NewLine)
    } finally {
        $ErrorActionPreference = $previousPreference
        [Environment]::SetEnvironmentVariable('PGPASSWORD', $previousPassword, 'Process')
        [Environment]::SetEnvironmentVariable('PGCONNECT_TIMEOUT', $previousTimeout, 'Process')
    }
}

function Find-LocalMaven {
    $command = Get-Command mvn.cmd -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $portable = Join-Path $script:LocalProjectRoot 'node_modules/.tmp/backend-tools/apache-maven-3.9.11/bin/mvn.cmd'
    if (Test-Path -LiteralPath $portable) { return $portable }
    throw 'Maven fehlt. Maven 3.9 einrichten oder scripts/verify-backend.ps1 ausführen.'
}

function Set-LocalJava {
    if ($env:JAVA_HOME -and (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin/javac.exe'))) { return }
    $portable = Join-Path $script:LocalProjectRoot 'node_modules/.tmp/backend-tools/jdk'
    $jdk = Get-ChildItem -LiteralPath $portable -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bin/javac.exe') } | Select-Object -First 1
    if ($jdk) { $env:JAVA_HOME = $jdk.FullName; return }
    $compiler = Get-Command javac.exe -ErrorAction SilentlyContinue
    if ($compiler) { $env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent $compiler.Source); return }
    throw 'JDK 21 fehlt. JAVA_HOME setzen oder scripts/verify-backend.ps1 ausführen.'
}

function Find-LocalNodeDirectory {
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($command) { return Split-Path -Parent $command.Source }
    foreach ($path in @('C:\nvm4w\nodejs', 'C:\Program Files\nodejs')) {
        if (Test-Path -LiteralPath (Join-Path $path 'node.exe')) { return $path }
    }
    throw 'Node.js/npm fehlen im PATH.'
}

function Assert-LocalBackup {
    param([string]$Path)
    $archive = Get-Item -LiteralPath $Path
    if ($archive.PSIsContainer -or $archive.Extension -ne '.dump') { throw 'Eine .dump-Datei auswählen.' }
    $hashPath = $archive.FullName + '.sha256'
    if (-not (Test-Path -LiteralPath $hashPath)) { throw 'SHA256-Datei fehlt. Nur mit backup-local.ps1 erstellte Sicherungen verwenden.' }
    $expected = (Get-Content -LiteralPath $hashPath -Raw).Trim()
    $actual = (Get-FileHash -LiteralPath $archive.FullName -Algorithm SHA256).Hash
    if ($expected -notmatch '^[0-9A-Fa-f]{64}$' -or $expected -ne $actual) { throw 'Die Sicherung ist beschädigt: SHA256 stimmt nicht überein.' }
    return $archive.FullName
}
