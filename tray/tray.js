const { loadSettings } = require('./js/settings-store');
const { applyFont } = require('./js/fonts');
const { resolveTheme } = require('./js/theme-scheduler');

const win = nw.Window.get();
const COORD_SCALE = 1;
const menuEl = document.getElementById('tray-menu');
let visible = false;
let curW = 0;
let curH = 0;
let lastX = null;
let lastY = null;
let lastKey = '';
let safety = null;
let gen = 0;

function place(pos, w, h) {
    const left = screen.availLeft || 0;
    const top = screen.availTop || 0;
    const right = left + screen.availWidth;
    const bottom = top + screen.availHeight;

    const cx = pos.x * COORD_SCALE;
    const cy = pos.y * COORD_SCALE;
    let x = cx;
    let y = cy - h - 6;
    if (y < top) y = cy + 6;

    if (cx >= 0 && cx < screen.width && cy >= 0 && cy < screen.height) {
        x = Math.min(Math.max(x, left), right - w);
        y = Math.min(Math.max(y, top), bottom - h);
    }
    x = Math.round(x);
    y = Math.round(y);
    if (x !== lastX || y !== lastY) {
        win.moveTo(x, y);
        lastX = x;
        lastY = y;
    }
    return { x, y };
}

function fit(pos) {
    const r = menuEl.getBoundingClientRect();
    const w = Math.ceil(r.width);
    const h = Math.ceil(r.height);
    if (w !== curW || h !== curH) {
        try { win.setResizable(true); } catch { }
        win.setMinimumSize(1, 1);
        win.resizeTo(w, h);
        try { win.setResizable(false); } catch { }
        curW = w;
        curH = h;
    }

    const at = place(pos, w, h);
    if (window.trayArm) {
        window.trayArm({
            l: at.x / COORD_SCALE,
            t: at.y / COORD_SCALE,
            r: (at.x + w) / COORD_SCALE,
            b: (at.y + h) / COORD_SCALE
        });
    }
}

window.trayHide = () => {
    gen++;
    visible = false;
    clearTimeout(safety);
    win.hide();
    if (window.trayDisarm) window.trayDisarm();
};

window.trayShow = ({ x, y, items }) => {
    const my = ++gen;
    const pos = { x, y };

    const s = loadSettings();
    const key = resolveTheme(s) + '|' + s.fontFamily + '|' + items.map((it) => it.label).join('|');
    if (key !== lastKey) {
        lastKey = key;
        document.body.setAttribute('data-theme', resolveTheme(s));
        document.body.setAttribute('data-anim', 'off');
        applyFont(s.fontFamily, document);
        document.body.style.setProperty('--bg-blur', 0);
        document.body.style.setProperty('--glow-size', '0px');

        menuEl.style.width = 'max-content';
        menuEl.style.whiteSpace = 'nowrap';
        menuEl.innerHTML = '';
        items.forEach((it) => {
            const el = document.createElement('div');
            el.className = 'dropdown-item';
            el.textContent = it.label;
            el.addEventListener('click', () => window.trayAction(it.id));
            menuEl.appendChild(el);
        });
    }

    fit(pos);
    if (!visible) {
        win.show();
        win.focus();
        visible = true;
    }
    clearTimeout(safety);
    safety = setTimeout(() => { if (visible) window.trayHide(); }, 20000);

    document.fonts.ready.then(() => { if (my === gen && visible) fit(pos); });
};

if (window.trayPending) {
    const req = window.trayPending;
    window.trayPending = null;
    window.trayShow(req);
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.trayHide(); });