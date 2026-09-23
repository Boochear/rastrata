const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const ICONS_FILE = path.join(process.cwd(), 'icons.json');

function loadIcons() {
    try {
        return JSON.parse(fs.readFileSync(ICONS_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

function saveIcons(icons) {
    const tmpPath = ICONS_FILE + '.tmp';
    try {
        fs.writeFileSync(tmpPath, JSON.stringify(icons, null, 2));
        fs.renameSync(tmpPath, ICONS_FILE);
    } catch (err) {
        console.error('failed to save icons:', err.message);
    }
}

function createIconRequester(icons, onIconReady) {
    const inFlight = new Set();

    return function requestIcon(appName, exePath) {
        if (!exePath || icons[appName] || inFlight.has(appName)) return;
        inFlight.add(appName);

        const psScript = `
Add-Type -AssemblyName System.Drawing
try {
  $icon = [System.Drawing.Icon]::ExtractAssociatedIcon("${exePath}")
  $bmp = $icon.ToBitmap()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  [Convert]::ToBase64String($ms.ToArray())
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
}
`.trim();

        const tmpFile = path.join(os.tmpdir(), `icon-${appName}.ps1`);
        fs.writeFileSync(tmpFile, psScript, 'utf-8');

        exec(
            `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
            { maxBuffer: 1024 * 1024 * 10 },
            (err, stdout, stderr) => {
                inFlight.delete(appName);
                fs.unlink(tmpFile, () => { });
                if (err || !stdout.trim()) {
                    if (stderr) console.error('icon extraction failed for', appName, stderr);
                    return;
                }
                icons[appName] = 'data:image/png;base64,' + stdout.trim();
                saveIcons(icons);
                onIconReady();
            }
        );
    };
}

module.exports = { loadIcons, saveIcons, createIconRequester };