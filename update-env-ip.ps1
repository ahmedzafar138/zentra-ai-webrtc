# update-env-ip.ps1
# Automatically updates frontend .env API URLs with the current laptop IPv4 address.

param (
    [string]$FrontendPath = "C:\Users\HP\Desktop\zentra JJ\zentra-main"
)

Write-Host ""
Write-Host "Detecting current IPv4 address..." -ForegroundColor Cyan

$ActiveIp = Get-NetIPConfiguration |
    Where-Object {
        $_.IPv4DefaultGateway -ne $null -and
        $_.NetAdapter.Status -eq "Up"
    } |
    ForEach-Object {
        $_.IPv4Address | Where-Object {
            $_.IPAddress -notmatch "^127\." -and
            $_.IPAddress -notmatch "^169\.254\."
        }
    } |
    Select-Object -First 1 -ExpandProperty IPAddress

if (-not $ActiveIp) {
    Write-Host "Could not detect active IPv4 address." -ForegroundColor Red
    exit 1
}

Write-Host "Detected IP: $ActiveIp" -ForegroundColor Green

$EnvFilePath = Join-Path $FrontendPath ".env"

if (!(Test-Path $FrontendPath)) {
    Write-Host "Frontend path does not exist: $FrontendPath" -ForegroundColor Red
    exit 1
}

if (!(Test-Path $EnvFilePath)) {
    Write-Host ".env file not found. Creating new one at: $EnvFilePath" -ForegroundColor Yellow
    New-Item -ItemType File -Path $EnvFilePath -Force | Out-Null
}

$Updates = @{
    "EXPO_PUBLIC_RAG_API_BASE_URL"             = "http://${ActiveIp}:8001"
    "EXPO_PUBLIC_MEAL_GENERATOR_API_BASE_URL" = "http://${ActiveIp}:8000"
    "EXPO_PUBLIC_MODEL_GATEWAY_API_BASE_URL"  = "http://${ActiveIp}:8010"
}

$Content = Get-Content $EnvFilePath -ErrorAction SilentlyContinue

foreach ($Key in $Updates.Keys) {
    $Value = $Updates[$Key]
    $Pattern = "^$([regex]::Escape($Key))=.*$"
    $NewLine = "$Key=$Value"

    if ($Content -match $Pattern) {
        $Content = $Content | ForEach-Object {
            if ($_ -match $Pattern) {
                $NewLine
            } else {
                $_
            }
        }
    } else {
        $Content += $NewLine
    }
}

Set-Content -Path $EnvFilePath -Value $Content -Encoding UTF8

Write-Host ""
Write-Host ".env updated successfully:" -ForegroundColor Green
Write-Host "RAG API:             http://${ActiveIp}:8001"
Write-Host "Meal Generator API:  http://${ActiveIp}:8000"
Write-Host "Model Gateway API:   http://${ActiveIp}:8010"
Write-Host ""