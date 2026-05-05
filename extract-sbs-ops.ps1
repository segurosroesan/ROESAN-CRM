
$pdfPath = "APIS/SBS/SBS_WebService_Generales_CotizadorAutos V8.pdf"
$content = Get-Content -Path $pdfPath -Encoding Byte -Raw | ForEach-Object { [System.Text.Encoding]::UTF8.GetString($_) }
# Look for SBSAutos_ patterns
$matches = $content | Select-String -Pattern "SBSAutos_[A-Za-z0-9_]+" -AllMatches
$matches.Matches.Value | Select-Object -Unique
