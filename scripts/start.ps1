$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (-not (Test-Path '.venv/Scripts/python.exe')) { throw 'Run the README setup commands first.' }
if (-not (Test-Path 'artifacts/model_report.json')) { throw 'Run python -m scripts.bootstrap first.' }
New-Item -ItemType Directory -Path '.local' -Force | Out-Null
function Test-LocalPort([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try { $client.Connect('127.0.0.1', $Port); return $true } catch { return $false } finally { $client.Dispose() }
}
if ((Test-LocalPort 8000) -or (Test-LocalPort 5173)) { throw 'Port 8000 or 5173 is occupied. The application may already be running.' }
$backendProcess = Start-Process -FilePath "$projectRoot/.venv/Scripts/python.exe" -ArgumentList '-m','uvicorn','backend.app.main:app','--host','127.0.0.1','--port','8000' -WorkingDirectory $projectRoot -RedirectStandardOutput "$projectRoot/.local/backend.log" -RedirectStandardError "$projectRoot/.local/backend-error.log" -WindowStyle Hidden -PassThru
$nodePath = (Get-Command node.exe).Source
$frontendProcess = Start-Process -FilePath $nodePath -ArgumentList 'node_modules/vite/bin/vite.js','--host','127.0.0.1','--strictPort' -WorkingDirectory "$projectRoot/frontend" -RedirectStandardOutput "$projectRoot/.local/frontend.log" -RedirectStandardError "$projectRoot/.local/frontend-error.log" -WindowStyle Hidden -PassThru
@{backend=$backendProcess.Id;frontend=$frontendProcess.Id} | ConvertTo-Json | Set-Content '.local/dev-pids.json'
Write-Output 'Meridian starting: http://localhost:5173 | API docs: http://localhost:8000/docs'
