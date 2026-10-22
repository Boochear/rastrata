const fs = require('fs');
const path = require('path');

const { loadSettings, saveSettings } = require('./js/settings-store');
const { setAutostart } = require('./js/autostart');
const { createDesktopShortcut } = require('./js/shortcut');
const { getSystemFonts, applyFont } = require('./js/fonts');
const { exportData } = require('./js/export');
const { LANGUAGES, setLanguage, t, applyTranslations } = require('./js/i18n');
const { THEMES, themeLabel, isDark } = require('./js/themes');
const { resolveTheme } = require('./js/theme-scheduler');

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

function persist() {
    const { lastSummary, windowW, windowH, ...mine } = settings;
    saveSettings({ ...loadSettings(), ...mine });
}

function notifyMain() {
    if (window.mainWindowRef) window.mainWindowRef.updateSettingsFromDisk();
}
setLanguage(settings.language);
applyTranslations(document);

document.getElementById('btn-close').addEventListener('click', () => win.hide());

const autostartEl = document.getElementById('setting-autostart');
const trayEl = document.getElementById('setting-tray');
const iconsEl = document.getElementById('setting-icons');
const themeBtn = document.getElementById('theme-btn');
const themeDropdown = document.getElementById('theme-dropdown');

autostartEl.checked = settings.autostart;
trayEl.checked = settings.minimizeToTrayOnAutostart;
iconsEl.checked = settings.showIcons;

function showEffectiveTheme() {
    document.body.setAttribute('data-theme', resolveTheme(settings));
    document.body.setAttribute('data-anim', settings.themeAnimations === false ? 'off' : 'on');
}

function fillThemeMenu(menu, onPick) {
    [['theme.light', false], ['theme.dark', true]].forEach(([key, dark]) => {
        const head = document.createElement('div');
        head.className = 'dropdown-item';
        head.style.opacity = '0.5';
        head.style.pointerEvents = 'none';
        head.dataset.i18n = key;
        menu.appendChild(head);
        THEMES.filter(({ id }) => isDark(id) === dark).forEach(({ id, label }) => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.textContent = label;
            item.addEventListener('click', () => onPick(id));
            menu.appendChild(item);
        });
    });
}

themeBtn.textContent = themeLabel(settings.theme) + ' ▾';
showEffectiveTheme();

fillThemeMenu(themeDropdown, (id) => {
    settings.theme = id;
    themeBtn.textContent = themeLabel(id) + ' ▾';
    themeDropdown.classList.add('hidden');
    persist();
    showEffectiveTheme();
    if (window.mainWindowRef) window.mainWindowRef.updateThemeFromSettings(id);
});

themeBtn.addEventListener('click', () => themeDropdown.classList.toggle('hidden'));

autostartEl.addEventListener('change', async () => {
    settings.autostart = autostartEl.checked;
    await setAutostart(settings.autostart);
    updateTrayFlag();
    persist();
});

trayEl.addEventListener('change', async () => {
    settings.minimizeToTrayOnAutostart = trayEl.checked;
    updateTrayFlag();
    persist();
});

document.getElementById('setting-shortcut').addEventListener('click', async () => {
    const ok = await createDesktopShortcut();
});

const excludedEl = document.getElementById('setting-excluded');
excludedEl.value = (settings.excludedApps || []).join(', ');
excludedEl.addEventListener('change', () => {
    settings.excludedApps = excludedEl.value.split(',').map((s) => s.trim().replace(/\.exe$/i, '')).filter(Boolean);
    persist();
    if (window.mainWindowRef) window.mainWindowRef.updateExcludedFromSettings(settings.excludedApps);
});

function bindCheck(id, key, after) {
    const el = document.getElementById(id);
    el.checked = !!settings[key];
    el.addEventListener('change', () => {
        settings[key] = el.checked;
        persist();
        if (after) after();
        notifyMain();
    });
}

function bindText(id, key) {
    const el = document.getElementById(id);
    el.value = settings[key] || '';
    el.addEventListener('change', () => {
        settings[key] = el.value.trim();
        persist();
        notifyMain();
    });
}

bindCheck('setting-animations', 'themeAnimations', () => {
    document.body.setAttribute('data-anim', settings.themeAnimations === false ? 'off' : 'on');
});
bindCheck('setting-vizrainbow', 'vizRainbow');
bindCheck('setting-tracksites', 'trackSites');
bindCheck('setting-summarynotify', 'summaryNotify');
bindCheck('setting-discord', 'discordEnabled');
bindCheck('setting-discord-timer', 'discordShowTimer');
bindText('setting-discord-details', 'discordDetails');
bindText('setting-discord-state', 'discordState');

const sizeBtn = document.getElementById('size-btn');
const sizeDropdown = document.getElementById('size-dropdown');

