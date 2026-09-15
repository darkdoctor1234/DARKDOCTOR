# Darkdoctor - Start Development Servers
Write-Host "Starting Darkdoctor development servers..." -ForegroundColor Cyan

# Start Django backend
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$PSScriptRoot\backend'; & '$PSScriptRoot\backend\venv_new\Scripts\python.exe' manage.py runserver --settings=config.settings.development"
) -WindowStyle Normal

# Start Next.js frontend
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$PSScriptRoot\frontend'; npm run dev"
) -WindowStyle Normal

Write-Host "Backend:  http://localhost:8000" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "Admin:    http://localhost:3000/admin" -ForegroundColor Yellow
Write-Host "SuperAdmin: http://localhost:3000/superadmin" -ForegroundColor Yellow
