Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\BazZTee\.gemini\antigravity\brain\de34c627-732b-44cd-801d-0900268b3271\.user_uploaded\media_1787861340038.png"
$outPng = "c:\Users\BazZTee\Downloads\SWG Mod Setup Tool\build\icon.png"

$orig = [System.Drawing.Bitmap]::FromFile($srcPath)
$width = 512
$height = 512

$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Fill Dark Slate Background
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 11, 15, 23))
$g.FillRectangle($bgBrush, 0, 0, $width, $height)

# Draw Electric Blue Border Box / Glow
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 0, 153, 255), 12)
$g.DrawRoundedRectangle = $false
$g.DrawRectangle($pen, 12, 12, $width - 24, $height - 24)

# Create Inverted White Logo from original
$tempImg = New-Object System.Drawing.Bitmap($orig.Width, $orig.Height)
for ($x = 0; $x -lt $orig.Width; $x++) {
    for ($y = 0; $y -lt $orig.Height; $y++) {
        $pixel = $orig.GetPixel($x, $y)
        # If dark pixel (black text/hookah) -> make white
        if ($pixel.A -gt 30 -and ($pixel.R -lt 150 -and $pixel.G -lt 150 -and $pixel.B -lt 150)) {
            $tempImg.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($pixel.A, 255, 255, 255))
        } else {
            $tempImg.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        }
    }
}

# Draw white SWG logo scaled centered inside rectangle
$targetW = 440
$targetH = [int]($orig.Height * ($targetW / $orig.Width))
$targetX = [int](($width - $targetW) / 2)
$targetY = [int](($height - $targetH) / 2)

$g.DrawImage($tempImg, $targetX, $targetY, $targetW, $targetH)

$g.Dispose()
$orig.Dispose()
$tempImg.Dispose()

$bmp.Save($outPng, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host "Processed SWG Logo successfully!"
