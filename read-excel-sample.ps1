
$excelPath = "APIS/SBS/Cataìlogo_CiudadMunicipio_Colombia (004).xlsx"
# Using Import-Excel if available, or just COM object if on Windows with Excel
# Since I'm on a win32 system, I might have Excel or can try to read as XML if it's .xlsx
# But the safest way to "read" without knowing the environment is to try and list sheets or use a generic approach.
# Actually, I'll just try to use a script that uses the OpenXML approach if possible or just report if it fails.

Add-Type -AssemblyName "Microsoft.Office.Interop.Excel" -ErrorAction SilentlyContinue
if ([type]::GetType("Microsoft.Office.Interop.Excel.ApplicationClass")) {
    $excel = New-Object -ComObject Excel.Application
    $workbook = $excel.Workbooks.Open((Resolve-Path $excelPath))
    $sheet = $workbook.Sheets.Item(1)
    Write-Host "--- Sheet 1 Sample ---"
    for ($i = 1; $i -le 10; $i++) {
        $row = ""
        for ($j = 1; $j -le 5; $j++) {
            $row += $sheet.Cells.Item($i, $j).Text + " | "
        }
        Write-Host $row
    }
    $workbook.Close($false)
    $excel.Quit()
} else {
    Write-Host "Excel Interop not available. Trying to list files in the directory to see if there are CSVs."
}
