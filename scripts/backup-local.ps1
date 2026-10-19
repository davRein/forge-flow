param([ValidateRange(0, 8760)][int]$IfOlderThanHours = 0)
. (Join-Path $PSScriptRoot 'local-common.ps1')
$settings = Get-LocalConfiguration
$directory = Join-Path $script:LocalProjectRoot 'backups'
New-Item -ItemType Directory -Path $directory -Force | Out-Null
if ($IfOlderThanHours -gt 0) {
    $latest = Get-ChildItem -LiteralPath $directory -Filter '*.dump' -File |
        Where-Object { $_.Name.StartsWith($settings.DatabaseName + '_') } | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    if ($latest -and $latest.LastWriteTimeUtc -gt [DateTime]::UtcNow.AddHours(-$IfOlderThanHours)) {
        try { $null = Assert-LocalBackup $latest.FullName; Write-Output $latest.FullName; return }
        catch { Write-Warning 'Die letzte Sicherung ist unvollständig oder beschädigt. Eine neue Sicherung wird erstellt.' }
    }
}
$secret = Get-LocalDatabasePassword
$filename = $settings.DatabaseName + '_' + [DateTime]::UtcNow.ToString('yyyyMMdd_HHmmss_fff') + '_' + [Guid]::NewGuid().ToString('N').Substring(0, 8) + '.dump'
$archive = Join-Path $directory $filename
$temporary = $archive + '.partial'
try {
    $arguments = @(Get-PostgresArguments $settings) + @('--format=custom', '--no-privileges', '--lock-wait-timeout=10s', '--file', $temporary)
    $null = Invoke-PostgresTool $settings 'pg_dump' $arguments $secret
    if ((Get-Item -LiteralPath $temporary).Length -eq 0) { throw 'Die Sicherungsdatei ist leer.' }
    $null = Invoke-PostgresTool $settings 'pg_restore' @('--list', $temporary) $secret
    $hash = (Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash
    [IO.File]::WriteAllText($archive + '.sha256', $hash, [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporary -Destination $archive
    Write-Output $archive
} finally {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    if (-not (Test-Path -LiteralPath $archive) -and (Test-Path -LiteralPath ($archive + '.sha256'))) {
        Remove-Item -LiteralPath ($archive + '.sha256') -Force
    }
}
