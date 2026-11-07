const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const { resolveName } = require('./app-names');

function startWatcher({ onAppChange, onNone }) {
    const scriptPath = path.join(process.cwd(), 'watcher.ps1');
    let ps = null;
    let stopped = false;
    let delay = 1000;

    function launch() {
        const startedAt = Date.now();
        const p = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
            windowsHide: true
        });
        ps = p;
        let dead = false;
        const rl = readline.createInterface({ input: p.stdout });
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
            const [appName, friendlyName, exePath, ...rest] = decoded.split('|');
            if (!appName) return;
            onAppChange(appName, resolveName(appName, friendlyName, exePath), exePath, rest.join('|'));
        });

        p.stderr.on('data', (data) => console.error('watcher error:', data.toString()));

        function onDead(code) {
            if (dead) return;
            dead = true;
            if (ps === p) ps = null;
            console.warn('watcher exited with code', code);
            if (stopped) return;
            onNone();
            delay = Date.now() - startedAt > 30000 ? 1000 : Math.min(delay * 2, 30000);
            setTimeout(launch, delay);
        }
        p.on('exit', onDead);
        p.on('error', () => onDead('spawn error'));
    }

    launch();

    const stop = () => {
        stopped = true;
        try { if (ps) ps.kill(); } catch { }
    };
    process.on('exit', stop);

    return { stop };
}

module.exports = { startWatcher };