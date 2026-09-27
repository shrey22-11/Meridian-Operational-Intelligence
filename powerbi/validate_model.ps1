# Uses Microsoft's installed Tabular Object Model parser; no connection or writes.
$ErrorActionPreference='Stop'
[System.Reflection.Assembly]::LoadFrom('C:/Program Files/Microsoft Power BI Desktop/bin/Microsoft.PowerBI.Tabular.dll') | Out-Null
$modelPath=Join-Path $PSScriptRoot 'Meridian.SemanticModel/model.bim'
$database=[Microsoft.AnalysisServices.Tabular.JsonSerializer]::DeserializeDatabase((Get-Content -LiteralPath $modelPath -Raw))
$measureCount=($database.Model.Tables | ForEach-Object {$_.Measures.Count} | Measure-Object -Sum).Sum
$result=[ordered]@{parser='Microsoft Tabular Object Model';status='passed';tables=$database.Model.Tables.Count;relationships=$database.Model.Relationships.Count;measures=$measureCount;note='Parses metadata; does not assert successful refresh or DAX evaluation.'}
$destination=Join-Path $PSScriptRoot '../reports/powerbi/model-parse-validation.json'
$result | ConvertTo-Json | Set-Content -LiteralPath $destination -Encoding utf8
$result | ConvertTo-Json
