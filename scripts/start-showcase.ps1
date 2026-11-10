param([string]$ReadyFile, [switch]$UseExistingDataScout)
. (Join-Path $PSScriptRoot 'local-common.ps1')
if ($ReadyFile) {
    $readyPath = [IO.Path]::GetFullPath($ReadyFile)
    if (-not $readyPath.StartsWith([IO.Path]::GetFullPath($script:LocalConfigRoot) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Bereitschaftsdatei muss unter backend/.local liegen.' }
}
$ports = @(3000, 8000, 5174, 8001, 5177, 8082)
if (-not $UseExistingDataScout) { $ports += @(5176, 8002) }
foreach ($port in $ports) { Assert-LocalPortFree $port }
$logRoot = Join-Path $script:LocalConfigRoot 'logs'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$children = @()
$dataScoutStarted = $false
$dataScoutOwner = Get-LocalDataScoutOwner
$dataScoutMarker = Get-LocalDataScoutMarker $dataScoutOwner
$dataScoutRoot = Join-Path (Split-Path -Parent $script:LocalProjectRoot) 'data-scout'
$dataScoutArgs = @('compose', '--env-file', (Join-Path $dataScoutRoot 'infra/.env'), '-f', (Join-Path $dataScoutRoot 'infra/compose.yaml'), '-f', (Join-Path $dataScoutRoot 'infra/compose.suite.yaml'))
try {
    if ($UseExistingDataScout) {
        $existing = Invoke-LocalRequest -Uri 'http://127.0.0.1:5176/api/v1/ready' -Json
        $sources = Invoke-LocalRequest -Uri 'http://127.0.0.1:5176/api/v1/sources' -Json
        if ($existing.status -ne 'ready' -or ($sources.sources | Where-Object { $_.id -eq 'dummyjson-products' }).enabled) { throw 'Vorhandenes DataScout muss bereit und im Offline-Modus sein.' }
        Write-Output 'Verwende vorhandenes lokales DataScout; dessen Dienste werden nicht übernommen/gestoppt.'
    } else {
    if (-not (Test-Path -LiteralPath (Join-Path $dataScoutRoot 'infra/.env'))) { throw 'DataScout infra/.env fehlt; zuerst laut DataScout-README einrichten.' }
    if (Test-Path -LiteralPath $dataScoutMarker) { throw 'Vorheriger DataScout-Start muss zuerst gestoppt werden.' }
    [IO.File]::WriteAllText($dataScoutMarker, 'DataScout local startup')
    $dataScoutStarted = $true
    & docker @dataScoutArgs up -d --build --wait --wait-timeout 120
    if ($LASTEXITCODE -ne 0) { throw 'DataScout-Container konnten nicht gestartet werden.' }
    }
    foreach ($service in @('knowledge-backend', 'flow-backend', 'pulse-backend', 'knowledge-frontend', 'flow-frontend', 'pulse-frontend')) {
        $entry = Join-Path $PSScriptRoot 'start-showcase-service.ps1'
        $arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $entry + '" -Service ' + $service
        $process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden -PassThru -WorkingDirectory $script:LocalProjectRoot -RedirectStandardOutput (Join-Path $logRoot ($service + '.log')) -RedirectStandardError (Join-Path $logRoot ($service + '-error.log'))
        $children += @{ Service = $service; Process = $process }
    }
    Write-Output 'Starte Knowledge Hub (Fake-Provider), FlowPilot (Mock-Modus), PulseWatch (Demo/H2) und DataScout (Offline-Fixtures) ...'
    $deadline = [DateTime]::UtcNow.AddMinutes(6)
    $ready = $false
    $lastFailure = 'Dienste noch nicht bereit.'
    while ($true) {
        foreach ($child in $children) {
            $child.Process.Refresh()
            if ($child.Process.HasExited) { throw ('Dienst ' + $child.Service + ' beendet. Siehe backend/.local/logs/' + $child.Service + '-error.log') }
        }
        if (-not $ready) {
            try {
                $knowledge = Invoke-LocalRequest -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 2 -Json
                $flow = Invoke-LocalRequest -Uri 'http://127.0.0.1:8001/api/v1/health' -TimeoutSec 2 -Json
                $pulse = Invoke-LocalRequest -Uri 'http://127.0.0.1:8082/api/v1/health' -TimeoutSec 2 -Json
                if ($knowledge.mode -ne 'local-demo' -or $flow.mode -ne 'demo' -or $pulse.mode -ne 'demo' -or $pulse.database -ne 'UP') { throw 'Showcase-Backends laufen nicht im Testmodus.' }
                $hubPage = Invoke-LocalRequest -Uri 'http://127.0.0.1:3000' -TimeoutSec 15
                $flowPage = Invoke-LocalRequest -Uri 'http://127.0.0.1:5174' -TimeoutSec 5
                $pulsePage = Invoke-LocalRequest -Uri 'http://127.0.0.1:5177' -TimeoutSec 5
                $dataScout = Invoke-LocalRequest -Uri 'http://127.0.0.1:5176/api/v1/ready' -TimeoutSec 5 -Json
                $null = Invoke-LocalRequest -Uri 'http://127.0.0.1:3000/suite-api/api/documents' -TimeoutSec 5 -Json
                if ($hubPage.StatusCode -eq 200 -and $flowPage.StatusCode -eq 200 -and $pulsePage.StatusCode -eq 200 -and $dataScout.status -eq 'ready') {
                    if ($ReadyFile) { [IO.File]::WriteAllText($readyPath, '{"ready":true}', [Text.UTF8Encoding]::new($false)) }
                    $ready = $true
                    Write-Output 'Knowledge Hub, FlowPilot, PulseWatch und DataScout sind im lokalen Testmodus bereit.'
                }
            } catch {
                if ($lastFailure -ne $_.Exception.Message) { Write-Output ('Noch nicht bereit: ' + $_.Exception.Message) }
                $lastFailure = $_.Exception.Message
            }
            if (-not $ready -and [DateTime]::UtcNow -gt $deadline) { throw "Showcase-Start fehlgeschlagen: $lastFailure. Siehe backend/.local/logs/." }
        }
        Start-Sleep -Seconds 1
    }
} finally {
    foreach ($child in $children) {
        $child.Process.Refresh()
        if (-not $child.Process.HasExited) { & taskkill.exe /PID $child.Process.Id /T /F 2>&1 | Out-Null }
    }
    if ($dataScoutStarted) { Stop-LocalDataScout $dataScoutOwner }
    if ($ReadyFile -and (Test-Path -LiteralPath $readyPath)) { Remove-Item -LiteralPath $readyPath }
}
