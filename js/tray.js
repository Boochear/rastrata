const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const { t } = require('./i18n');

function setupTray(win, { iconPath, appName }) {
    let popup = null;
    let pending = null;
    let creating = false;
    let removed = false;
    let lastShow = 0;
    let lastArm = '';

    const ps = spawn('powershell', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', path.join(process.cwd(), 'trayhost.ps1'),
        path.resolve(iconPath), appName,
        String(process.pid), document.title
    ], { windowsHide: true });

    function send(line) {
        try { ps.stdin.write(line + '\n'); } catch { }
    }

    function bringToFront() {
        win.show();
        win.setAlwaysOnTop(true);
        win.focus();
        setTimeout(() => { try { win.setAlwaysOnTop(false); } catch { } }, 300);
    }

    function popupCall(name) {
        if (popup && popup.window[name]) {
            try { popup.window[name](); } catch { }
        }
    }

    function createPopup() {
        if (creating || popup || removed) return;
        creating = true;
        nw.Window.open('tray/tray.html', {
            width: 200,
            height: 100,
            min_width: 1,
            min_height: 1,
            frame: false,
            show: false,
            always_on_top: true,
            show_in_taskbar: false,
            transparent: true
        }, (w) => {
            creating = false;
            if (removed) { try { w.close(true); } catch { } return; }
            popup = w;
            w.window.trayArm = (rc) => {
                lastArm = 'arm|' + [rc.l, rc.t, rc.r, rc.b].map(Math.round).join('|');
                send(lastArm);
            };
            w.window.trayDisarm = () => { lastArm = ''; send('disarm'); };
            w.window.trayAction = (id) => {
                popupCall('trayHide');
                if (id === 'show') bringToFront();
                if (id === 'quit') nw.App.quit();
            };
            w.on('closed', () => { if (popup === w) popup = null; });
            if (pending) {
                const req = pending;
                pending = null;
                if (w.window.trayShow) w.window.trayShow(req);
                else w.window.trayPending = req;
            }
        });
    }

    function showPopup(x, y) {
        const now = Date.now();
        if (now - lastShow < 300) return;
        lastShow = now;
        const req = {
            x, y,
            items: [
                { id: 'show', label: t('tray.show') },
                { id: 'quit', label: t('tray.quit') }
            ]
        };
        if (popup && popup.window.trayShow) {
            popup.window.trayShow(req);
        } else {
            pending = req;
            createPopup();
        }
    }

    createPopup();

    const rl = readline.createInterface({ input: ps.stdout });
    rl.on('line', (line) => {
        line = line.trim();
        if (line === 'click') {
            popupCall('trayHide');
            bringToFront();
        } else if (line.startsWith('menu|')) {
            const [, x, y] = line.split('|');
            showPopup(Number(x), Number(y));
        } else if (line === 'outside') {
            if (Date.now() - lastShow < 500) {
                if (lastArm) send(lastArm);
                return;
            }
            popupCall('trayHide');
        }
    });

    ps.stderr.on('data', () => { });
    ps.stdin.on('error', () => { });
    ps.on('error', () => { if (!removed) { win.show(); win.focus(); } });
    ps.on('exit', () => { if (!removed) { win.show(); win.focus(); } });

    return {
        remove() {
            removed = true;
            if (popup) { try { popup.close(true); } catch { } popup = null; }
            try { ps.stdin.end(); } catch { }
            try { ps.kill(); } catch { }
        },
        rebuildMenu() { }
    };
}

module.exports = { setupTray };