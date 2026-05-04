# start-dev.ps1

$Root = "C:\Users\HP\Desktop\zentra webrtc"

function Start-DevService {
    param (
        [string]$Title,
        [string]$Path,
        [string]$Command
    )

    $SafeTitle = $Title.Replace("'", "''")
    $SafePath = $Path.Replace("'", "''")

    Start-Process powershell.exe -ArgumentList @(
        "-NoExit",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "`$Host.UI.RawUI.WindowTitle = '$SafeTitle'; Write-Host '$SafeTitle' -ForegroundColor Cyan; cd '$SafePath'; $Command"
    )
}

# RAG API - Port 8001
Start-DevService `
    -Title "RAG API 8001" `
    -Path "$Root\backend\rag" `
    -Command "python -m uvicorn api:app --reload --host 0.0.0.0 --port 8001"

# Meal Generator API - Port 8000
Start-DevService `
    -Title "Meal Generator API 8000" `
    -Path "$Root\backend\mealgenerator\apps\api\" `
    -Command "python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

# Model Gateway API - Port 8010
Start-DevService `
    -Title "Model Gateway API 8010" `
    -Path "$Root\model_gateway" `
    -Command ".\.venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8010"

# Expo App
Start-DevService `
    -Title "Expo App" `
    -Path "$Root\zentra-main" `
    -Command "npm run dev:client"