function refreshSizeButton() {
    sizeBtn.textContent = t('size.' + settings.windowSize) + ' ▾';
}

['default', 'compact', 'large', 'remember'].forEach((mode) => {
    const item = document.createElement('div');
    item.className = 'dropdown-item';
    item.dataset.size = mode;
    item.dataset.i18n = 'size.' + mode;
    sizeDropdown.appendChild(item);
});
applyTranslations(document);
refreshSizeButton();

sizeBtn.addEventListener('click', () => sizeDropdown.classList.toggle('hidden'));

sizeDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item) return;
    settings.windowSize = item.dataset.size;
    sizeDropdown.classList.add('hidden');
    persist();
    refreshSizeButton();
    notifyMain();
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
    if (!sizeBtn.contains(e.target) && !sizeDropdown.contains(e.target)) {
        sizeDropdown.classList.add('hidden');
    }
});

iconsEl.addEventListener('change', () => {
    settings.showIcons = iconsEl.checked;
    persist();

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

let fontsRequested = false;

function loadFontList() {
    if (fontsRequested) return;
    fontsRequested = true;
    getSystemFonts().then((fonts) => {
        const frag = document.createDocumentFragment();
        fonts.forEach((f) => frag.appendChild(createFontItem(f, f)));
        fontDropdown.appendChild(frag);
    });
}

fontBtn.addEventListener('click', () => {
    fontDropdown.classList.toggle('hidden');
    loadFontList();
});

fontDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item) return;
    const font = item.dataset.font;

    settings.fontFamily = font;
    fontBtn.textContent = (font || DEFAULT_FONT_LABEL) + ' ▾';
    fontDropdown.classList.add('hidden');
    applyFont(font, document);
    persist();

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
    persist();
    setLanguage(settings.language);
    applyTranslations(document);
    refreshLangButton();
    refreshSizeButton();
    updatePlaceholders();
    if (window.mainWindowRef) window.mainWindowRef.updateLanguageFromSettings(settings.language);
});

const seasonalEl = document.getElementById('setting-seasonal');
const autoNightEl = document.getElementById('setting-autonight');
const nightThemeBtn = document.getElementById('night-theme-btn');
const nightThemeDropdown = document.getElementById('night-theme-dropdown');
const holidayEl = document.getElementById('setting-holiday');
holidayEl.checked = settings.holidayThemes;

holidayEl.addEventListener('change', () => {
    settings.holidayThemes = holidayEl.checked;
    onScheduleChanged();
});

seasonalEl.checked = settings.seasonalThemes;
autoNightEl.checked = settings.autoNight;
nightThemeBtn.textContent = themeLabel(settings.nightTheme) + ' ▾';

function onScheduleChanged() {
    persist();
    showEffectiveTheme();
    if (window.mainWindowRef) window.mainWindowRef.updateThemeScheduleFromSettings();
}

seasonalEl.addEventListener('change', () => {
    settings.seasonalThemes = seasonalEl.checked;
    onScheduleChanged();
});

autoNightEl.addEventListener('change', () => {
    settings.autoNight = autoNightEl.checked;
    onScheduleChanged();
});

fillThemeMenu(nightThemeDropdown, (id) => {
    settings.nightTheme = id;
    nightThemeBtn.textContent = themeLabel(id) + ' ▾';
    nightThemeDropdown.classList.add('hidden');
    onScheduleChanged();
});

nightThemeBtn.addEventListener('click', () => nightThemeDropdown.classList.toggle('hidden'));

const pad2 = (n) => String(n).padStart(2, '0');
const timePickers = [];

function createTimePicker(btn, pop, key) {
    const cols = { h: pop.querySelector('[data-col="h"]'), m: pop.querySelector('[data-col="m"]') };
    const items = { h: [], m: [] };

    function build(name, count) {
        for (let i = 0; i < count; i++) {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.textContent = pad2(i);
            cols[name].appendChild(item);
            items[name].push(item);
        }
    }
    build('h', 24);
    build('m', 60);

    function current() {
        const [h, m] = String(settings[key]).split(':').map(Number);
        return { h: h || 0, m: m || 0 };
    }

    function refresh() {
        const { h, m } = current();
        btn.textContent = pad2(h) + ':' + pad2(m);
        items.h.forEach((el, i) => el.classList.toggle('selected', i === h));
        items.m.forEach((el, i) => el.classList.toggle('selected', i === m));
    }

    function scrollToSelected() {
        const { h, m } = current();
        [['h', h], ['m', m]].forEach(([name, idx]) => {
            const col = cols[name];
            const el = items[name][idx];
            col.scrollTop = el.offsetTop - col.clientHeight / 2 + el.offsetHeight / 2;
        });
    }

    function close() { pop.classList.add('hidden'); }

    btn.addEventListener('click', () => {
        const willOpen = pop.classList.contains('hidden');
        timePickers.forEach((p) => p.close());
        if (willOpen) {
            pop.classList.remove('hidden');
            scrollToSelected();
        }
    });

    pop.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        const name = item.parentElement.dataset.col;
        const cur = current();
        const value = Number(item.textContent);
        const h = name === 'h' ? value : cur.h;
        const m = name === 'm' ? value : cur.m;
        settings[key] = pad2(h) + ':' + pad2(m);
        refresh();
        onScheduleChanged();
        if (name === 'm') close();
    });

    refresh();
    const picker = { close, root: btn.parentElement };
    timePickers.push(picker);
    return picker;
}

