param(
    [Parameter(Mandatory=$true)][int]$Port,
    [Parameter(Mandatory=$true)][string]$QueryFile,
    [Parameter(Mandatory=$true)][string]$OutputFile
)
# Read-only DAX queries against the already-open Meridian Desktop model.
$ErrorActionPreference='Stop'
$pbiBin='C:/Program Files/Microsoft Power BI Desktop/bin'
[System.Reflection.Assembly]::LoadFrom("$pbiBin/Microsoft.PowerBI.AdomdClient.dll") | Out-Null
$connection=[Microsoft.AnalysisServices.AdomdClient.AdomdConnection]::new("Data Source=localhost:$Port")
try {
    $connection.Open()
    $command=$connection.CreateCommand()
    $command.CommandText=Get-Content -LiteralPath $QueryFile -Raw
    $command.CommandTimeout=60
    $reader=$command.ExecuteReader()
    $rows=[System.Collections.Generic.List[object]]::new()
    while($reader.Read()) {
        $row=[ordered]@{}
        for($i=0;$i -lt $reader.FieldCount;$i++) {
            $row[$reader.GetName($i)]=if($reader.IsDBNull($i)){$null}else{$reader.GetValue($i)}
        }
        $rows.Add($row)
    }
    $reader.Close()
    ConvertTo-Json -InputObject @($rows.ToArray()) -Depth 10 | Set-Content -LiteralPath $OutputFile -Encoding utf8
    Write-Output "Saved $($rows.Count) DAX result rows to $OutputFile"
} finally {$connection.Close()}
