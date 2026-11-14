param([string]$InputPath, [string]$OutputPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$data = Get-Content -Raw -Encoding UTF8 -LiteralPath $InputPath | ConvertFrom-Json
$source = [System.Drawing.Bitmap]::new(600, 440)
$graphics = [System.Drawing.Graphics]::FromImage($source)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
foreach ($command in $data.commands) {
    $brush = $null
    if ($command.style -is [string]) {
        $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($command.style))
    } else {
        $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.Rectangle]::new(0, 0, 600, 440), [System.Drawing.Color]::Black, [System.Drawing.Color]::White, [single]90)
        $blend = [System.Drawing.Drawing2D.ColorBlend]::new($command.style.stops.Count)
        $blend.Positions = [single[]]@($command.style.stops | ForEach-Object { $_[0] })
        $blend.Colors = [System.Drawing.Color[]]@($command.style.stops | ForEach-Object { [System.Drawing.ColorTranslator]::FromHtml($_[1]) })
        $brush.InterpolationColors = $blend
    }
    switch ($command.kind) {
        'rect' { $graphics.FillRectangle($brush, [single]$command.x, [single]$command.y, [single]$command.w, [single]$command.h) }
        'circle' { $graphics.FillEllipse($brush, [single]($command.x - $command.r), [single]($command.y - $command.r), [single]($command.r * 2), [single]($command.r * 2)) }
        'polygon' {
            $points = [System.Drawing.PointF[]]@($command.points | ForEach-Object { [System.Drawing.PointF]::new([single]$_[0], [single]$_[1]) })
            $graphics.FillPolygon($brush, $points)
        }
    }
    $brush.Dispose()
}
$graphics.Dispose()
foreach ($layout in $data.layouts) {
    $resized = [System.Drawing.Bitmap]::new([int]$layout.image.width, [int]$layout.image.height)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
    $g.DrawImage($source, [System.Drawing.Rectangle]::new(0, 0, $resized.Width, $resized.Height))
    $g.Dispose()
    $raw = [byte[]]::new([int]($layout.width * $layout.height * 4))
    for ($y = 0; $y -lt $resized.Height; $y++) {
        for ($x = 0; $x -lt $resized.Width; $x++) {
            $color = $resized.GetPixel($x, $y)
            $index = (($y + $layout.image.y) * $layout.width + $x + $layout.image.x) * 4
            $raw[$index] = $color.R; $raw[$index + 1] = $color.G; $raw[$index + 2] = $color.B; $raw[$index + 3] = 255
        }
    }
    [System.IO.File]::WriteAllBytes((Join-Path $OutputPath ($layout.quality + '.rgba')), $raw)
    $resized.Dispose()
}
$source.Dispose()
