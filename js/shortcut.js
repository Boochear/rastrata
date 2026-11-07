const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const APP_NAME = 'Rastrata';

function createPosixShortcut() {
    try {
        const desktop = path.join(os.homedir(), 'Desktop');
        fs.mkdirSync(desktop, { recursive: true });
        if (process.platform === 'darwin') {
            const link = path.join(desktop, APP_NAME);
            fs.rmSync(link, { force: true });
            fs.symlinkSync(process.execPath, link);
        } else {
            const file = path.join(desktop, `${APP_NAME}.desktop`);
            fs.writeFileSync(file, `[Desktop Entry]\nType=Application\nName=${APP_NAME}\nExec="${process.execPath}"\nTerminal=false\n`);
            fs.chmodSync(file, 0o755);
        }
        return true;
    } catch (err) {
        console.error('shortcut creation failed:', err.message);
        return false;
    }
}

function createDesktopShortcut() {
    if (process.platform !== 'win32') return Promise.resolve(createPosixShortcut());
    return new Promise((resolve) => {
        const exePath = process.execPath;
        const workingDir = path.dirname(exePath);
        const desktop = path.join(os.homedir(), 'Desktop');
        const shortcutPath = path.join(desktop, `${APP_NAME}.lnk`);
        const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
        const psScript = `
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut(${q(shortcutPath)})
$Shortcut.TargetPath = ${q(exePath)}
$Shortcut.WorkingDirectory = ${q(workingDir)}
$Shortcut.IconLocation = ${q(exePath + ', 0')}
$Shortcut.Save()
`.trim();
        const tmpFile = path.join(os.tmpdir(), 'create-shortcut.ps1');
        const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
        const contentBuffer = Buffer.concat([BOM, Buffer.from(psScript, 'utf-8')]);
        fs.writeFileSync(tmpFile, contentBuffer);
        execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmpFile],
            { windowsHide: true }, (err, stdout, stderr) => {
                fs.unlink(tmpFile, () => { });
                if (err) console.error('shortcut creation failed:', stderr || err.message);
                resolve(!err);
            });
    });
}

module.exports = { createDesktopShortcut };