# Offline checks for the interactive live-test script. No network requests are made.
$ErrorActionPreference = 'Stop'
$taskAiTarget = Join-Path $PSScriptRoot 'test-ai-api.ps1'
$taskAiOffline = [pscustomobject]@{
    Calls = [System.Collections.Generic.List[string]]::new(); FailMessage = $false; Prompts = 0
    FailureEndpoint = ''; FailureBody = ''; FailureStatus = 503; FailureDetails = $false; Session = $null
    Warnings = [System.Collections.Generic.List[string]]::new()
}
class TaskAiOfflineResponse : System.Net.WebResponse {
    [System.Net.HttpStatusCode]$StatusCode
    [string]$Body
    [bool]$StreamClosed = $false
    TaskAiOfflineResponse([int]$status, [string]$body) { $this.StatusCode = $status; $this.Body = $body }
    [System.IO.Stream] GetResponseStream() {
        if ($this.StreamClosed) { throw [System.ObjectDisposedException]::new('Offline response stream') }
        return [System.IO.MemoryStream]::new([Text.Encoding]::UTF8.GetBytes($this.Body))
    }
}
function Read-Host {
    param([string]$Prompt, [switch]$AsSecureString)
    $taskAiOffline.Prompts++
    if ($AsSecureString) { return ConvertTo-SecureString 'Nur-im-Test-Ü12345' -AsPlainText -Force }
    return 'test@example.test'
}
function New-TaskAiOfflineJsonResponse($Value, [int]$StatusCode = 200) {
    $taskJson = if ($null -eq $Value) { 'null' } else { $Value | ConvertTo-Json -Depth 8 -Compress }
    $taskBytes = [Text.Encoding]::UTF8.GetBytes($taskJson)
    $taskStream = [IO.MemoryStream]::new($taskBytes)
    $taskStream.Position = $taskStream.Length
    return [pscustomobject]@{
        StatusCode = $StatusCode
        RawContentStream = $taskStream
        # Simulate the legacy decoding error. Production must use the original bytes.
        Content = [Text.Encoding]::GetEncoding(28591).GetString($taskBytes)
        Headers = @{ 'Content-Type' = 'application/json' }
    }
}
function Write-Warning { param([string]$Message) $taskAiOffline.Warnings.Add($Message) }
function Invoke-WebRequest {
    param([string]$Uri, [string]$Method = 'Get', $WebSession, $Headers, [string]$ContentType, $Body, [int]$TimeoutSec, [switch]$UseBasicParsing)
    if (-not $UseBasicParsing) { throw 'Windows PowerShell must not require the Internet Explorer parser.' }
    $taskAiOffline.Calls.Add($Uri)
    if ($taskAiOffline.FailureEndpoint -and $Uri.EndsWith($taskAiOffline.FailureEndpoint)) {
        $taskResponse = [TaskAiOfflineResponse]::new($taskAiOffline.FailureStatus, $taskAiOffline.FailureBody)
        $taskException = [System.Net.WebException]::new('Generic HTTP error.', $null, [System.Net.WebExceptionStatus]::ProtocolError, $taskResponse)
        if ($taskAiOffline.FailureDetails) {
            $taskResponse.StreamClosed = $true
            $taskError = [System.Management.Automation.ErrorRecord]::new($taskException, 'OfflineHttpFailure', 'InvalidOperation', $null)
            $taskError.ErrorDetails = [System.Management.Automation.ErrorDetails]::new($taskAiOffline.FailureBody)
            throw $taskError
        }
        throw $taskException
    }
    if ($Uri -like '*/auth/csrf') {
        $taskAiOffline.Session = $WebSession
        return New-TaskAiOfflineJsonResponse @{ csrfToken = 'test-anonymous-csrf' }
    }
    if ($Headers.Origin -ne 'https://example.test' -or -not [object]::ReferenceEquals($WebSession, $taskAiOffline.Session)) { throw 'Origin/session not forwarded.' }
    if ($Uri -like '*/auth/login') {
        if ($Headers['X-CSRF-TOKEN'] -ne 'test-anonymous-csrf') { throw 'Login CSRF token missing.' }
        $taskLogin = [Text.Encoding]::UTF8.GetString($Body) | ConvertFrom-Json
        if ($taskLogin.password -ne 'Nur-im-Test-Ü12345') { throw 'Unicode login password was changed.' }
        return New-TaskAiOfflineJsonResponse @{ csrfToken = 'test-renewed-csrf' }
    }
    if ($Headers['X-CSRF-TOKEN'] -ne 'test-renewed-csrf') { throw 'Renewed CSRF token missing.' }
    if ($Uri -like '*/ai/conversations') { return New-TaskAiOfflineJsonResponse @{ id = 'test-conversation' } }
    if ($Uri -like '*/messages') {
        $taskInput = [Text.Encoding]::UTF8.GetString($Body) | ConvertFrom-Json
        if ($taskInput.message -ne 'Grüße' -or -not [guid]::Parse($taskInput.requestId)) { throw 'Message/request ID invalid.' }
        if ($taskAiOffline.FailMessage) { throw 'Simulated provider unavailable.' }
        return New-TaskAiOfflineJsonResponse @{ assistant = @{ content = 'Grüße, erklären, ändern und 😀' }; usage = @{ inputTokens = 10; outputTokens = 2 }; truncated = $false }
    }
    if ($Uri -like '*/auth/logout') { return New-TaskAiOfflineJsonResponse $null 204 }
    throw 'Unexpected endpoint.'
}

