. (Join-Path $PSScriptRoot 'local-common.ps1')
$nodeDirectory = Find-LocalNodeDirectory
$previousPath = $env:Path
$previousMode = [Environment]::GetEnvironmentVariable('VITE_DATA_MODE', 'Process')
$previousApi = [Environment]::GetEnvironmentVariable('VITE_API_BASE_URL', 'Process')
$locationBefore = Get-Location
$backendSecrets = @{}
foreach ($name in @('DB_PASSWORD', 'AUTH_PASSWORD_HASH', 'PGPASSWORD', 'TEST_POSTGRES_PASSWORD')) {
    $backendSecrets[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
    foreach ($name in $backendSecrets.Keys) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
    $env:Path = $nodeDirectory + ';' + $env:Path
    $env:VITE_DATA_MODE = 'api'
    $env:VITE_API_BASE_URL = '/api/v1'
    Set-Location -LiteralPath (Join-Path $script:LocalProjectRoot 'frontend')
    & (Join-Path $nodeDirectory 'npm.cmd') run dev -- --host 127.0.0.1 --port 5173 --strictPort
    if ($LASTEXITCODE -ne 0) { throw "Frontend beendet (Exit $LASTEXITCODE)." }
} finally {
    Set-Location -LiteralPath $locationBefore.Path
    $env:Path = $previousPath
    [Environment]::SetEnvironmentVariable('VITE_DATA_MODE', $previousMode, 'Process')
    [Environment]::SetEnvironmentVariable('VITE_API_BASE_URL', $previousApi, 'Process')
    foreach ($name in $backendSecrets.Keys) { [Environment]::SetEnvironmentVariable($name, $backendSecrets[$name], 'Process') }
}
