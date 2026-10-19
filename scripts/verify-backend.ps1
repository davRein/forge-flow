$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsRoot = Join-Path $projectRoot 'node_modules/.tmp/backend-tools'
New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null

# Isolated build tools: no system installation or permanent PATH changes.
$jdkRoot = Join-Path $toolsRoot 'jdk'
$jdk = Get-ChildItem -LiteralPath $jdkRoot -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bin/javac.exe') } | Select-Object -First 1
if (-not $jdk) {
    $assets = Invoke-RestMethod -Uri 'https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse'
    $package = $assets[0].binary.package
    $archive = Join-Path $toolsRoot 'jdk.zip'
    Invoke-WebRequest -UseBasicParsing -Uri $package.link -OutFile $archive
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $package.checksum.ToLowerInvariant()) { throw 'Die JDK-Prüfsumme stimmt nicht überein.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $jdkRoot -Force
    $jdk = Get-ChildItem -LiteralPath $jdkRoot -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bin/javac.exe') } | Select-Object -First 1
}
if (-not $jdk) { throw 'Das JDK konnte nicht eingerichtet werden.' }
$mavenRoot = Join-Path $toolsRoot 'apache-maven-3.9.11'
$maven = Join-Path $mavenRoot 'bin/mvn.cmd'
if (-not (Test-Path -LiteralPath $maven)) {
    $mavenUrl = 'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.zip'
    $archive = Join-Path $toolsRoot 'maven.zip'
    Invoke-WebRequest -UseBasicParsing -Uri $mavenUrl -OutFile $archive
    $checksum = ((Invoke-WebRequest -UseBasicParsing -Uri ($mavenUrl + '.sha512')).Content.Trim() -split '\s+')[0]
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA512).Hash.ToLowerInvariant() -ne $checksum.ToLowerInvariant()) { throw 'Die Maven-Prüfsumme stimmt nicht überein.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $toolsRoot -Force
}
$env:JAVA_HOME = $jdk.FullName
& $maven --batch-mode --no-transfer-progress -f (Join-Path $projectRoot 'backend/pom.xml') "-Dmaven.repo.local=$toolsRoot/m2" '-Dlogging.level.root=WARN' '-Dlogging.level.org.springframework=WARN' test
if ($LASTEXITCODE -ne 0) { throw 'Die Spring-Boot-Tests sind fehlgeschlagen.' }
