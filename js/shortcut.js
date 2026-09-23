const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const APP_NAME = 'Rastrata';

function createDesktopShortcut() {
    return new Promise((resolve) => {
        const exePath = process.execPath;
        const workingDir = path.dirname(exePath);
        const desktop = path.join(os.homedir(), 'Desktop');
        const shortcutPath = path.join(desktop, `${APP_NAME}.lnk`);

        const psScript = `
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("${shortcutPath}")
$Shortcut.TargetPath = "${exePath}"
$Shortcut.WorkingDirectory = "${workingDir}"
$Shortcut.IconLocation = "${exePath}, 0"
$Shortcut.Save()
`.trim();

        const tmpFile = path.join(os.tmpdir(), 'create-shortcut.ps1');
        fs.writeFileSync(tmpFile, psScript, 'utf-8');

        exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`, (err, stdout, stderr) => {
            fs.unlink(tmpFile, () => { });
            if (err) console.error('shortcut creation failed:', stderr || err.message);
            resolve(!err);
        });
    });
}

module.exports = { createDesktopShortcut };