createTimePicker(document.getElementById('night-from-btn'), document.getElementById('night-from-pop'), 'nightFrom');
createTimePicker(document.getElementById('night-to-btn'), document.getElementById('night-to-pop'), 'nightTo');

document.addEventListener('click', (e) => {
    if (!nightThemeBtn.contains(e.target) && !nightThemeDropdown.contains(e.target)) {
        nightThemeDropdown.classList.add('hidden');
    }
    timePickers.forEach((p) => {
        if (!p.root.contains(e.target)) p.close();
    });
});

document.addEventListener('click', (e) => {
    if (!nightThemeBtn.contains(e.target) && !nightThemeDropdown.contains(e.target)) {
        nightThemeDropdown.classList.add('hidden');
    }
});

const blurEl = document.getElementById('setting-blur');
const blurValueEl = document.getElementById('blur-value');

function applyBlurLocal(px) {
    document.body.style.setProperty('--bg-blur', px);
    blurEl.style.setProperty('--fill', (px / Number(blurEl.max) * 100) + '%');
    blurValueEl.textContent = px;
}

blurEl.value = settings.backgroundBlur;
applyBlurLocal(Number(settings.backgroundBlur) || 0);

blurEl.addEventListener('input', () => {
    const px = Number(blurEl.value);
    settings.backgroundBlur = px;
    applyBlurLocal(px);
    if (window.mainWindowRef) window.mainWindowRef.updateBlurFromSettings(px);
});

blurEl.addEventListener('change', () => persist());

const glowEl = document.getElementById('setting-glow');
const glowValueEl = document.getElementById('glow-value');

function applyGlowLocal(px) {
    document.body.style.setProperty('--glow-size', px + 'px');
    glowEl.style.setProperty('--fill', (px / Number(glowEl.max) * 100) + '%');
    glowValueEl.textContent = px;
}

glowEl.value = settings.glow;
applyGlowLocal(Number(settings.glow) || 0);

glowEl.addEventListener('input', () => {
    const px = Number(glowEl.value);
    settings.glow = px;
    applyGlowLocal(px);
    if (window.mainWindowRef) window.mainWindowRef.updateGlowFromSettings(px);
});

glowEl.addEventListener('change', () => persist());

document.getElementById('contact-telegram').addEventListener('click', (e) => {
    e.preventDefault();
    nw.Shell.openExternal('https://t.me/boochear');
});

document.getElementById('contact-email').addEventListener('click', (e) => {
    e.preventDefault();
    nw.Shell.openExternal('mailto:b0ochear2208@gmail.com');
});

const searchEl = document.getElementById('settings-search');
const pages = Array.from(document.querySelectorAll('.tab-page'));
const tabButtons = Array.from(document.querySelectorAll('.tab'));

function updatePlaceholders() {
    searchEl.placeholder = t('settings.search');
    document.getElementById('setting-discord-details').placeholder = t('discord.using') + ' {app}';
    document.getElementById('setting-discord-state').placeholder = t('discord.today') + ': {time}';
}
updatePlaceholders();

function showTab(name) {
    pages.forEach((p) => p.classList.toggle('active', p.dataset.page === name));
    tabButtons.forEach((b) => b.classList.toggle('selected', b.dataset.tab === name));
}

tabButtons.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

searchEl.addEventListener('input', () => {
    const q = searchEl.value.trim().toLowerCase();
    document.body.classList.toggle('searching', !!q);
    pages.forEach((page) => {
        let visible = 0;
        page.querySelectorAll('.row').forEach((row) => {
            const label = row.firstElementChild ? row.firstElementChild.textContent.toLowerCase() : '';
            const hit = !q || label.includes(q);
            row.classList.toggle('search-hidden', !hit);
            if (hit) visible++;
        });
        page.classList.toggle('search-empty', !!q && visible === 0);
    });
});

if (location.hash !== '#prewarm') {
    win.show();
    win.focus();
}
