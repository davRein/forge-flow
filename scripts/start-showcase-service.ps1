param([Parameter(Mandatory)][ValidateSet('knowledge-backend', 'knowledge-frontend', 'flow-backend', 'flow-frontend', 'pulse-backend', 'pulse-frontend')][string]$Service)
. (Join-Path $PSScriptRoot 'local-common.ps1')
$showcaseRoot = Split-Path -Parent $script:LocalProjectRoot
$projectName = if ($Service.StartsWith('knowledge')) { 'ai-knowledge-hub' } elseif ($Service.StartsWith('flow')) { 'flowpilot-codex-starter' } else { 'pulse-watch' }
$projectRoot = Join-Path $showcaseRoot $projectName
if (-not (Test-Path -LiteralPath $projectRoot -PathType Container)) { throw "Nachbarprojekt fehlt: $projectName" }
$nodeDirectory = Find-LocalNodeDirectory
$env:Path = $nodeDirectory + ';' + $env:Path
# Process-local overrides; existing project .env files remain untouched.
foreach ($name in @('OPENAI_API_KEY', 'FLOWPILOT_AI_API_KEY', 'DB_PASSWORD', 'DATABASE_URL', 'AUTH_PASSWORD_HASH', 'PGPASSWORD')) {
    Remove-Item -LiteralPath ('Env:' + $name) -ErrorAction SilentlyContinue
}
if ($Service -eq 'knowledge-backend') {
    Set-Location -LiteralPath (Join-Path $projectRoot 'backend')
    $env:APP_MODE = 'local-demo'
    $env:APP_ENV = 'development'
    $env:AI_PROVIDER = 'fake'
    $env:LOCAL_WORKSPACE_ID = '6c7b62be-707f-4ca3-90fa-8126ea17d894'
    $env:CORS_ORIGINS = '["http://localhost:3000","http://127.0.0.1:3000"]'
    & '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
} elseif ($Service -eq 'knowledge-frontend') {
    Set-Location -LiteralPath (Join-Path $projectRoot 'frontend')
    $env:NEXT_PUBLIC_SUITE_ORIGIN = 'http://localhost:5173'
    $env:NEXT_PUBLIC_API_URL = '/suite-api'
    $env:NEXT_SUITE_API_TARGET = 'http://127.0.0.1:8000'
    & (Join-Path $nodeDirectory 'npm.cmd') run dev -- --port 3000
} elseif ($Service -eq 'flow-backend') {
    Set-Location -LiteralPath $projectRoot
    $env:FLOWPILOT_MODE = 'demo'
    $env:FLOWPILOT_AI_MODE = 'mock'
    $env:FLOWPILOT_HTTP_MODE = 'mock'
    $env:FLOWPILOT_CORS_ORIGINS = '["http://localhost:5174","http://127.0.0.1:5174"]'
    $store = Join-Path $script:LocalConfigRoot 'showcase/flowpilot'
    New-Item -ItemType Directory -Force -Path $store | Out-Null
    $env:FLOWPILOT_DEMO_STORE_PATH = Join-Path $store 'workflows.json'
    & '.\backend\.venv\Scripts\python.exe' -m uvicorn flowpilot.main:create_app --factory --host 127.0.0.1 --port 8001 --no-access-log
} elseif ($Service -eq 'flow-frontend') {
    Set-Location -LiteralPath (Join-Path $projectRoot 'frontend')
    $env:VITE_SUITE_ORIGIN = 'http://localhost:5173'
    $env:FLOWPILOT_API_PROXY = 'http://127.0.0.1:8001'
    & (Join-Path $nodeDirectory 'npm.cmd') run dev -- --host 127.0.0.1 --port 5174 --strictPort
} elseif ($Service -eq 'pulse-backend') {
    Set-LocalJava
    $maven = Find-LocalMaven
    Set-Location -LiteralPath $projectRoot
    $env:PROBE_MODE = 'fixtures'
    $env:APP_ORIGINS = 'http://localhost:5177,http://127.0.0.1:5177'
    & $maven -B -ntp -f (Join-Path $projectRoot 'backend/pom.xml') spring-boot:run '-Dspring-boot.run.profiles=demo'
} else {
    Set-Location -LiteralPath (Join-Path $projectRoot 'frontend')
    $env:VITE_SUITE_ORIGIN = 'http://localhost:5173'
    & (Join-Path $nodeDirectory 'npm.cmd') run dev -- --host 127.0.0.1 --port 5177 --strictPort
}
if ($LASTEXITCODE -ne 0) { throw "Showcase-Dienst $Service beendet (Exit $LASTEXITCODE)." }