$taskOutput = & $taskAiTarget -Origin 'https://example.test' -Message 'Grüße'
if ($taskOutput -ne 'Grüße, erklären, ändern und 😀' -or $taskAiOffline.Calls.Count -ne 5 -or $taskAiOffline.Calls[-1] -notlike '*/auth/logout') {
    throw 'Successful test did not complete or log out.'
}
Write-Host 'PASS: login, renewed CSRF, UTF-8 request/response without charset and session logout'
$taskAiOffline.FailMessage = $true
$taskAiOffline.Calls.Clear()
$taskFailed = $false
try { & $taskAiTarget -Origin 'https://example.test' -Message 'Grüße' | Out-Null }
catch { $taskFailed = $_.Exception.Message -like '*Simulated provider unavailable*' }
if (-not $taskFailed -or $taskAiOffline.Calls[-1] -notlike '*/auth/logout') { throw 'Failed chat did not report failure and log out.' }
Write-Host 'PASS: provider error still logs out'
$taskAiOffline.FailMessage = $false
foreach ($taskCase in @(
    @{ Endpoint = '/ai/conversations'; Status = 503; Code = 'AI_DISABLED'; Step = 'KI-Unterhaltung anlegen'; Details = $false; Calls = 4 },
    @{ Endpoint = '/messages'; Status = 503; Code = 'AI_UNAVAILABLE'; Step = 'KI-Antwort abrufen'; Details = $true; Calls = 5 },
    @{ Endpoint = '/auth/login'; Status = 401; Code = 'INVALID_CREDENTIALS'; Step = 'Anmeldung'; Details = $false; Calls = 2 }
)) {
    $taskAiOffline.FailureEndpoint = $taskCase.Endpoint
    $taskAiOffline.FailureStatus = $taskCase.Status
    $taskAiOffline.FailureBody = @{ error = @{ code = $taskCase.Code; message = 'Offline-Testfehler: bitte prüfen' } } | ConvertTo-Json -Compress
    $taskAiOffline.FailureDetails = $taskCase.Details
    $taskAiOffline.Calls.Clear()
    $taskErrorMessage = ''
    try { & $taskAiTarget -Origin 'https://example.test' -Message 'Grüße' | Out-Null }
    catch { $taskErrorMessage = $_.Exception.Message }
    if (-not $taskErrorMessage.Contains($taskCase.Step) -or -not $taskErrorMessage.Contains($taskCase.Code) -or
            -not $taskErrorMessage.Contains("HTTP $($taskCase.Status)") -or -not $taskErrorMessage.Contains('bitte prüfen') -or $taskAiOffline.Calls.Count -ne $taskCase.Calls) {
        throw "HTTP diagnostics failed: $taskErrorMessage"
    }
    if ($taskCase.Status -ne 401 -and $taskAiOffline.Calls[-1] -notlike '*/auth/logout') { throw 'Diagnostic failure did not log out.' }
    Write-Host "PASS: $($taskCase.Code) reports stage/status/body without repeating the failed request"
}
$taskAiOffline.FailureEndpoint = ''
$taskAiOffline.Prompts = 0
foreach ($taskOrigin in 'http://example.test', 'https://example.test/path', 'https://user@example.test', 'https://example.test/?query=1') {
    $taskRejected = $false
    try { & $taskAiTarget -Origin $taskOrigin -Message 'Grüße' | Out-Null } catch { $taskRejected = $true }
    if (-not $taskRejected) { throw 'Invalid origin accepted.' }
}
if ($taskAiOffline.Prompts -ne 0) { throw 'Invalid origin must be rejected before credential prompts.' }
if ($taskAiOffline.Warnings.Count -ne 0) { throw 'Unexpected warnings: logout was not successfully confirmed.' }
Write-Host 'PASS: invalid origins rejected before requesting credentials'
