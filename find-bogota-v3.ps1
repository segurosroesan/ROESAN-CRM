
$file = Get-ChildItem "APIS/SBS/Cata*xlsx" | Select-Object -First 1
$c = Get-Content -Path $file.FullName -Encoding Byte -Raw | ForEach-Object { [System.Text.Encoding]::UTF8.GetString($_) }
$patterns = @("BOGOTA", "BOGOTÁ", "Bogota", "Bogotá")
foreach ($p in $patterns) {
    $i = $c.IndexOf($p)
    if ($i -ge 0) {
        Write-Host "Found $p at $i"
        $s = [Math]::Max(0, $i - 50)
        $l = [Math]::Min(200, $c.Length - $s)
        Write-Host $c.Substring($s, $l)
    }
}
