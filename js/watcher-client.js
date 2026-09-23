const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

function startWatcher({ onAppChange, onNone }) {
    const scriptPath = path.join(process.cwd(), 'watcher.ps1');
    const ps = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
        windowsHide: true
    });

    const rl = readline.createInterface({ input: ps.stdout });

    rl.on('line', (line) => {
        line = line.trim();
        if (!line) return;

        if (line === 'none') {
            onNone();
            return;
        }

        let decoded;
        try {
            decoded = Buffer.from(line, 'base64').toString('utf8');
        } catch {
            return;
        }

        const [appName, friendlyName, exePath] = decoded.split('|');
        if (!appName) return;
        onAppChange(appName, friendlyName, exePath);
    });

    ps.stderr.on('data', (data) => console.error('watcher error:', data.toString()));
    ps.on('exit', (code) => console.warn('watcher exited with code', code));

    return ps;
}

module.exports = { startWatcher };