# Generates frontend/public/og.png (1200x630), the static social-share card.
# Windows-only (GDI+). Keep this file UTF-8 WITH BOM or PowerShell 5.1 reads
# the Croatian diacritics as ANSI and draws mojibake.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$W = 1200; $H = 630
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

function C([string]$hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }
function U([string]$s) { [regex]::Unescape($s) }

$paper = C '#F6F4EF'; $ink = C '#16201E'; $brand = C '#00819C'
$deep  = C '#0B3D46'; $ochre = C '#B07D2B'; $muted = C '#6B6A63'
$line  = C '#CFC9BD'; $b200  = C '#BFDDE3'

$g.Clear($paper)

# Deep-teal utility band, echoing the site's top bar
$g.FillRectangle((New-Object System.Drawing.SolidBrush($deep)), 0, 0, $W, 64)
$fBand = New-Object System.Drawing.Font('Consolas', 16)
$g.DrawString((U ('SVEU' + 'ČILI' + 'ŠTE U ZAGREBU ' + '— FER')), $fBand,
  (New-Object System.Drawing.SolidBrush($b200)), 72, 21)
$g.DrawString('fer.unizg.hr', $fBand,
  (New-Object System.Drawing.SolidBrush($b200)), 985, 21)

$x = 72

# Mono uppercase kicker with an ochre tick, like the page headers
$g.FillRectangle((New-Object System.Drawing.SolidBrush($ochre)), $x, 152, 34, 5)
$fKick = New-Object System.Drawing.Font('Consolas', 21, [System.Drawing.FontStyle]::Bold)
$g.DrawString('PREPORUKA MENTORA', $fKick,
  (New-Object System.Drawing.SolidBrush($brand)), $x + 52, 138)

# Display title (Georgia stands in for Fraunces offline)
$fTitle = New-Object System.Drawing.Font('Georgia', 108, [System.Drawing.FontStyle]::Bold)
$g.DrawString('FERmentor', $fTitle,
  (New-Object System.Drawing.SolidBrush($deep)), $x - 10, 185)

# Tagline
$fTag = New-Object System.Drawing.Font('Segoe UI', 30)
$g.DrawString((U 'Pronađi mentora za svoj završni ili diplomski rad —'), $fTag,
  (New-Object System.Drawing.SolidBrush($ink)), $x - 4, 404)
$g.DrawString((U 'opiši temu, a mi predlažemo mentore na temelju radova.'), $fTag,
  (New-Object System.Drawing.SolidBrush($muted)), $x - 4, 458)

# Hairline + footer
$pen = New-Object System.Drawing.Pen($line, 2)
$g.DrawLine($pen, $x, 552, $W - $x, 552)
$fFoot = New-Object System.Drawing.Font('Consolas', 19)
$g.DrawString('fermentor.vercel.app', $fFoot,
  (New-Object System.Drawing.SolidBrush($brand)), $x - 2, 570)

$out = Join-Path $PSScriptRoot '..\frontend\public\og.png'
$g.Dispose()
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "saved $out"
