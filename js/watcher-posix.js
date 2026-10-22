const fs = require('fs');
const { execFile } = require('child_process');
const { isBrowser } = require('./sites');

const MAC_SCRIPT = `tell application "System Events"
set p to first application process whose frontmost is true
set t to ""
try
set t to name of front window of p
end try
set e to ""
try
set e to POSIX path of (file of p)
end try
return (name of p) & "|" & (unix id of p) & "|" & e & "|" & t
end tell`;

function run(cmd, args) {
    return new Promise((resolve) => {
        execFile(cmd, args, { timeout: 2500 }, (err, out) => resolve(err ? '' : String(out).trim()));
    });
}

async function pollLinux() {
    const id = await run('xdotool', ['getactivewindow']);
    if (!id) return null;
    const pid = await run('xdotool', ['getwindowpid', id]);
    if (!pid) return null;
    const title = await run('xdotool', ['getwindowname', id]);
    let name = '';
    let exe = '';
    try { name = fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim(); } catch { }
    try { exe = fs.readlinkSync(`/proc/${pid}/exe`); } catch { }
    return name ? { name, desc: name, exe, title, pid } : null;
}

async function pollMac() {
    const out = await run('osascript', ['-e', MAC_SCRIPT]);
    if (!out) return null;
    const [name, pid, exe, ...rest] = out.split('|');
    return name ? { name, desc: name, exe: exe || '', title: rest.join('|'), pid } : null;
}

function startPosixWatcher({ onAppChange, onNone }) {
    const poll = process.platform === 'darwin' ? pollMac : pollLinux;
    let last = '';
    let busy = false;

    const timer = setInterval(async () => {
        if (busy) return;
        busy = true;
        try {
            const w = await poll();
            const key = w ? w.name + '|' + w.pid + (isBrowser(w.name) ? '|' + w.title : '') : 'none';
            if (key === last) return;
            last = key;
            if (w) onAppChange(w.name, w.desc, w.exe, w.title);
            else onNone();
        } finally {
            busy = false;
        }
    }, 1000);

    return { kill: () => clearInterval(timer) };
}

module.exports = { startPosixWatcher };
