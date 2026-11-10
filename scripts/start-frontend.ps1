param([switch]$LocalDemo, [switch]$UseExistingDataScout)
. (Join-Path $PSScriptRoot 'local-common.ps1')
$nodeDirectory = Find-LocalNodeDirectory
Assert-LocalPortFree 5173
$skipShowcase = $env:FORGEFLOW_SKIP_SHOWCASE -eq 'true'
$previousOwner = $env:FORGEFLOW_DATASCOUT_OWNER
$dataScoutOwner = Get-LocalDataScoutOwner
$env:FORGEFLOW_DATASCOUT_OWNER = [string]$dataScoutOwner
$previousPath = $env:Path
$previousMode = [Environment]::GetEnvironmentVariable('VITE_DATA_MODE', 'Process')
$previousApi = [Environment]::GetEnvironmentVariable('VITE_API_BASE_URL', 'Process')
$localAppUrls = @{ VITE_KNOWLEDGE_HUB_URL = 'http://localhost:3000'; VITE_FLOWPILOT_URL = 'http://localhost:5174'; VITE_PULSEWATCH_URL = 'http://localhost:5177'; VITE_DATASCOUT_URL = 'http://localhost:5176' }
$previousAppUrls = @{}
foreach ($name in $localAppUrls.Keys) { $previousAppUrls[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$locationBefore = Get-Location
$backendSecrets = @{}
$showcaseProcess = $null
$showcaseReady = Join-Path $script:LocalConfigRoot ('showcase-ready-' + [Guid]::NewGuid().ToString('N') + '.json')
foreach ($name in @('DB_PASSWORD', 'AUTH_PASSWORD_HASH', 'PGPASSWORD', 'TEST_POSTGRES_PASSWORD')) {
    $backendSecrets[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
    if (-not $skipShowcase) {
        $logRoot = Join-Path $script:LocalConfigRoot 'logs'
        New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
        $entry = Join-Path $PSScriptRoot 'start-showcase.ps1'
        $arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $entry + '" -ReadyFile "' + $showcaseReady + '"'
        if ($UseExistingDataScout) { $arguments += ' -UseExistingDataScout' }
        $showcaseProcess = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden -PassThru -WorkingDirectory $script:LocalProjectRoot -RedirectStandardOutput (Join-Path $logRoot 'showcase.log') -RedirectStandardError (Join-Path $logRoot 'showcase-error.log')
        Write-Output 'Starte die integrierten Test-Apps. Logs: backend/.local/logs/.'
        $deadline = [DateTime]::UtcNow.AddMinutes(7)
        while (-not (Test-Path -LiteralPath $showcaseReady)) {
            $showcaseProcess.Refresh()
            if ($showcaseProcess.HasExited) {
                Get-Content -LiteralPath (Join-Path $logRoot 'showcase-error.log') -Tail 15
                throw 'Test-Apps konnten nicht gestartet werden. Siehe die genannten Logs.'
            }
            if ([DateTime]::UtcNow -gt $deadline) { throw 'Test-Apps sind nach sieben Minuten nicht bereit. Siehe backend/.local/logs/.' }
            Start-Sleep -Seconds 1
        }
        Write-Output 'Knowledge Hub, FlowPilot, PulseWatch und DataScout sind bereit.'
    }
    foreach ($name in $backendSecrets.Keys) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
    $env:Path = $nodeDirectory + ';' + $env:Path
    $env:VITE_DATA_MODE = if ($LocalDemo) { 'local' } else { 'api' }
    foreach ($name in $localAppUrls.Keys) { [Environment]::SetEnvironmentVariable($name, $localAppUrls[$name], 'Process') }
    $env:VITE_API_BASE_URL = '/api/v1'
    Set-Location -LiteralPath (Join-Path $script:LocalProjectRoot 'frontend')
    if ($LocalDemo) { Write-Output 'Lokale Suite-Demo: http://localhost:5173 (fluechtige Suite-Sitzung, lokale Zusatz-Apps).' }
    else { Write-Output 'Anmeldung im Browser: http://localhost:5173 (lokaler Backend-Ursprung).' }
    & (Join-Path $nodeDirectory 'npm.cmd') run dev -- --host 127.0.0.1 --port 5173 --strictPort
    if ($LASTEXITCODE -ne 0) { throw "Frontend beendet (Exit $LASTEXITCODE)." }
} finally {
    if ($showcaseProcess) {
        $showcaseProcess.Refresh()
        if (-not $showcaseProcess.HasExited) { & taskkill.exe /PID $showcaseProcess.Id /T /F 2>&1 | Out-Null }
    }
    if ($showcaseProcess) { Stop-LocalDataScout $dataScoutOwner }
    [Environment]::SetEnvironmentVariable('FORGEFLOW_DATASCOUT_OWNER', $previousOwner, 'Process')
    if (Test-Path -LiteralPath $showcaseReady) { Remove-Item -LiteralPath $showcaseReady }
    Set-Location -LiteralPath $locationBefore.Path
    $env:Path = $previousPath
    [Environment]::SetEnvironmentVariable('VITE_DATA_MODE', $previousMode, 'Process')
    [Environment]::SetEnvironmentVariable('VITE_API_BASE_URL', $previousApi, 'Process')
    foreach ($name in $previousAppUrls.Keys) { [Environment]::SetEnvironmentVariable($name, $previousAppUrls[$name], 'Process') }
    foreach ($name in $backendSecrets.Keys) { [Environment]::SetEnvironmentVariable($name, $backendSecrets[$name], 'Process') }
}
