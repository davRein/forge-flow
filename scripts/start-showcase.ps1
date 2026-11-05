param([string]$ReadyFile)
. (Join-Path $PSScriptRoot 'local-common.ps1')
if ($ReadyFile) {
    $readyPath = [IO.Path]::GetFullPath($ReadyFile)
    if (-not $readyPath.StartsWith([IO.Path]::GetFullPath($script:LocalConfigRoot) + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Bereitschaftsdatei muss unter backend/.local liegen.' }
}
foreach ($port in @(3000, 8000, 5174, 8001)) { Assert-LocalPortFree $port }
$logRoot = Join-Path $script:LocalConfigRoot 'logs'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$children = @()
try {
    foreach ($service in @('knowledge-backend', 'flow-backend', 'knowledge-frontend', 'flow-frontend')) {
        $entry = Join-Path $PSScriptRoot 'start-showcase-service.ps1'
        $arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $entry + '" -Service ' + $service
        $process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden -PassThru -WorkingDirectory $script:LocalProjectRoot -RedirectStandardOutput (Join-Path $logRoot ($service + '.log')) -RedirectStandardError (Join-Path $logRoot ($service + '-error.log'))
        $children += @{ Service = $service; Process = $process }
    }
    Write-Output 'Starte Knowledge Hub (Fake-Provider) und FlowPilot (Mock-Modus) ...'
    $deadline = [DateTime]::UtcNow.AddMinutes(4)
    $ready = $false
    $lastFailure = 'Dienste noch nicht bereit.'
    while ($true) {
        foreach ($child in $children) {
            $child.Process.Refresh()
            if ($child.Process.HasExited) { throw ('Dienst ' + $child.Service + ' beendet. Siehe backend/.local/logs/' + $child.Service + '-error.log') }
        }
        if (-not $ready) {
            try {
                $knowledge = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 2
                $flow = Invoke-RestMethod -Uri 'http://127.0.0.1:8001/api/v1/health' -TimeoutSec 2
                if ($knowledge.mode -ne 'local-demo' -or $flow.mode -ne 'demo') { throw 'Showcase-Backends laufen nicht im Testmodus.' }
                $hubPage = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000' -TimeoutSec 15
                $flowPage = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5174' -TimeoutSec 5
                $null = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/suite-api/api/documents' -TimeoutSec 5
                if ($hubPage.StatusCode -eq 200 -and $flowPage.StatusCode -eq 200) {
                    if ($ReadyFile) { [IO.File]::WriteAllText($readyPath, '{"ready":true}', [Text.UTF8Encoding]::new($false)) }
                    $ready = $true
                    Write-Output 'Knowledge Hub und FlowPilot sind im lokalen Testmodus bereit.'
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
    if ($ReadyFile -and (Test-Path -LiteralPath $readyPath)) { Remove-Item -LiteralPath $readyPath }
}
