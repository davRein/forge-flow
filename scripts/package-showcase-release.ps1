param()
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskShowcase = Split-Path -Parent $taskRoot
$taskHub = Join-Path $taskShowcase 'ai-knowledge-hub'
$taskFlow = Join-Path $taskShowcase 'flowpilot-codex-starter'
$taskReleaseId = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$taskStage = Join-Path $taskRoot ('node_modules/.tmp/showcase-package-' + $taskReleaseId)
$taskOutput = Join-Path $taskRoot 'node_modules/.tmp/forgeflow-showcase.tar.gz'
$taskUtf8 = New-Object Text.UTF8Encoding($false)
New-Item -ItemType Directory -Path $taskStage | Out-Null

function Copy-TaskTree([string]$Source, [string]$Destination) {
    if (-not (Test-Path -LiteralPath $Source)) { throw "Required release source missing: $Source" }
    $taskSourceItem = Get-Item -LiteralPath $Source -Force
    if ($taskSourceItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Symlink/reparse source refused: $Source" }
    if ($taskSourceItem.PSIsContainer) {
        New-Item -ItemType Directory -Force -Path $Destination | Out-Null
        foreach ($taskEntry in Get-ChildItem -LiteralPath $Source -Force) {
            if ($taskEntry.Name -in @('node_modules', '.venv', '.git', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.next', 'dist', '.data', '.local')) { continue }
            if ($taskEntry.Name -like '.env*' -or $taskEntry.Name -like '*.pyc') { continue }
            Copy-TaskTree $taskEntry.FullName (Join-Path $Destination $taskEntry.Name)
        }
    } else {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
        Copy-Item -LiteralPath $Source -Destination $Destination
    }
}

function Assert-TaskBuild([string]$Artifact, [string[]]$Sources) {
    $taskBuildTime = (Get-Item -LiteralPath $Artifact -ErrorAction Stop).LastWriteTimeUtc
    foreach ($taskSource in $Sources) {
        if (-not (Test-Path -LiteralPath $taskSource)) { continue }
        $taskItems = if ((Get-Item -LiteralPath $taskSource).PSIsContainer) { Get-ChildItem -LiteralPath $taskSource -File -Recurse } else { Get-Item -LiteralPath $taskSource }
        if ($taskItems | Where-Object { $_.LastWriteTimeUtc -gt $taskBuildTime } | Select-Object -First 1) { throw "Build is older than source: $Artifact. Rebuild and verify before packaging." }
    }
}

Assert-TaskBuild (Join-Path $taskRoot 'backend/target/backend-0.1.0-SNAPSHOT.jar') @((Join-Path $taskRoot 'backend/src'), (Join-Path $taskRoot 'backend/pom.xml'))
Assert-TaskBuild (Join-Path $taskRoot 'frontend/dist/index.html') @((Join-Path $taskRoot 'frontend/src'), (Join-Path $taskRoot 'frontend/public'), (Join-Path $taskRoot 'frontend/package.json'))
Assert-TaskBuild (Join-Path $taskFlow 'frontend/dist/index.html') @((Join-Path $taskFlow 'frontend/src'), (Join-Path $taskFlow 'frontend/package.json'), (Join-Path $taskFlow 'frontend/vite.config.ts'))
$taskSuiteJs = Get-ChildItem (Join-Path $taskRoot 'frontend/dist/assets') -Filter '*.js' | Get-Content -Raw -Encoding UTF8
if (($taskSuiteJs -join '') -notmatch 'https://forge-flow\.de/knowledge-hub' -or ($taskSuiteJs -join '') -notmatch 'https://forge-flow\.de/flowpilot') { throw 'Suite build lacks the production showcase URLs.' }
$taskFlowHtml = Get-Content (Join-Path $taskFlow 'frontend/dist/index.html') -Raw -Encoding UTF8
if ($taskFlowHtml -notmatch '/flowpilot/assets/') { throw 'FlowPilot build lacks its production asset prefix.' }
$taskFlowJs = Get-ChildItem (Join-Path $taskFlow 'frontend/dist/assets') -Filter '*.js' | Get-Content -Raw -Encoding UTF8
if (($taskFlowJs -join '') -notmatch '/flowpilot-api') { throw 'FlowPilot build lacks its separate API namespace.' }
if (($taskFlowJs -join '') -notmatch 'https://forge-flow\.de') { throw 'FlowPilot build lacks its trusted suite origin. Rebuild with VITE_SUITE_ORIGIN=https://forge-flow.de.' }

Copy-TaskTree (Join-Path $taskRoot 'frontend/dist') (Join-Path $taskStage 'suite-web')
Copy-TaskTree (Join-Path $taskFlow 'frontend/dist') (Join-Path $taskStage 'flow-web')
Copy-TaskTree (Join-Path $taskRoot 'backend/target/backend-0.1.0-SNAPSHOT.jar') (Join-Path $taskStage 'scripts/forgeflow-chat-backend.jar')
foreach ($taskName in @('update-linux-chat.sh', 'test-linux-chat.sh', 'install-linux-showcase.sh', 'check-linux-showcase.sh')) {
    Copy-TaskTree (Join-Path $PSScriptRoot $taskName) (Join-Path $taskStage ('scripts/' + $taskName))
}
foreach ($taskName in @('Python.Dockerfile', 'Next.Dockerfile', 'image_read_access.py', 'provision.py', 'ai_config.py', 'nginx_site.py', 'nginx-map.conf', 'nginx-locations.conf', 'forgeflow-showcase.service', 'create-hub-user.sh')) {
    Copy-TaskTree (Join-Path $taskRoot ('deploy/showcase/' + $taskName)) (Join-Path $taskStage ('docker/' + $taskName))
}
Copy-TaskTree (Join-Path $taskRoot 'deploy/showcase/compose.yaml') (Join-Path $taskStage 'compose.yaml')
foreach ($taskName in @('app', 'components', 'lib', 'public', 'i18n.ts', 'translations.ts', 'package.json', 'package-lock.json', 'next.config.ts', 'next-env.d.ts', 'tsconfig.json', 'postcss.config.mjs')) {
    $taskSource = Join-Path $taskHub ('frontend/' + $taskName)
    if ($taskName -eq 'public' -and -not (Test-Path -LiteralPath $taskSource)) { New-Item -ItemType Directory -Force -Path (Join-Path $taskStage 'hub-web/public') | Out-Null; continue }
    Copy-TaskTree $taskSource (Join-Path $taskStage ('hub-web/' + $taskName))
}
foreach ($taskName in @('app', 'alembic', 'alembic.ini', 'pyproject.toml')) {
    Copy-TaskTree (Join-Path $taskHub ('backend/' + $taskName)) (Join-Path $taskStage ('hub-api/' + $taskName))
}
foreach ($taskName in @('src', 'pyproject.toml')) {
    Copy-TaskTree (Join-Path $taskFlow ('backend/' + $taskName)) (Join-Path $taskStage ('flow-api/' + $taskName))
}
# Compose/Bake reads Dockerfiles only within the corresponding build context.
foreach ($taskContext in @('hub-api', 'flow-api')) {
    Copy-TaskTree (Join-Path $taskRoot 'deploy/showcase/Python.Dockerfile') (Join-Path $taskStage ($taskContext + '/Dockerfile'))
    Copy-TaskTree (Join-Path $taskRoot 'deploy/showcase/image_read_access.py') (Join-Path $taskStage ($taskContext + '/image_read_access.py'))
}
Copy-TaskTree (Join-Path $taskRoot 'deploy/showcase/Next.Dockerfile') (Join-Path $taskStage 'hub-web/Dockerfile')
foreach ($taskProject in @(@{Root=$taskHub; Destination='hub-api'}, @{Root=$taskFlow; Destination='flow-api'})) {
    $taskPython = Join-Path $taskProject.Root 'backend/.venv/Scripts/python.exe'
    # Python writes one name==version per line; no JSON-array unrolling in Windows PowerShell.
    & $taskPython (Join-Path $PSScriptRoot 'showcase_python_constraints.py') (Join-Path $taskStage ($taskProject.Destination + '/constraints.txt'))
    if ($LASTEXITCODE -ne 0) { throw 'Could not generate valid Python dependency constraints.' }
}
$taskManifest = @{release_id=$taskReleaseId; origin='https://forge-flow.de'; access='suite-session'; providers='server-configured-ai/http-mock'; built_at=[DateTime]::UtcNow.ToString('o')}
[IO.File]::WriteAllText((Join-Path $taskStage 'release.json'), ($taskManifest | ConvertTo-Json) + "`n", $taskUtf8)

# Source control may check out CRLF; Linux executable/configuration text is normalized in the package.
foreach ($taskText in Get-ChildItem -LiteralPath $taskStage -File -Recurse | Where-Object { $_.Extension -in @('.sh', '.py', '.yaml', '.conf', '.service') -or $_.Name -like '*.Dockerfile' -or $_.Name -eq 'Dockerfile' }) {
    $taskContent = [IO.File]::ReadAllText($taskText.FullName)
    [IO.File]::WriteAllText($taskText.FullName, $taskContent.Replace("`r`n", "`n"), $taskUtf8)
}
& tar.exe -czf (Join-Path $taskStage 'scripts/forgeflow-chat-frontend.tar.gz') -C (Join-Path $taskStage 'suite-web') .
if ($LASTEXITCODE -ne 0) { throw 'Suite archive failed.' }
$taskMainHashes = @('forgeflow-chat-backend.jar', 'forgeflow-chat-frontend.tar.gz') | ForEach-Object { (Get-FileHash -Algorithm SHA256 (Join-Path $taskStage ('scripts/' + $_))).Hash.ToLowerInvariant() + '  ' + $_ }
[IO.File]::WriteAllText((Join-Path $taskStage 'scripts/forgeflow-chat.sha256'), ($taskMainHashes -join "`n") + "`n", $taskUtf8)
$taskHashes = Get-ChildItem -LiteralPath $taskStage -File -Recurse | Sort-Object FullName | ForEach-Object {
    (Get-FileHash -Algorithm SHA256 $_.FullName).Hash.ToLowerInvariant() + '  ' + $_.FullName.Substring($taskStage.Length + 1).Replace('\', '/')
}
[IO.File]::WriteAllText((Join-Path $taskStage 'SHA256SUMS'), ($taskHashes -join "`n") + "`n", $taskUtf8)
& tar.exe -czf $taskOutput -C $taskStage .
if ($LASTEXITCODE -ne 0) { throw 'Release archive failed.' }
& (Join-Path $taskHub 'backend/.venv/Scripts/python.exe') (Join-Path $PSScriptRoot 'check-showcase-build-contexts.py') $taskOutput
if ($LASTEXITCODE -ne 0) { throw 'Release build-context verification failed.' }
[IO.File]::WriteAllText(($taskOutput + '.sha256'), (Get-FileHash -Algorithm SHA256 $taskOutput).Hash.ToLowerInvariant() + '  forgeflow-showcase.tar.gz' + "`n", $taskUtf8)
# Upload this exact LF-normalized installer with the archive.
[IO.File]::WriteAllText((Join-Path (Split-Path -Parent $taskOutput) 'install-linux-showcase.sh'), [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'install-linux-showcase.sh')).Replace("`r`n", "`n"), $taskUtf8)
Write-Output ('Prepared release: ' + $taskReleaseId)
Write-Output ('Archive: ' + $taskOutput)
Write-Output ('Staging: ' + $taskStage)
