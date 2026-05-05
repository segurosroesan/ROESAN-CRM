
$pdfPath = "APIS/SBS/SBS_WebService_Generales_CotizadorAutos V8.pdf"
$content = Get-Content -Path $pdfPath -Encoding Byte -Raw | ForEach-Object { [System.Text.Encoding]::UTF8.GetString($_) }
# Search for general quoting terms
$patterns = @("Cotizar", "CotizaAutos", "AIGAutos", "SOAPAction", "v_")
foreach ($p in $patterns) {
    Write-Host "--- Pattern: $p ---"
    $matches = $content | Select-String -Pattern "$p[A-Za-z0-9_]*" -AllMatches
    $matches.Matches.Value | Select-Object -Unique | Select-Object -First 10
}
