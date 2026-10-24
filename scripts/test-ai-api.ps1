param(
    [string]$Origin = 'https://185.56.150.178',
    [string]$Message = 'Antworte kurz auf Deutsch: Welche Unterstützung kannst du mir derzeit anbieten?'
)
$ErrorActionPreference = 'Stop'
$taskAiUri = $null
if (-not [Uri]::TryCreate($Origin, [UriKind]::Absolute, [ref]$taskAiUri) -or
        $taskAiUri.Scheme -ne 'https' -or $taskAiUri.UserInfo -or $taskAiUri.Query -or $taskAiUri.Fragment -or $taskAiUri.AbsolutePath -ne '/') {
    throw 'Origin must be an HTTPS origin without a path, credentials, query or fragment.'
}
if ([string]::IsNullOrWhiteSpace($Message) -or $Message.Length -gt 4000) { throw 'Message must contain 1-4000 characters.' }
$Origin = $Origin.TrimEnd('/')
$taskAiApi = "$Origin/api/v1"
$taskAiLoggedIn = $false
$taskAiSession = $null
$taskAiHeaders = $null
$taskAiStep = 'Anmeldeschutz laden'
function Invoke-TaskAiJson {
    param([string]$Uri, [string]$Method = 'Get', $WebSession, $Headers, [string]$ContentType, $Body, [int]$TimeoutSec = 20)
    $PSBoundParameters['TimeoutSec'] = $TimeoutSec
    $taskResponse = Invoke-WebRequest -UseBasicParsing @PSBoundParameters
    if ([int]$taskResponse.StatusCode -eq 204) { return }
    # JSON is UTF-8 even without a charset parameter. Windows PowerShell 5.1 may
    # otherwise decode application/json as Latin-1 before ConvertFrom-Json sees it.
    $taskStream = $taskResponse.RawContentStream
    if ($taskStream.CanSeek) { $taskStream.Position = 0 }
    $taskReader = [IO.StreamReader]::new($taskStream, [Text.UTF8Encoding]::new($false, $true))
    try { $taskReader.ReadToEnd() | ConvertFrom-Json }
    finally { $taskReader.Dispose() }
}
try {
    Write-Host "Testing the AI API at $Origin. One successful message can incur OpenAI API costs."
    $taskAiEmail = Read-Host 'Application email (same account as frontend login)'
    $taskAiPassword = Read-Host 'Application password' -AsSecureString
    $taskAiSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $taskAiCsrf = Invoke-TaskAiJson "$taskAiApi/auth/csrf" -WebSession $taskAiSession -TimeoutSec 20
    $taskAiHeaders = @{ Origin = $Origin; 'X-CSRF-TOKEN' = $taskAiCsrf.csrfToken }
    $taskAiLoginBody = @{
        email = $taskAiEmail
        password = [System.Net.NetworkCredential]::new('', $taskAiPassword).Password
    } | ConvertTo-Json
    $taskAiStep = 'Anmeldung'
    $taskAiLogin = Invoke-TaskAiJson "$taskAiApi/auth/login" -Method Post -WebSession $taskAiSession -Headers $taskAiHeaders `
        -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($taskAiLoginBody)) -TimeoutSec 20
    $taskAiLoginBody = $null
    $taskAiHeaders['X-CSRF-TOKEN'] = $taskAiLogin.csrfToken
    $taskAiLoggedIn = $true
    Write-Host '[OK] Anmeldung erfolgreich.'
    $taskAiStep = 'KI-Unterhaltung anlegen'
    $taskAiConversation = Invoke-TaskAiJson "$taskAiApi/ai/conversations" -Method Post -WebSession $taskAiSession -Headers $taskAiHeaders `
        -ContentType 'application/json' -Body '{"language":"de"}' -TimeoutSec 20
    Write-Host '[OK] KI-Unterhaltung angelegt.'
    $taskAiBody = @{ requestId = [guid]::NewGuid().ToString(); message = $Message } | ConvertTo-Json
    $taskAiStep = 'KI-Antwort abrufen'
    $taskAiReply = Invoke-TaskAiJson "$taskAiApi/ai/conversations/$($taskAiConversation.id)/messages" -Method Post `
        -WebSession $taskAiSession -Headers $taskAiHeaders -ContentType 'application/json; charset=utf-8' `
        -Body ([Text.Encoding]::UTF8.GetBytes($taskAiBody)) -TimeoutSec 75
    Write-Host "`nAssistant:"
    Write-Output $taskAiReply.assistant.content
    Write-Host "`nInput tokens: $($taskAiReply.usage.inputTokens); output tokens: $($taskAiReply.usage.outputTokens); truncated: $($taskAiReply.truncated)"
} catch {
    $taskAiError = $_
    $taskAiResponse = $taskAiError.Exception.Response
    $taskAiStatus = if ($taskAiResponse -and $null -ne $taskAiResponse.StatusCode) { "HTTP $([int]$taskAiResponse.StatusCode)" } else { 'request failed' }
    $taskAiErrorBody = $taskAiError.ErrorDetails.Message
    # Windows PowerShell 5.1 can omit or misdecode ErrorDetails. Prefer UTF-8 bytes
    # from that same response, without repeating a potentially billable POST.
    if ($taskAiResponse) {
        $taskAiReader = $null
        $taskAiRawErrorBody = $null
        try {
            if ($taskAiResponse.PSObject.Methods['GetResponseStream']) {
                $taskAiReader = [IO.StreamReader]::new($taskAiResponse.GetResponseStream(), [Text.Encoding]::UTF8)
                $taskAiBuffer = [char[]]::new(4096)
                $taskAiRead = $taskAiReader.ReadBlock($taskAiBuffer, 0, $taskAiBuffer.Length)
                $taskAiRawErrorBody = [string]::new($taskAiBuffer, 0, $taskAiRead)
            } elseif ($taskAiResponse.Content) {
                $taskAiRawErrorBody = $taskAiResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            }
            if (-not [string]::IsNullOrWhiteSpace($taskAiRawErrorBody)) { $taskAiErrorBody = $taskAiRawErrorBody }
        } catch { # A consumed/closed response still retains the failed step and HTTP status.
        } finally { if ($taskAiReader) { $taskAiReader.Dispose() } }
    }
    $taskAiFailure = $taskAiError.Exception.Message
    if ($taskAiErrorBody) {
        try {
            $taskAiDetail = $taskAiErrorBody.Substring(0, [Math]::Min(4096, $taskAiErrorBody.Length)) | ConvertFrom-Json
            if ($taskAiDetail.error.code -is [string] -and $taskAiDetail.error.code -cmatch '^[A-Z][A-Z0-9_]{0,79}$') {
                $taskAiStatus += " / $($taskAiDetail.error.code)"
                if ($taskAiDetail.error.message -is [string]) { $taskAiFailure = $taskAiDetail.error.message }
            }
        } catch { # Never dump an HTML error page or an arbitrary response body.
        }
    }
    throw "AI API test failed during '$taskAiStep' ($taskAiStatus): $taskAiFailure"
} finally {
    if ($taskAiLoggedIn) {
        try { Invoke-TaskAiJson "$taskAiApi/auth/logout" -Method Post -WebSession $taskAiSession -Headers $taskAiHeaders -TimeoutSec 20 | Out-Null }
        catch { Write-Warning 'Test session logout could not be confirmed.' }
    }
    $taskAiLoginBody = $null
    $taskAiPassword = $null
    $taskAiLogin = $null
    $taskAiHeaders = $null
    $taskAiSession = $null
}
