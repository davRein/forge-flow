. (Join-Path $PSScriptRoot 'local-common.ps1')
$null = Get-LocalConfiguration
function Assert-FreePort([int]$Port) {
    $client = [Net.Sockets.TcpClient]::new()
    try {
        $pending = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if ($pending.AsyncWaitHandle.WaitOne(500) -and $client.Connected) {
            throw "Port $Port ist bereits belegt. Den bisherigen Entwicklungsserver zuerst stoppen."
        }
    } finally { $client.Dispose() }
}
Assert-FreePort 3001
Assert-FreePort 5173
$logRoot = Join-Path $script:LocalConfigRoot 'logs'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$children = @()
try {
    foreach ($part in @('backend', 'frontend')) {
        $entry = Join-Path $PSScriptRoot ("start-" + $part + '.ps1')
        $arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $entry + '"'
        $children += Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden -PassThru -WorkingDirectory $script:LocalProjectRoot -RedirectStandardOutput (Join-Path $logRoot ($part + '.log')) -RedirectStandardError (Join-Path $logRoot ($part + '-error.log'))
    }
    Write-Output 'Lokaler Start läuft ...'
    Write-Output 'Logs: backend/.local/logs/. Mit Strg+C werden die hier gestarteten Prozesse beendet.'
    $ready = $false
    $deadline = [DateTime]::UtcNow.AddMinutes(3)
    while ($true) {
        foreach ($child in $children) {
            $child.Refresh()
            if ($child.HasExited) { throw 'Ein Entwicklungsserver wurde beendet. Bitte die lokalen Logs prüfen.' }
        }
        if (-not $ready) {
            try {
                $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/v1/health' -TimeoutSec 1
                $frontend = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173' -TimeoutSec 1
                if ($health.storage -eq 'postgresql' -and $frontend.StatusCode -eq 200) {
                    $ready = $true
                    Write-Output 'Backend und Frontend sind bereit: http://localhost:5173'
                }
            } catch { }
            if (-not $ready -and [DateTime]::UtcNow -gt $deadline) { throw 'Start dauert länger als drei Minuten. Bitte die lokalen Logs prüfen.' }
        }
        Start-Sleep -Seconds 1
    }
} finally {
    foreach ($child in $children) {
        $child.Refresh()
        if (-not $child.HasExited) {
            # Terminate only the process trees created by this invocation.
            & taskkill.exe /PID $child.Id /T /F 2>&1 | Out-Null
        }
    }
}
