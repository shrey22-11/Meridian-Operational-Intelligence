param([int]$Scale = 10)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$privateJava = Get-ChildItem '.local/java17' -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if ($privateJava) { $env:JAVA_HOME=$privateJava.FullName }
if (-not $env:JAVA_HOME) { throw 'Set JAVA_HOME to a Java 17 installation. See README.' }
$env:PATH = "$env:JAVA_HOME/bin;$env:PATH"
& '.venv/Scripts/python.exe' 'spark_jobs/aggregate.py' '--scale' $Scale
if ($LASTEXITCODE -ne 0) { throw 'Spark job failed. See the diagnostic output.' }
& '.venv/Scripts/python.exe' '-m' 'scripts.verify_spark'
if ($LASTEXITCODE -ne 0) { throw 'Spark reconciliation failed.' }
