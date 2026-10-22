const net = require('net');
const path = require('path');

function ipcPaths() {
    const out = [];
    if (process.platform === 'win32') {
        for (let i = 0; i < 10; i++) out.push(`\\\\?\\pipe\\discord-ipc-${i}`);
        return out;
    }
    const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || '/tmp';
    [base, path.join(base, 'snap.discord'), path.join(base, 'app', 'com.discordapp.Discord')].forEach((dir) => {
        for (let i = 0; i < 10; i++) out.push(path.join(dir, `discord-ipc-${i}`));
    });
    return out;
}

function encode(op, data) {
    const json = Buffer.from(JSON.stringify(data));
    const buf = Buffer.alloc(8 + json.length);
    buf.writeInt32LE(op, 0);
    buf.writeInt32LE(json.length, 4);
    json.copy(buf, 8);
    return buf;
}

function openSocket(paths, idx, cb) {
    if (idx >= paths.length) return cb(null);
    const s = net.createConnection(paths[idx]);
    s.once('connect', () => cb(s));
    s.once('error', () => openSocket(paths, idx + 1, cb));
}

function createDiscord() {
    let sock = null;
    let ready = false;
    let connecting = false;
    let enabled = false;
    let clientId = '';
    let activity = null;
    let lastSent = '';
    let retry = null;

    function send(op, data) {
        if (sock && !sock.destroyed) sock.write(encode(op, data));
    }

    function flush() {
        if (!ready) return;
        const key = JSON.stringify(activity);
        if (key === lastSent) return;
        lastSent = key;
        send(1, {
            cmd: 'SET_ACTIVITY',
            args: { pid: process.pid, activity: activity || null },
            nonce: String(Date.now()) + Math.random()
        });
    }

    function drop() {
        ready = false;
        connecting = false;
        lastSent = '';
        if (sock) { sock.removeAllListeners(); sock.destroy(); sock = null; }
        if (enabled && clientId && !retry) {
            retry = setTimeout(() => { retry = null; connect(); }, 15000);
        }
    }

    function connect() {
        if (!enabled || !clientId || sock || connecting) return;
        connecting = true;
        openSocket(ipcPaths(), 0, (s) => {
            connecting = false;
            if (!s) return drop();
            sock = s;
            let buf = Buffer.alloc(0);
            s.on('data', (d) => {
                buf = Buffer.concat([buf, d]);
                while (buf.length >= 8) {
                    const op = buf.readInt32LE(0);
                    const len = buf.readInt32LE(4);
                    if (buf.length < 8 + len) break;
                    let msg = null;
                    try { msg = JSON.parse(buf.slice(8, 8 + len).toString()); } catch { }
                    buf = buf.slice(8 + len);
                    if (op === 1 && msg && msg.evt === 'READY') { ready = true; flush(); }
                    if (op === 2) return drop();
                }
            });
            s.on('error', drop);
            s.on('close', drop);
            send(0, { v: 1, client_id: clientId });
        });
    }

    return {
        configure(on, id) {
            const changed = id !== clientId || on !== enabled;
            enabled = !!on;
            clientId = String(id || '').trim();
            if (changed) drop();
            if (enabled && clientId) connect();
        },
        setActivity(a) {
            activity = a;
            flush();
        },
        stop() {
            enabled = false;
            if (retry) { clearTimeout(retry); retry = null; }
            drop();
        }
    };
}

module.exports = { createDiscord };
