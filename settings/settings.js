const fs = require('fs');
const path = require('path');

const { loadSettings, saveSettings } = require('./js/settings-store');
const { setAutostart } = require('./js/autostart');
const { createDesktopShortcut } = require('./js/shortcut');
const { getSystemFonts, applyFont } = require('./js/fonts');
const { exportData } = require('./js/export');
const { LANGUAGES, setLanguage, t, applyTranslations } = require('./js/i18n');

const THEME_LABELS = {
    1: 'Nightmare W',
    2: 'Nightmare B',
    3: 'Dreamcore 1',
    4: 'Dreamcore 2',
    5: 'Windows XP',
    6: 'Makima',
    7: 'Rebecca',
    8: 'Psychopomp',
    9: 'Arcane',
    10: 'Glitchcore',
    11: 'L',
    12: 'Evangelion',
    13: 'Acid Bath',
    14: 'Soft Void',
    15: 'Soft Ember',
    16: 'Soft Fog',
    17: 'Soft Dusk',
    18: 'Soft Moss',
    19: 'Soft Ash'
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
setLanguage(settings.language);
applyTranslations(document);

document.getElementById('btn-close').addEventListener('click', () => win.close());

const autostartEl = document.getElementById('setting-autostart');
const trayEl = document.getElementById('setting-tray');
const iconsEl = document.getElementById('setting-icons');
const themeBtn = document.getElementById('theme-btn');
const themeDropdown = document.getElementById('theme-dropdown');

autostartEl.checked = settings.autostart;
trayEl.checked = settings.minimizeToTrayOnAutostart;
iconsEl.checked = settings.showIcons;

themeBtn.textContent = (THEME_LABELS[settings.theme] || 'Nightmare W') + ' ▾';
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

const exportBtn = document.getElementById('setting-export');

exportBtn.addEventListener('click', () => {
    try {
        if (window.mainWindowRef) window.mainWindowRef.flushDataToDisk();
        const { exportDir, copied } = exportData();
        exportBtn.textContent = copied.length ? t('btn.done') + ' ✓' : t('btn.nodata');
        if (copied.length) nw.Shell.openItem(exportDir);
    } catch (err) {
        console.error('export failed:', err.message);
        exportBtn.textContent = t('btn.error');
    }
    setTimeout(() => { exportBtn.textContent = t('btn.export'); }, 2000);
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
    if (!fontBtn.contains(e.target) && !fontDropdown.contains(e.target)) {
        fontDropdown.classList.add('hidden');
    }
    if (!langBtn.contains(e.target) && !langDropdown.contains(e.target)) {
        langDropdown.classList.add('hidden');
    }
});

iconsEl.addEventListener('change', () => {
    settings.showIcons = iconsEl.checked;
    saveSettings(settings);

    if (window.mainWindowRef) {
        window.mainWindowRef.updateShowIconsFromSettings(settings.showIcons);
    }
});

const fontBtn = document.getElementById('font-btn');
const fontDropdown = document.getElementById('font-dropdown');
const DEFAULT_FONT_LABEL = 'Montserrat';

fontBtn.textContent = (settings.fontFamily || DEFAULT_FONT_LABEL) + ' ▾';
applyFont(settings.fontFamily, document);

const fontObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const font = el.dataset.font;
        if (font) {
            el.style.setProperty('font-family', `"${font.replace(/["\\]/g, '')}"`, 'important');
        }
        fontObserver.unobserve(el);
    });
}, { root: fontDropdown, rootMargin: '60px' });

function createFontItem(label, value) {
    const item = document.createElement('div');
    item.className = 'dropdown-item';
    item.textContent = label;
    item.dataset.font = value;
    fontObserver.observe(item);
    return item;
}

const defaultFontItem = createFontItem(t('font.default'), '');
defaultFontItem.dataset.i18n = 'font.default';
fontDropdown.appendChild(defaultFontItem);

getSystemFonts().then((fonts) => {
    const frag = document.createDocumentFragment();
    fonts.forEach((f) => frag.appendChild(createFontItem(f, f)));
    fontDropdown.appendChild(frag);
});

fontBtn.addEventListener('click', () => fontDropdown.classList.toggle('hidden'));

fontDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item) return;
    const font = item.dataset.font;

    settings.fontFamily = font;
    fontBtn.textContent = (font || DEFAULT_FONT_LABEL) + ' ▾';
    fontDropdown.classList.add('hidden');
    applyFont(font, document);
    saveSettings(settings);

    if (window.mainWindowRef) {
        window.mainWindowRef.updateFontFromSettings(font);
    }
});

const langBtn = document.getElementById('lang-btn');
const langDropdown = document.getElementById('lang-dropdown');

function langLabel(code) {
    if (code === 'auto') return t('lang.auto');
    const l = LANGUAGES.find((x) => x.code === code);
    return l ? l.name : code;
}

function refreshLangButton() {
    langBtn.textContent = langLabel(settings.language) + ' ▾';
}

['auto', ...LANGUAGES.map((l) => l.code)].forEach((code) => {
    const item = document.createElement('div');
    item.className = 'dropdown-item';
    item.dataset.lang = code;
    if (code === 'auto') item.dataset.i18n = 'lang.auto';
    else item.textContent = langLabel(code);
    langDropdown.appendChild(item);
});
applyTranslations(document);
refreshLangButton();

langBtn.addEventListener('click', () => langDropdown.classList.toggle('hidden'));

langDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item) return;
    settings.language = item.dataset.lang;
    langDropdown.classList.add('hidden');
    saveSettings(settings);
    setLanguage(settings.language);
    applyTranslations(document);
    refreshLangButton();
    if (window.mainWindowRef) window.mainWindowRef.updateLanguageFromSettings(settings.language);
});

document.getElementById('contact-telegram').addEventListener('click', (e) => {
    e.preventDefault();
    nw.Shell.openExternal('https://t.me/boochear');
});

document.getElementById('contact-email').addEventListener('click', (e) => {
    e.preventDefault();
    nw.Shell.openExternal('mailto:b0ochear2208@gmail.com');
});