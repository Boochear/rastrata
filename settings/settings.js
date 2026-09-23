const fs = require('fs');
const path = require('path');

const { loadSettings, saveSettings } = require('./js/settings-store');
const { setAutostart } = require('./js/autostart');
const { createDesktopShortcut } = require('./js/shortcut');
const { installDevToolsGuard } = require('./js/devtools-guard');

const THEME_LABELS = {
    white: 'Белая',
    black: 'Чёрная',
    sepia: 'Сепия',
    midnight: 'Полночь',
    forest: 'Лес',
    crimson: 'Багрянец',
    lavender: 'Лаванда',
    ocean: 'Океан',
    sunset: 'Закат',
    graphite: 'Графит'
};

const TRAY_FLAG_PATH = path.join(process.cwd(), 'tray.flag');

function updateTrayFlag() {
    if (settings.autostart && settings.minimizeToTrayOnAutostart) {
        fs.writeFileSync(TRAY_FLAG_PATH, '');
    } else {
        try { fs.unlinkSync(TRAY_FLAG_PATH); } catch { }
    }
}

const win = nw.Window.get();
let settings = loadSettings();

document.getElementById('btn-close').addEventListener('click', () => win.close());

const autostartEl = document.getElementById('setting-autostart');
const trayEl = document.getElementById('setting-tray');
const iconsEl = document.getElementById('setting-icons');
const themeBtn = document.getElementById('theme-btn');
const themeDropdown = document.getElementById('theme-dropdown');

installDevToolsGuard();

autostartEl.checked = settings.autostart;
trayEl.checked = settings.minimizeToTrayOnAutostart;
iconsEl.checked = settings.showIcons;

themeBtn.textContent = (THEME_LABELS[settings.theme] || 'Белая') + ' ▾';
document.body.setAttribute('data-theme', settings.theme);

autostartEl.addEventListener('change', async () => {
    settings.autostart = autostartEl.checked;
    await setAutostart(settings.autostart);
    updateTrayFlag();
    saveSettings(settings);
});

trayEl.addEventListener('change', async () => {
    settings.minimizeToTrayOnAutostart = trayEl.checked;
    updateTrayFlag();
    saveSettings(settings);
});

document.getElementById('setting-shortcut').addEventListener('click', async () => {
    const ok = await createDesktopShortcut();
});

themeBtn.addEventListener('click', () => {
    themeDropdown.classList.toggle('hidden');
});

themeDropdown.querySelectorAll('.dropdown-item').forEach((item) => {
    item.addEventListener('click', () => {
        const theme = item.dataset.theme;
        settings.theme = theme;
        themeBtn.textContent = item.dataset.label + ' ▾';
        themeDropdown.classList.add('hidden');
        document.body.setAttribute('data-theme', theme);
        saveSettings(settings);

        if (window.mainWindowRef) {
            window.mainWindowRef.updateThemeFromSettings(theme);
        }
    });
});

document.addEventListener('click', (e) => {
    if (!themeBtn.contains(e.target) && !themeDropdown.contains(e.target)) {
        themeDropdown.classList.add('hidden');
    }
});

iconsEl.addEventListener('change', () => {
    settings.showIcons = iconsEl.checked;
    saveSettings(settings);

    if (window.mainWindowRef) {
        window.mainWindowRef.updateShowIconsFromSettings(settings.showIcons);
    }
});

document.getElementById('contact-telegram').addEventListener('click', (e) => {
    e.preventDefault();
    nw.Shell.openExternal('https://t.me/boochear');
});

document.getElementById('contact-email').addEventListener('click', (e) => {
    e.preventDefault();
    nw.Shell.openExternal('mailto:b0ochear2208@gmail.com');
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase()))) {
        e.preventDefault();
    }
});