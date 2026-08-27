Add-Type -AssemblyName System.Drawing
$pngPath = "c:\Users\BazZTee\Downloads\SWG Mod Setup Tool\build\icon.png"
$tmpPath = "c:\Users\BazZTee\Downloads\SWG Mod Setup Tool\build\icon_tmp.png"
$icoPath = "c:\Users\BazZTee\Downloads\SWG Mod Setup Tool\build\icon.ico"

$img = [System.Drawing.Image]::FromFile($pngPath)
$img.Save($tmpPath, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()

Remove-Item -Force $pngPath
Move-Item -Force $tmpPath $pngPath
Write-Host "Converted PNG successfully!"
