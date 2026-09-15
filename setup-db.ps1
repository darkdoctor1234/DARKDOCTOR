# Darkdoctor - First-time database setup
$python = "$PSScriptRoot\backend\venv_new\Scripts\python.exe"
$manage = "$PSScriptRoot\backend\manage.py"
$settings = "config.settings.development"

Write-Host "Running migrations..." -ForegroundColor Cyan
& $python $manage migrate --settings=$settings

Write-Host "Seeding super admin account..." -ForegroundColor Cyan
& $python $manage seed_superadmin --settings=$settings

Write-Host "Setup complete." -ForegroundColor Green
Write-Host "Super admin credentials are stored in backend\.env" -ForegroundColor Yellow
