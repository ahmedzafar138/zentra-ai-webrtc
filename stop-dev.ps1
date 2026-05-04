# stop-dev.ps1
# Kills Zentra local development services by port.
# Ports:
# 8000 = Meal Generator API
# 8001 = RAG API
# 8002 = Optional fourth FastAPI server
# 8010 = Model Gateway API
# 8081 = Expo / Metro bundler

$Ports = @(8000, 8001, 8002, 8010, 8081)

Write-Host ""
Write-Host "Stopping Zentra development services..." -ForegroundColor Cyan
Write-Host ""

foreach ($Port in $Ports) {
    Write-Host "Checking port $Port..." -ForegroundColor Yellow

    $Connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

    if (-not $Connections) {
        Write-Host "No process found on port $Port." -ForegroundColor DarkGray
        continue
    }

    $ProcessIds = $Connections |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Where-Object { $_ -and $_ -ne 0 }

    foreach ($ProcessId in $ProcessIds) {
        try {
            $Process = Get-Process -Id $ProcessId -ErrorAction Stop
            Write-Host "Killing PID $ProcessId ($($Process.ProcessName)) on port $Port..." -ForegroundColor Red
            Stop-Process -Id $ProcessId -Force
            Write-Host "Killed process on port $Port." -ForegroundColor Green
        }
        catch {
            Write-Host "Could not kill PID $ProcessId on port $Port. It may already be stopped." -ForegroundColor DarkYellow
        }
    }
}

Write-Host ""
Write-Host "Done. Zentra development ports have been cleared." -ForegroundColor Cyan
Write-Host ""
