
$pdfPath = "APIS/SBS/SBS_WebService_Generales_CotizadorAutos V8.pdf"
$content = Get-Content -Path $pdfPath -Encoding Byte -Raw | ForEach-Object { [System.Text.Encoding]::UTF8.GetString($_) }

# Search for the string "09008205" (Toyota Hilux Fasecolda from email)
$index = $content.IndexOf("09008205")
if ($index -ge 0) {
    Write-Host "Found Fasecolda 09008205 at index $index"
    $start = [Math]::Max(0, $index - 1000)
    $length = [Math]::Min(2000, $content.Length - $start)
    $context = $content.Substring($start, $length)
    Write-Host "--- Context around Fasecolda ---"
    Write-Host $context
} else {
    Write-Host "Fasecolda 09008205 not found"
}
