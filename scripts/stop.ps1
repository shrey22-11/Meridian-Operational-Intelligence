$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $projectRoot '.local/dev-pids.json'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Output 'No recorded app processes.'; exit }
$processIds = Get-Content -LiteralPath $pidFile | ConvertFrom-Json
foreach ($kind in @('backend','frontend')) {
    $processId = $processIds.$kind
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
    # Never stop a reused PID unless its command line identifies our application.
    $matches = if ($kind -eq 'backend') { $proc.CommandLine -match 'uvicorn.+backend.app.main:app' -and $proc.ExecutablePath -eq "$projectRoot\.venv\Scripts\python.exe" } else { $proc.CommandLine -match 'node_modules/vite/bin/vite.js' }
    if ($proc -and $matches) { Stop-Process -Id $processId; Write-Output "Stopped $kind." }
}
Write-Output 'PostgreSQL and Ollama remain available. Stop the private database separately if desired.'
