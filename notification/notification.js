const { loadSettings } = require('./js/settings-store');
const { applyFont } = require('./js/fonts');
const { setLanguage, t, applyTranslations } = require('./js/i18n');
const { resolveTheme } = require('./js/theme-scheduler');

const win = nw.Window.get();
const $ = (id) => document.getElementById(id);

const WIDTH = 340;
const MARGIN = 16;

const s = loadSettings();
setLanguage(s.language);
applyTranslations(document);
document.body.setAttribute('data-theme', resolveTheme(s));
document.body.setAttribute('data-anim', s.themeAnimations === false ? 'off' : 'on');
applyFont(s.fontFamily, document);
document.body.style.setProperty('--bg-blur', 0);
document.body.style.setProperty('--glow-size', (Number.isFinite(Number(s.glow)) ? Number(s.glow) : 10) + 'px');

function fmt(ms) {
    const m = Math.round(ms / 60000);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h} ${t('unit.hour')} ${m % 60} ${t('unit.min')}` : `${m} ${t('unit.min')}`;
}

function esc(v) {
    return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let timer = null;

function closeToast() {
    clearTimeout(timer);
    win.close(true);
}

function render(items) {
    $('toast-title').textContent = t('notify.title');
    $('toast-open').textContent = t('notify.open');
    $('toast-list').innerHTML = items.map((it) => {
        const top = it.top
            ? `<div class="toast-meta">${it.top.icon ? `<img src="${esc(it.top.icon)}">` : ''}<span>${esc(t('board.leader'))}: ${esc(it.top.name)} · ${esc(fmt(it.top.ms))}</span></div>`
            : '';
        return `<div class="toast-item"><b>${esc(it.label)}</b>` +
            `<div class="toast-meta">${esc(fmt(it.total))} · ${it.share.toFixed(1)}% ${esc(t('day.ofday'))}</div>${top}</div>`;
    }).join('');

    const height = 44 + items.length * 70 + 52;
    win.resizeTo(WIDTH, height);
    win.moveTo(
        (screen.availLeft || 0) + screen.availWidth - WIDTH - MARGIN,
        (screen.availTop || 0) + screen.availHeight - height - MARGIN
    );
    win.show();
    win.setAlwaysOnTop(true);

    timer = setTimeout(closeToast, 15000);
    document.body.addEventListener('mouseenter', () => clearTimeout(timer));
    document.body.addEventListener('mouseleave', () => { timer = setTimeout(closeToast, 6000); });

    $('toast-x').addEventListener('click', closeToast);
    $('toast-open').addEventListener('click', () => {
        if (window.mainWindowRef) window.mainWindowRef.openVizSummary(items[0].kind);
        closeToast();
    });
}

(function init() {
    if (!window.toastData) {
        setTimeout(init, 30);
        return;
    }
    render(window.toastData);
})();
