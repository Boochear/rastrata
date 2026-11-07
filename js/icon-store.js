const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

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
        fs.writeFileSync(tmpPath, JSON.stringify(icons));
        fs.renameSync(tmpPath, ICONS_FILE);
    } catch (err) {
        console.error('failed to save icons:', err.message);
    }
}

let server = null;
const waiting = new Map();
let idleTimer = null;

function touchServer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        if (!server) return;
        if (waiting.size > 0) return touchServer();
        const s = server;
        server = null;
        try { s.stdin.end(); s.kill(); } catch { }
    }, 30000);
}

function startServer() {
    const ps = spawn('powershell', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', path.join(process.cwd(), 'iconserver.ps1')
    ], { windowsHide: true });
    const rl = readline.createInterface({ input: ps.stdout });
    rl.on('line', (line) => {
        const tab = line.indexOf('\t');
        if (tab < 0) return;
        const exe = line.slice(0, tab);
        const b64 = line.slice(tab + 1).trim();
        const cbs = waiting.get(exe) || [];
        waiting.delete(exe);
        cbs.forEach((cb) => cb(b64 ? 'data:image/png;base64,' + b64 : null));
        touchServer();
    });
    const fail = () => {
        if (server !== ps) return;
        server = null;
        waiting.forEach((cbs) => cbs.forEach((cb) => cb(null)));
        waiting.clear();
    };
    ps.stdin.on('error', () => { });
    ps.stderr.on('data', () => { });
    ps.on('error', fail);
    ps.on('exit', fail);
    return ps;
}

function iconFor(exePath) {
    return new Promise((resolve) => {
        if (!server) server = startServer();
        touchServer();
        if (!waiting.has(exePath)) {
            waiting.set(exePath, []);
            server.stdin.write(exePath + '\n');
        }
        waiting.get(exePath).push(resolve);
    });
}

function createIconRequester(icons, onIconReady) {
    const inFlight = new Set();
    const failed = new Set();
    return function requestIcon(appName, exePath) {
        if (process.platform !== 'win32') return;
        if (!exePath || icons[appName] || inFlight.has(appName) || failed.has(appName)) return;
        inFlight.add(appName);
        iconFor(exePath).then((dataUrl) => {
            inFlight.delete(appName);
            if (!dataUrl) { failed.add(appName); return; }
            icons[appName] = dataUrl;
            saveIcons(icons);
            onIconReady();
        });
    };
}

module.exports = { loadIcons, saveIcons, createIconRequester };