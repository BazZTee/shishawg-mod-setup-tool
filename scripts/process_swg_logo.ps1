Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\BazZTee\.gemini\antigravity\brain\de34c627-732b-44cd-801d-0900268b3271\.user_uploaded\media_1787861340038.png"
$outPng = "c:\Users\BazZTee\Downloads\SWG Mod Setup Tool\build\icon.png"
$outPngLarge = "c:\Users\BazZTee\Downloads\SWG Mod Setup Tool\build\ShishaWG_Mod_Tool_Logo_512x512.png"

$orig = [System.Drawing.Bitmap]::FromFile($srcPath)
$width = 512
$height = 512

$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# Fill Dark Slate Background
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 11, 15, 23))
$g.FillRectangle($bgBrush, 0, 0, $width, $height)

# Draw Electric Blue Border Rectangle
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 0, 153, 255), 10)
$g.DrawRectangle($pen, 12, 12, $width - 24, $height - 24)

# Create Inverted White Logo from original
$tempImg = New-Object System.Drawing.Bitmap($orig.Width, $orig.Height)
for ($x = 0; $x -lt $orig.Width; $x++) {
    for ($y = 0; $y -lt $orig.Height; $y++) {
        $pixel = $orig.GetPixel($x, $y)
        if ($pixel.A -gt 30 -and ($pixel.R -lt 150 -and $pixel.G -lt 150 -and $pixel.B -lt 150)) {
            $tempImg.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($pixel.A, 255, 255, 255))
        } else {
            $tempImg.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        }
    }
}

# Draw white SWG logo positioned slightly higher to leave space for "MOD TOOL"
$targetW = 420
$targetH = [int]($orig.Height * ($targetW / $orig.Width))
$targetX = [int](($width - $targetW) / 2)
$targetY = 40

$g.DrawImage($tempImg, $targetX, $targetY, $targetW, $targetH)

# Draw "MOD TOOL" Subtitle in Neon Cyan Blue
$font = New-Object System.Drawing.Font("Segoe UI", 38, [System.Drawing.FontStyle]::Bold)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 56, 189, 248))
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center

$g.DrawString("M O D   T O O L", $font, $textBrush, [float]($width / 2), [float]($targetY + $targetH + 10), $sf)

$g.Dispose()
$orig.Dispose()
$tempImg.Dispose()

$bmp.Save($outPng, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save($outPngLarge, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host "Processed SWG Logo with MOD TOOL subtitle successfully!"
