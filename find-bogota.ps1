
$p = "APIS/SBS/Cataìlogo_CiudadMunicipio_Colombia (004).xlsx"
$c = Get-Content -Path $p -Encoding Byte -Raw | ForEach-Object { [System.Text.Encoding]::UTF8.GetString($_) }
$i = $c.IndexOf("BOGOTA")
if ($i -ge 0) {
    $s = [Math]::Max(0, $i - 100)
    $l = [Math]::Min(200, $c.Length - $s)
    Write-Host $c.Substring($s, $l)
} else {
    Write-Host "Not found"
}
