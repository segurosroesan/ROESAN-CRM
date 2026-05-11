
$pdfPath = "APIS/SBS/SBS_WebService_Generales_CotizadorAutos V8.pdf"
$content = Get-Content -Path $pdfPath -Encoding Byte -Raw | ForEach-Object { [System.Text.Encoding]::UTF8.GetString($_) }
$patterns = @("idCiudad", "Ciudad", "DANE")
foreach ($p in $patterns) {
    Write-Host "--- Results for: $p ---"
    $matches = $content | Select-String -Pattern "$p" -AllMatches
    foreach ($m in $matches.Matches) {
        $start = [Math]::Max(0, $m.Index - 100)
        $len = [Math]::Min(300, $content.Length - $start)
        Write-Host $content.Substring($start, $len)
        Write-Host "----------------"
    }
}
