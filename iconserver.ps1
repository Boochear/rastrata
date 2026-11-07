Add-Type -AssemblyName System.Drawing
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)

while (($line = [Console]::In.ReadLine()) -ne $null) {
    $exe = $line.Trim()
    if (-not $exe) { continue }
    $b64 = ''
    $icon = $null; $bmp = $null; $ms = $null
    try {
        $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exe)
        $bmp = $icon.ToBitmap()
        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $b64 = [Convert]::ToBase64String($ms.ToArray())
    } catch { }
    finally {
        if ($ms) { $ms.Dispose() }
        if ($bmp) { $bmp.Dispose() }
        if ($icon) { $icon.Dispose() }
    }
    [Console]::Out.WriteLine($exe + "`t" + $b64)
    [Console]::Out.Flush()
}