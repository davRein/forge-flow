param(
    [string]$PostgresBin = 'D:\Program Files\PostgreSQL\18\bin',
    [switch]$Performance
)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
foreach ($taskTool in @('initdb.exe', 'postgres.exe', 'pg_ctl.exe', 'pg_isready.exe', 'createdb.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $PostgresBin $taskTool) -PathType Leaf)) { throw "Missing PostgreSQL tool: $taskTool" }
}
$taskTools = Join-Path $taskRoot 'node_modules/.tmp/backend-tools'
$taskMaven = Join-Path $taskTools 'apache-maven-3.9.11/bin/mvn.cmd'
if (-not (Test-Path -LiteralPath $taskMaven)) { $taskMaven = (Get-Command mvn.cmd -ErrorAction Stop).Source }
$taskNames = @('JAVA_HOME', 'PGPASSWORD', 'TEST_POSTGRES_URL', 'TEST_POSTGRES_USER', 'TEST_POSTGRES_PASSWORD')
$taskPrevious = @{}
foreach ($taskName in $taskNames) { $taskPrevious[$taskName] = [Environment]::GetEnvironmentVariable($taskName, 'Process') }
$taskDirectory = Join-Path $taskRoot ('node_modules/.tmp/postgres-test-' + [guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $taskDirectory)
$taskData = Join-Path $taskDirectory 'data'
$taskPasswordFile = Join-Path $taskDirectory 'init-password.txt'
$taskPassword = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$taskStarted = $false
$taskLocation = Get-Location
try {
    # Random test-only credential. Never reads the application configuration or existing cluster.
    [IO.File]::WriteAllText($taskPasswordFile, $taskPassword, [Text.Encoding]::ASCII)
    & (Join-Path $PostgresBin 'initdb.exe') -D $taskData -U forgeflow_test --auth=scram-sha-256 --encoding=UTF8 --locale=C --pwfile=$taskPasswordFile *> (Join-Path $taskDirectory 'init.log')
    if ($LASTEXITCODE -ne 0) { throw "Test cluster initialization failed; inspect $taskDirectory/init.log" }
    $taskListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $taskListener.Start()
    $taskPort = $taskListener.LocalEndpoint.Port
    $taskListener.Stop()
    # Run the server as a hidden background process. Never wait for the server process:
    # Windows native pipelines/pg_ctl startup can retain inherited daemon handles.
    $taskStartArguments = '-D "' + $taskData + '" -h 127.0.0.1 -p ' + $taskPort
    $taskStarted = $true
    $taskProcess = Start-Process -FilePath (Join-Path $PostgresBin 'postgres.exe') -ArgumentList $taskStartArguments -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $taskDirectory 'postgres-stdout.log') -RedirectStandardError (Join-Path $taskDirectory 'postgres.log')
    $taskReady = $false
    for ($taskAttempt = 0; $taskAttempt -lt 100; $taskAttempt++) {
        & (Join-Path $PostgresBin 'pg_isready.exe') -q -h 127.0.0.1 -p $taskPort -t 1
        if ($LASTEXITCODE -eq 0) { $taskReady = $true; break }
        Start-Sleep -Milliseconds 200
    }
    if (-not $taskReady) { throw "Test cluster start failed; inspect $taskDirectory/postgres.log" }
    $env:PGPASSWORD = $taskPassword
    & (Join-Path $PostgresBin 'createdb.exe') -h 127.0.0.1 -p $taskPort -U forgeflow_test forgeflow_test
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the isolated test database.' }
    $env:TEST_POSTGRES_URL = "jdbc:postgresql://127.0.0.1:$taskPort/forgeflow_test"
    $env:TEST_POSTGRES_USER = 'forgeflow_test'
    $env:TEST_POSTGRES_PASSWORD = $taskPassword
    $taskJdk = Get-ChildItem (Join-Path $taskTools 'jdk') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($taskJdk) { $env:JAVA_HOME = $taskJdk.FullName }
    Set-Location -LiteralPath $taskRoot
    $taskArguments = @('--batch-mode', '--no-transfer-progress', '-f', 'backend/pom.xml', "-Dmaven.repo.local=$taskTools/m2", '-Dlogging.level.root=WARN', '-Dlogging.level.org.springframework=WARN', '-Dforgeflow.ai.live-test=false')
    if ($Performance) { $taskArguments += '-Dforgeflow.performance=true' }
    Write-Output "Running tests against an isolated PostgreSQL cluster on loopback port $taskPort. No OpenAI requests."
    & $taskMaven @taskArguments package
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL verification failed (exit $LASTEXITCODE)." }
} finally {
    Set-Location -LiteralPath $taskLocation.Path
    try {
        if ($taskStarted) {
            $taskStopArguments = '-D "' + $taskData + '" -w -t 30 -m fast stop'
            $taskStop = Start-Process -FilePath (Join-Path $PostgresBin 'pg_ctl.exe') -ArgumentList $taskStopArguments -WindowStyle Hidden -PassThru `
                -RedirectStandardOutput (Join-Path $taskDirectory 'stop.log') -RedirectStandardError (Join-Path $taskDirectory 'stop-error.log')
            if (-not $taskStop.WaitForExit(45000) -or (Test-Path -LiteralPath (Join-Path $taskData 'postmaster.pid'))) {
                Write-Warning "Test cluster did not stop cleanly; inspect $taskDirectory/stop.log"
            }
        }
    } finally {
        if (Test-Path -LiteralPath $taskPasswordFile) { Remove-Item -LiteralPath $taskPasswordFile }
        foreach ($taskName in $taskNames) { [Environment]::SetEnvironmentVariable($taskName, $taskPrevious[$taskName], 'Process') }
        $taskPassword = $null
        Write-Output "Isolated test data/logs retained at $taskDirectory. Existing PostgreSQL services were not modified."
    }
}
