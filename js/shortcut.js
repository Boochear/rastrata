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
        const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
        const contentBuffer = Buffer.concat([BOM, Buffer.from(psScript, 'utf-8')]);
        fs.writeFileSync(tmpFile, contentBuffer);

        exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`, (err, stdout, stderr) => {
            fs.unlink(tmpFile, () => { });
            if (err) console.error('shortcut creation failed:', stderr || err.message);
            resolve(!err);
        });
    });
}

module.exports = { createDesktopShortcut };