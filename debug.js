const fs = require('fs');
const path = require('path');

const LOG = path.join(process.cwd(), 'rastrata-debug.log');

function log(msg) {
    try {
        fs.appendFileSync(LOG, new Date().toISOString() + ' ' + msg + '\n');
    } catch { }
}

window.addEventListener('error', (e) => {
    log('ERROR ' + e.message + ' at ' + e.filename + ':' + e.lineno + ':' + e.colno + '\n' + ((e.error && e.error.stack) || ''));
    try { nw.Window.get().show(); } catch { }
});

window.addEventListener('unhandledrejection', (e) => {
    log('REJECTION ' + ((e.reason && e.reason.stack) || e.reason));
});

process.on('uncaughtException', (err) => {
    log('UNCAUGHT ' + (err.stack || err));
});

const origError = console.error;
console.error = (...args) => {
    log('console.error ' + args.map((a) => (a && a.stack) || (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    origError.apply(console, args);
};