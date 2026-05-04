# start-dev.ps1

$Root = "C:\Users\HP\Desktop\zentra webrtc"

function Start-DevService {
    param (
        [string]$Title,
        [string]$Path,
        [string]$Command
    )

    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Write-Host '$Title' -ForegroundColor Cyan; cd '$Path'; $Command"
    )
}

# RAG API - Port 8001
Start-DevService `
    -Title "Starting RAG API on port 8001" `
    -Path "$Root\backend\rag" `
    -Command "uvicorn api:app --reload --host 0.0.0.0 --port 8001"

# Meal Generator API - Port 8000
Start-DevService `
    -Title "Starting Meal Generator API on port 8000" `
    -Path "$Root\backend\meal_generator" `
    -Command ".\.venv\Scripts\Activate.ps1; cd apps\api\; uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

# Model Gateway API - Port 8010
Start-DevService `
    -Title "Starting Model Gateway API on port 8010" `
    -Path "$Root\model_gateway" `
    -Command ".\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --host 0.0.0.0 --port 8010"

# Expo App
Start-DevService `
    -Title "Starting Expo App" `
    -Path "$Root\zentra-main" `
    -Command "npm run dev:client"