
Add-Type -AssemblyName System.Web
$pdfPath = "APIS/SBS/SBS_WebService_Generales_CotizadorAutos V8.pdf"
# Try to extract strings from the binary file as a fallback if no PDF library is available
# Or just look for URLs and key terms using strings-like approach
Get-Content -Path $pdfPath -Encoding Byte -Raw | 
    ForEach-Object { [System.Text.Encoding]::UTF8.GetString($_) } | 
    Select-String -Pattern "http[s]?://[^\s\""<>]+" -AllMatches | 
    ForEach-Object { $_.Matches.Value }
