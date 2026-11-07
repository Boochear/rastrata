const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const IDLE_MS = 5 * 60 * 1000;

function startUrlReader(onValue) {
    if (process.platform !== 'win32') return null;
    const script = path.join(process.cwd(), 'urlreader.ps1');
    let ps = null;
    let stopped = false;
    let failed = false;
    let busy = false;
    let again = false;
    let busyTimer = null;
    let idleTimer = null;

    function spawnPs() {
        const p = spawn('powershell', [
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script
        ], { windowsHide: true });
        const rl = readline.createInterface({ input: p.stdout });
        rl.on('line', (line) => {
            busy = false;
            if (line.startsWith('url|')) onValue(line.slice(4).trim());
            if (again) {
                again = false;
                setTimeout(send, 400);
            }
        });
        p.stderr.on('data', () => { });
        p.stdin.on('error', () => { });
        p.on('error', () => { if (ps === p) { ps = null; failed = true; } });
        p.on('exit', () => {
            if (ps === p) { ps = null; busy = false; clearTimeout(busyTimer); }
        });
        return p;
    }

    function killPs() {
        clearTimeout(idleTimer);
        clearTimeout(busyTimer);
        busy = false;
        again = false;
        if (ps) {
            const p = ps;
            ps = null;
            try { p.kill(); } catch { }
        }
    }

    function send() {
        if (stopped || failed) return;
        if (busy) {
            again = true;
            return;
        }
        if (!ps) ps = spawnPs();
        busy = true;
        clearTimeout(busyTimer);
        busyTimer = setTimeout(() => { busy = false; }, 4000);
        try { ps.stdin.write('get\n'); } catch { }
        clearTimeout(idleTimer);
        idleTimer = setTimeout(killPs, IDLE_MS);
    }

    return {
        get available() { return !stopped && !failed; },
        request: send,
        stop() {
            stopped = true;
            killPs();
        }
    };
}

module.exports = { startUrlReader };