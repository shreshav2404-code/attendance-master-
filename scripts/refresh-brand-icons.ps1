$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$imagesPath = 'D:\attendence master\assets\images'

function New-RectF {
    param(
        [float]$x,
        [float]$y,
        [float]$w,
        [float]$h
    )
    return New-Object System.Drawing.RectangleF($x, $y, $w, $h)
}

function Get-Canvas {
    param([int]$size)

    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    return @{
        Bitmap = $bmp
        Graphics = $g
    }
}

function Draw-LogoSymbol {
    param(
        [System.Drawing.Graphics]$g,
        [int]$size,
        [float]$scale = 0.64
    )

    $symbolSize = [float]($size * $scale)
    $x = [float](($size - $symbolSize) / 2)
    $y = [float](($size - $symbolSize) / 2 - ($size * 0.05))

    $outer = New-RectF -x $x -y $y -w $symbolSize -h $symbolSize
    $inner = New-RectF -x ($x + ($symbolSize * 0.025)) -y ($y + ($symbolSize * 0.025)) -w ($symbolSize * 0.95) -h ($symbolSize * 0.95)

    $symbolFill = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $outer,
        [System.Drawing.Color]::FromArgb(255, 38, 117, 201),
        [System.Drawing.Color]::FromArgb(255, 15, 45, 85),
        45.0
    )
    $g.FillEllipse($symbolFill, $outer)
    $symbolFill.Dispose()

    $gloss = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $inner,
        [System.Drawing.Color]::FromArgb(70, 255, 255, 255),
        [System.Drawing.Color]::FromArgb(0, 255, 255, 255),
        90.0
    )
    $g.FillEllipse($gloss, $inner)
    $gloss.Dispose()

    $ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(225, 232, 244, 255), [float]($size * 0.012))
    $g.DrawEllipse($ringPen, $outer)
    $ringPen.Dispose()

    $fontSize = [float]($size * 0.22)
    $font = New-Object System.Drawing.Font('Segoe UI Semibold', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(85, 0, 0, 0))
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 255, 255, 255))

    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center

    $label = 'AX'
    $textRect = New-RectF -x $x -y ($y + ($symbolSize * 0.03)) -w $symbolSize -h $symbolSize
    $shadowRect = New-RectF -x ($textRect.X + ($size * 0.007)) -y ($textRect.Y + ($size * 0.007)) -w $textRect.Width -h $textRect.Height

    $g.DrawString($label, $font, $shadowBrush, $shadowRect, $fmt)
    $g.DrawString($label, $font, $textBrush, $textRect, $fmt)

    $font.Dispose()
    $shadowBrush.Dispose()
    $textBrush.Dispose()
    $fmt.Dispose()
}

function Save-AppIcon {
    param([string]$outPath)

    $size = 1024
    $canvas = Get-Canvas -size $size
    $bmp = $canvas.Bitmap
    $g = $canvas.Graphics

    $bgRect = New-RectF -x 0 -y 0 -w $size -h $size
    $bgGradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $bgRect,
        [System.Drawing.Color]::FromArgb(255, 10, 15, 30),
        [System.Drawing.Color]::FromArgb(255, 15, 45, 85),
        35.0
    )
    $g.FillRectangle($bgGradient, $bgRect)
    $bgGradient.Dispose()

    $accentRect = New-RectF -x 60 -y 40 -w 900 -h 380
    $accent = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $accentRect,
        [System.Drawing.Color]::FromArgb(65, 124, 58, 237),
        [System.Drawing.Color]::FromArgb(0, 124, 58, 237),
        90.0
    )
    $g.FillEllipse($accent, $accentRect)
    $accent.Dispose()

    Draw-LogoSymbol -g $g -size $size -scale 0.62

    $tagFont = New-Object System.Drawing.Font('Segoe UI', 78, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $tagBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 233, 244, 255))
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $tagRect = New-RectF -x 0 -y 820 -w $size -h 120
    $g.DrawString('AttendX', $tagFont, $tagBrush, $tagRect, $fmt)

    $fmt.Dispose()
    $tagBrush.Dispose()
    $tagFont.Dispose()

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

function Save-ForegroundIcon {
    param([string]$outPath)

    $size = 1024
    $canvas = Get-Canvas -size $size
    $bmp = $canvas.Bitmap
    $g = $canvas.Graphics

    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    Draw-LogoSymbol -g $g -size $size -scale 0.75

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

function Save-Favicon {
    param([string]$outPath)

    $size = 48
    $canvas = Get-Canvas -size $size
    $bmp = $canvas.Bitmap
    $g = $canvas.Graphics

    $bg = New-RectF -x 0 -y 0 -w $size -h $size
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $bg,
        [System.Drawing.Color]::FromArgb(255, 10, 15, 30),
        [System.Drawing.Color]::FromArgb(255, 15, 45, 85),
        45.0
    )
    $g.FillRectangle($bgBrush, $bg)
    $bgBrush.Dispose()

    $discRect = New-RectF -x 4 -y 4 -w 40 -h 40
    $discBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $discRect,
        [System.Drawing.Color]::FromArgb(255, 38, 117, 201),
        [System.Drawing.Color]::FromArgb(255, 15, 45, 85),
        45.0
    )
    $g.FillEllipse($discBrush, $discRect)
    $discBrush.Dispose()

    $ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(230, 230, 242, 255), 1.7)
    $g.DrawEllipse($ringPen, $discRect)
    $ringPen.Dispose()

    $font = New-Object System.Drawing.Font('Segoe UI Semibold', 17, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 255, 255, 255))
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    $textRect = New-RectF -x 4 -y 6 -w 40 -h 36
    $g.DrawString('A', $font, $brush, $textRect, $fmt)

    $fmt.Dispose()
    $brush.Dispose()
    $font.Dispose()

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

Save-AppIcon -outPath (Join-Path $imagesPath 'icon.png')
Save-ForegroundIcon -outPath (Join-Path $imagesPath 'adaptive-icon.png')
Save-ForegroundIcon -outPath (Join-Path $imagesPath 'splash-icon.png')
Save-Favicon -outPath (Join-Path $imagesPath 'favicon.png')

Write-Output 'updated icon.png, adaptive-icon.png, splash-icon.png, favicon.png'
