
$file = Get-ChildItem "APIS/SBS/Cata*xlsx" | Select-Object -First 1
Write-Host "Reading file: $($file.FullName)"
$c = Get-Content -Path $file.FullName -Encoding Byte -Raw | ForEach-Object { [System.Text.Encoding]::UTF8.GetString($_) }
$i = $c.IndexOf("BOGOTA")
if ($i -ge 0) {
    $s = [Math]::Max(0, $i - 100)
    $l = [Math]::Min(500, $c.Length - $s)
    Write-Host $c.Substring($s, $l)
} else {
    Write-Host "BOGOTA not found"
}
