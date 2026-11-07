Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$src = @'
using System;
using System.Runtime.InteropServices;
public class Win32Fg {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
}
'@

$sha = [System.Security.Cryptography.SHA1]::Create()
$h = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($src)))).Replace('-', '').Substring(0, 12)
$dll = Join-Path $env:TEMP "rastrata-urlreader-$h.dll"
$loaded = $false
if (Test-Path $dll) { try { Add-Type -Path $dll; $loaded = $true } catch { } }
if (-not $loaded) {
    try { Add-Type -TypeDefinition $src -OutputAssembly $dll; Add-Type -Path $dll; $loaded = $true } catch { }
}
if (-not $loaded) { Add-Type -TypeDefinition $src }

[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$script:cache = @{}

function Read-Value($el) {
    $pat = $null
    if (-not $el.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pat)) { return $null }
    $v = $pat.Current.Value
    if ([string]::IsNullOrWhiteSpace($v)) { return $null }
    return $v.Trim()
}

function Get-Address {
    $hwnd = [Win32Fg]::GetForegroundWindow()
    if ($hwnd -eq [IntPtr]::Zero) { return $null }
    $key = $hwnd.ToInt64()
    if ($script:cache.ContainsKey($key)) {
        try {
            $v = Read-Value $script:cache[$key]
            if ($v) { return $v }
        } catch { }
        $script:cache.Remove($key)
    }
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
    $scope = [System.Windows.Automation.TreeScope]::Descendants
    $cond = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ClassNameProperty, 'OmniboxViewViews')
    $el = $root.FindFirst($scope, $cond)
    if (-not $el) {
        $cond = New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 'urlbar-input')
        $el = $root.FindFirst($scope, $cond)
    }
    if (-not $el) {
        $edit = New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::Edit)
        $win = $root.Current.BoundingRectangle
        foreach ($e in $root.FindAll($scope, $edit)) {
            $r = $e.Current.BoundingRectangle
            if (($r.Top - $win.Top) -gt ($win.Height * 0.2)) { continue }
            $p = $null
            if ($e.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$p)) {
                $el = $e
                break
            }
        }
    }

    if (-not $el) { return $null }
    $v = Read-Value $el
    if ($v) {
        if ($script:cache.Count -gt 16) { $script:cache.Clear() }
        $script:cache[$key] = $el
    }
    return $v
}

while (($line = [Console]::In.ReadLine()) -ne $null) {
    if ($line.Trim() -eq 'get') {
        $v = $null
        try { $v = Get-Address } catch { }
        if ($v) { [Console]::Out.WriteLine('url|' + $v) } else { [Console]::Out.WriteLine('none') }
        [Console]::Out.Flush()
    }
}