const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

function startUrlReader(onValue) {
    if (process.platform !== 'win32') return null;

    const ps = spawn('powershell', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', path.join(process.cwd(), 'urlreader.ps1')
    ], { windowsHide: true });

    let alive = true;
    let busy = false;
    let again = false;

    function send() {
        if (!alive) return;
        if (busy) {
            again = true;
            return;
        }
        busy = true;
        setTimeout(() => { busy = false; }, 4000);
        ps.stdin.write('get\n');
    }

    const rl = readline.createInterface({ input: ps.stdout });
    rl.on('line', (line) => {
        busy = false;
        if (line.startsWith('url|')) onValue(line.slice(4).trim());
        if (again) {
            again = false;
            setTimeout(send, 400);
        }
    });

    ps.stderr.on('data', () => { });
    ps.stdin.on('error', () => { alive = false; });
    ps.on('error', () => { alive = false; });
    ps.on('exit', () => { alive = false; });

    return {
        get available() { return alive; },
        request: send,
        stop() {
            alive = false;
            try { ps.kill(); } catch { }
        }
    };
}

module.exports = { startUrlReader };
