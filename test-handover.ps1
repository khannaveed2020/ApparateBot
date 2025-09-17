# PowerShell script to test handover functionality
$headers = @{
    "Content-Type" = "application/json"
}

$body = @{
    case = @{
        caseNumber = "789"
        severity = "B"
        is247 = $false
        title = "Network connectivity issue"
        description = "Users experiencing intermittent connectivity"
    }
    conversationRef = @{
        activityId = "test789"
        user = @{
            id = "test-user"
            name = "Test User"
            role = "user"
        }
        bot = @{
            id = "test-bot"
            name = "Bot"
            role = "bot"
        }
        conversation = @{
            id = "test-conv-789"
        }
        channelId = "emulator"
        locale = "en-US"
        serviceUrl = "http://localhost:14801"
    }
} | ConvertTo-Json -Depth 10

Write-Host "Testing handover with the following payload:"
Write-Host $body
Write-Host ""
Write-Host "Sending request to TABot..."

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3978/api/handover" -Method POST -Body $body -Headers $headers
    Write-Host "SUCCESS: Handover accepted"
    Write-Host "Response: $($response | ConvertTo-Json)"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
}