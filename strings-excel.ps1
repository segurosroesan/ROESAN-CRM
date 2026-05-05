
$excelPath = "APIS/SBS/Configuracion_Paquetes_CotizadorWeb1.xlsx"
Get-Content -Path $excelPath -Encoding Byte -Raw | ForEach-Object { [System.Text.Encoding]::UTF8.GetString($_) } | 
    Select-String -Pattern "[A-Za-z0-9 ]{4,20}" -AllMatches | 
    ForEach-Object { $_.Matches.Value } | Select-Object -Unique | Select-Object -First 50
