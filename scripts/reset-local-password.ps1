param([switch]$CheckConnection)
. (Join-Path $PSScriptRoot 'local-common.ps1')
$settings = Get-LocalConfiguration
$secret = Get-LocalDatabasePassword
$previousJava = $env:JAVA_HOME
$names = @('FORGEFLOW_RESET_DB_URL', 'FORGEFLOW_RESET_DB_USER', 'FORGEFLOW_RESET_DB_PASSWORD')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    Set-LocalJava
    # Keep runtime dependencies separate from older compile-only classpath files.
    $classpathFile = Join-Path $script:LocalProjectRoot 'backend/target/password-reset-classpath.txt'
    if (-not (Test-Path -LiteralPath $classpathFile)) {
        $maven = Find-LocalMaven
        & $maven -f (Join-Path $script:LocalProjectRoot 'backend/pom.xml') dependency:build-classpath '-Dmdep.includeScope=runtime' '-Dmdep.outputFile=target/password-reset-classpath.txt'
        if ($LASTEXITCODE -ne 0) { throw 'Backend-Abhaengigkeiten konnten nicht vorbereitet werden.' }
    }
    $env:FORGEFLOW_RESET_DB_URL = 'jdbc:postgresql://' + $settings.DatabaseHost + ':' + $settings.DatabasePort + '/' + $settings.DatabaseName
    $env:FORGEFLOW_RESET_DB_USER = $settings.DatabaseUser
    $env:FORGEFLOW_RESET_DB_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
    $classpath = (Get-Content -LiteralPath $classpathFile -Raw -Encoding UTF8).Trim()
    $postgresDriver = @($classpath.Split(';') | Where-Object { $_ -match '[\\/]org[\\/]postgresql[\\/]postgresql[\\/].*\.jar$' -and (Test-Path -LiteralPath $_) })
    if ($postgresDriver.Count -ne 1) { throw 'PostgreSQL-JDBC-Treiber fehlt. backend/target/password-reset-classpath.txt entfernen und erneut starten.' }
    $javaArguments = @('--class-path', $classpath, (Join-Path $PSScriptRoot 'ResetLocalPassword.java'))
    if ($CheckConnection) { $javaArguments += '--check-connection' }
    & (Join-Path $env:JAVA_HOME 'bin/java.exe') @javaArguments
    if ($LASTEXITCODE -ne 0) { throw 'Passwort-Reset nicht erfolgreich abgeschlossen. Bitte die Meldung oben pruefen.' }
} finally {
    $env:JAVA_HOME = $previousJava
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
