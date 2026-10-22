const { loadSettings, saveSettings } = require('./js/settings-store');
const { loadIcons, createIconRequester } = require('./js/icon-store');
const { loadFriendlyNames, saveFriendlyNames } = require('./js/friendly-names-store');
const { todayKey, loadStats, saveStats, addTime, getStatsForPeriod, periodIncludesToday } = require('./js/stats-store');
const { startWatcher } = require('./js/watcher-client');
const { setupTray } = require('./js/tray');
const { checkForUpdates, applyUpdateAndRestart, cleanupUpdateFiles } = require('./js/updater');
const { applyFont } = require('./js/fonts');
const { setLanguage, t, applyTranslations } = require('./js/i18n');
const { resolveTheme } = require('./js/theme-scheduler');
const { loadSites, saveSites } = require('./js/sites-store');
const { isBrowser, siteFromTitle, siteFromUrl, siteFromAddressBar } = require('./js/sites');
const { startUrlReader } = require('./js/url-reader');
const { createSiteServer } = require('./js/site-server');
const { createDiscord } = require('./js/discord');
const { keysOf, previousFull, summarize, rangeLabel } = require('./js/summary');
const { createSiteIcons } = require('./js/site-icons');

const APP_NAME = 'Rastrata';
const SAVE_INTERVAL = 10000;
const pkg = require('./package.json');

let settings = loadSettings();
let stats = loadStats();
let friendlyNames = loadFriendlyNames();
let icons = loadIcons();
let sites = loadSites();
const siteIcons = createSiteIcons(() => renderList());
let toastWin = null;
let currentSite = null;
let siteStart = Date.now();

let currentApp = null;
let sessionStart = Date.now();
let selectedPeriod = 'today';
let settingsWin = null;
let vizWin = null;
let tray = null;

const win = nw.Window.get();

const TRAY_FLAG_PATH = path.join(process.cwd(), 'tray.flag');
const isTrayLaunch = fs.existsSync(TRAY_FLAG_PATH);

const WINDOW_SIZES = { compact: [380, 480], default: [420, 600], large: [520, 760] };
let lastSizeMode = settings.windowSize;

function applyWindowSize() {
    win.setMinimumSize(340, 400);
    let size = WINDOW_SIZES[settings.windowSize];
    if (settings.windowSize === 'remember') {
        size = [Number(settings.windowW) || 420, Number(settings.windowH) || 600];
    }
    if (size) {
        win.resizeTo(size[0], size[1]);
        win.setPosition('center');
    }
}
applyWindowSize();

let resizeTimer = null;
win.on('resize', (w, h) => {
    if (settings.windowSize !== 'remember') return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        settings.windowW = w;
        settings.windowH = h;
        saveSettings({ ...loadSettings(), windowW: w, windowH: h });
    }, 600);
});

if (!isTrayLaunch) {
    win.show();
}

function setGlow(px) {
    const v = Number.isFinite(Number(px)) ? Number(px) : 10;
    document.body.style.setProperty('--glow-size', v + 'px');
}

function applyAnimations() {
    const value = settings.themeAnimations === false ? 'off' : 'on';
    document.body.setAttribute('data-anim', value);
    if (settingsWin) settingsWin.window.document.body.setAttribute('data-anim', value);
    if (vizWin) vizWin.window.document.body.setAttribute('data-anim', value);
}

function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    applyAnimations();
}

let appliedTheme = null;

function refreshTheme() {
    const theme = resolveTheme(settings);
    if (theme === appliedTheme) return;
    appliedTheme = theme;
    applyTheme(theme);
    if (settingsWin) settingsWin.window.document.body.setAttribute('data-theme', theme);
    if (vizWin && vizWin.window.onAppearanceChanged) vizWin.window.onAppearanceChanged();
}

function formatMs(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
    return `${s}`;
}

function buildEntries() {
    const today = periodIncludesToday(selectedPeriod);
    const appStats = getStatsForPeriod(stats, selectedPeriod);
    if (currentApp && today) appStats[currentApp] = (appStats[currentApp] || 0) + (Date.now() - sessionStart);
    const sorted = Object.entries(appStats).sort((a, b) => b[1] - a[1]);

    let siteList = [];
    if (settings.trackSites) {
        const siteStats = getStatsForPeriod(sites, selectedPeriod);
        if (currentSite && today) siteStats[currentSite] = (siteStats[currentSite] || 0) + (Date.now() - siteStart);
        siteList = Object.entries(siteStats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    }
    const host = sorted.find(([name]) => isBrowser(name));

    const entries = [];
    let num = 0;
    sorted.forEach(([name, ms]) => {
        num++;
        entries.push({
            key: 'app:' + name,
            label: friendlyNames[name] || name,
            ms,
            num,
            icon: icons[name],
            active: name === currentApp && today,
            sub: false
        });
        if (host && host[0] === name) {
            siteList.forEach(([site, siteMs]) => entries.push({
                key: 'site:' + site,
                label: site,
                ms: siteMs,
                icon: siteIcons.icons[site],
                active: site === currentSite && today,
                sub: true
            }));
        }
    });
    return entries;
}

function setText(el, value) {
    if (el.textContent !== value) el.textContent = value;
}

function renderList() {
    if (document.hidden) return;
    const entries = buildEntries();
    const list = document.getElementById('list');
    const seen = new Set();
    entries.forEach((e, index) => {
        seen.add(e.key);
        let row = list.querySelector(`[data-key="${CSS.escape(e.key)}"]`);
        if (!row) {
            row = document.createElement('div');
            row.className = 'row row-new';
            row.dataset.key = e.key;
            row.innerHTML = `
        <div class="row-left">
          <span class="row-number"></span>
          <span class="row-icon-slot"></span>
          <span class="name"></span>
        </div>
        <span class="time"></span>
      `;
            list.appendChild(row);
        }
        row.classList.toggle('sub', e.sub);
        row.classList.toggle('active', e.active);
        setText(row.querySelector('.row-number'), e.sub ? '↳' : `${e.num}.`);
        setText(row.querySelector('.name'), e.label);
        setText(row.querySelector('.time'), formatMs(e.ms));
        const iconSlot = row.querySelector('.row-icon-slot');
        const shouldHaveIcon = settings.showIcons && e.icon;
        const hasIconNow = iconSlot.querySelector('img') !== null;
        if (shouldHaveIcon && !hasIconNow) {
            iconSlot.innerHTML = `<img class="row-icon" src="${e.icon}">`;
        } else if (!shouldHaveIcon && hasIconNow) {
            iconSlot.innerHTML = '';
        }
        const currentPos = Array.from(list.children).indexOf(row);
        if (currentPos !== index) {
            list.insertBefore(row, list.children[index] || null);
        }
    });
    Array.from(list.children).forEach((row) => {
        if (!seen.has(row.dataset.key)) {
            row.remove();
        }
    });
}

const requestIcon = createIconRequester(icons, renderList);

function isExcluded(appName) {
    return (settings.excludedApps || []).some((x) => x.toLowerCase() === String(appName).toLowerCase());
}

function switchApp(name) {
    if (currentApp) addTime(stats, currentApp, Date.now() - sessionStart);
    currentApp = name;
    sessionStart = Date.now();
    renderList();
}

function switchSite(name) {
    if (name === currentSite) return;
    if (currentSite) addTime(sites, currentSite, Date.now() - siteStart);
    currentSite = name;
    siteStart = Date.now();
    if (name) siteIcons.request(name);
    renderList();
}

let fgApp = null;
let fgTitle = '';
let ext = { site: null, focused: false, at: 0 };
let extSeen = false;

function siteForBrowser(title) {
    if (extSeen) {
        return ext.focused && Date.now() - ext.at < 150000 ? ext.site : null;
    }
    return siteFromTitle(title);
}

let urlReader = null;

function ensureUrlReader() {
    if (settings.trackSites && !urlReader) {
        urlReader = startUrlReader((value) => {
            if (!settings.trackSites || extSeen || !fgApp || !isBrowser(fgApp)) return;
            switchSite(siteFromAddressBar(value) || siteFromTitle(fgTitle));
        });
    } else if (!settings.trackSites && urlReader) {
        urlReader.stop();
        urlReader = null;
    }
}

function resolveBrowserSite(title) {
    if (extSeen) {
        switchSite(siteForBrowser(title));
        return;
    }
    ensureUrlReader();
    if (urlReader && urlReader.available) urlReader.request();
    else switchSite(siteFromTitle(title));
}

const siteServer = createSiteServer((tab) => {
    extSeen = true;
    ext = { site: siteFromUrl(tab.url), focused: tab.focused, at: Date.now() };
    if (settings.trackSites && fgApp && isBrowser(fgApp)) switchSite(siteForBrowser(fgTitle));
});

startWatcher({
    onNone() {
        fgApp = null;
        switchApp(null);
        switchSite(null);
    },
    onAppChange(appName, friendlyName, exePath, title) {
        fgApp = appName;
        fgTitle = title;
        if (isExcluded(appName)) {
            switchApp(null);
            switchSite(null);
            return;
        }
        if (settings.trackSites && isBrowser(appName)) resolveBrowserSite(title);
        else switchSite(null);
        if (appName === currentApp) return;
        friendlyNames[appName] = friendlyName || appName;
        requestIcon(appName, exePath);
        switchApp(appName);
    }
});

const discord = createDiscord();

function formatHM(ms) {
    const m = Math.round(ms / 60000);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h} ${t('unit.hour')} ${m % 60} ${t('unit.min')}` : `${m} ${t('unit.min')}`;
}

function fillTemplate(tpl, vars) {
    const used = [...tpl.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    if (used.length && used.every((k) => !vars[k])) return '';
    return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)).trim();
}

function presenceVars() {
    const todayStats = getStatsForPeriod(stats, 'today');
    if (currentApp) todayStats[currentApp] = (todayStats[currentApp] || 0) + (Date.now() - sessionStart);
    const total = Object.values(todayStats).reduce((a, b) => a + b, 0);
    const top = Object.entries(todayStats).sort((a, b) => b[1] - a[1])[0];
    return {
        app: currentApp ? (friendlyNames[currentApp] || currentApp) : '',
        site: currentSite || '',
        session: currentApp ? formatHM(Date.now() - sessionStart) : '',
        time: formatHM(total),
        percent: (total / 864000).toFixed(1) + '%',
        top: top ? (friendlyNames[top[0]] || top[0]) : ''
    };
}

function updatePresence() {
    if (!settings.discordEnabled) return;
    const vars = presenceVars();
    const detailsTpl = settings.discordDetails || `${t('discord.using')} {app}`;
    const stateTpl = settings.discordState || `${t('discord.today')}: {time}`;
    const details = fillTemplate(detailsTpl, vars).slice(0, 120);
    const state = fillTemplate(stateTpl, vars).slice(0, 120);
    if (details.length < 2 && state.length < 2) return discord.setActivity(null);
    discord.setActivity({
        details: details.length >= 2 ? details : undefined,
        state: state.length >= 2 ? state : undefined,
        assets: { large_image: 'rastrata', large_text: 'Rastrata' },
        timestamps: settings.discordShowTimer && currentApp ? { start: Math.floor(sessionStart / 1000) } : undefined
    });
}

const DISCORD_CLIENT_ID = '1561466263438491780';

function configureDiscord() {
    discord.configure(settings.discordEnabled, DISCORD_CLIENT_ID);
    updatePresence();
}

function showSummaryToast(kinds) {
    const lang = document.documentElement.lang || 'en';
    const items = kinds.map((kind) => {
        const range = previousFull(kind, new Date());
        const keys = keysOf(range);
        const sum = summarize(stats, keys);
        const top = sum.apps[0];
        return {
            kind,
            label: rangeLabel(kind, range, t, lang),
            total: sum.total,
            share: sum.total / (keys.length * 86400000) * 100,
            top: top ? { name: friendlyNames[top[0]] || top[0], icon: icons[top[0]] || '', ms: top[1] } : null
        };
    });
    if (toastWin) toastWin.close(true);
    nw.Window.open('notification/notification.html', {
        width: 340,
        height: 200,
        frame: false,
        show: false,
        resizable: false,
        always_on_top: true,
        show_in_taskbar: false,
        focus: false
    }, (createdWin) => {
        toastWin = createdWin;
        createdWin.window.mainWindowRef = window;
        createdWin.window.toastData = items;
        createdWin.on('closed', () => { toastWin = null; });
    });
}

function checkSummaryNotifications() {
    if (!settings.summaryNotify) return;
    const today = new Date();
    const last = settings.lastSummary || {};
    const next = { ...last };
    const due = [];
    ['month', 'season', 'year'].forEach((kind) => {
        const range = previousFull(kind, today);
        if (last[kind] === range.fromKey) return;
        next[kind] = range.fromKey;
        if (keysOf(range).some((k) => stats[k] && Object.keys(stats[k]).length)) due.push(kind);
    });
    settings.lastSummary = next;
    saveSettings({ ...loadSettings(), lastSummary: next });
    if (!due.length) return;
    showSummaryToast(due);
}

setLanguage(settings.language);
applyTranslations(document);
refreshTheme();
applyAnimations();
document.body.style.setProperty('--bg-blur', Number(settings.backgroundBlur) || 0);
setGlow(settings.glow);
applyFont(settings.fontFamily, document);
renderList();

let lastDay = todayKey();

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderList();
});

setInterval(() => {
    if (todayKey() !== lastDay) {
        window.flushDataToDisk();
        lastDay = todayKey();
        checkSummaryNotifications();
    }
    renderList();
}, 1000);
setInterval(() => {
    saveStats(stats);
    saveSites(sites);
    saveFriendlyNames(friendlyNames);
}, SAVE_INTERVAL);
setInterval(refreshTheme, 30000);
setInterval(updatePresence, 15000);
setTimeout(configureDiscord, 3000);
setTimeout(() => { if (!settingsWin) createSettingsWin(true); }, 4000);
setTimeout(() => { if (!vizWin) createVizWin(true); }, 7000);
setTimeout(checkSummaryNotifications, 8000);

window.addEventListener('beforeunload', () => {
    if (currentApp) addTime(stats, currentApp, Date.now() - sessionStart);
    if (currentSite) addTime(sites, currentSite, Date.now() - siteStart);
    saveStats(stats);
    saveSites(sites);
    discord.stop();
    siteServer.close();
    if (urlReader) urlReader.stop();
});

document.getElementById('btn-minimize').addEventListener('click', () => win.minimize());

document.getElementById('btn-close').addEventListener('click', () => {
    if (tray) {
        win.hide();
    } else {
        if (settingsWin) settingsWin.close();
        if (vizWin) vizWin.close();
        if (toastWin) toastWin.close(true);
        win.close(true);
    }
});

win.on('close', function () {
    if (tray) {
        this.hide();
    } else {
        if (settingsWin) settingsWin.close();
        if (vizWin) vizWin.close();
        if (toastWin) toastWin.close(true);
        this.close(true);
    }
});

nw.App.on('open', function (cmdline) {
    win.show();
    win.focus();
});

function createSettingsWin(prewarm) {
    nw.Window.open('settings/settings.html' + (prewarm ? '#prewarm' : ''), {
        width: 420,
        height: Math.min(600, screen.availHeight - 60),
        min_width: 340,
        min_height: 300,
        frame: false,
        show: false,
        position: 'center',
        resizable: true
    }, (createdWin) => {
        settingsWin = createdWin;
        createdWin.window.mainWindowRef = window;
        createdWin.on('closed', () => { settingsWin = null; });
        if (!prewarm) setTimeout(() => createdWin.show(), 2500);
    });
}

function openSettings() {
    if (settingsWin) {
        settingsWin.show();
        settingsWin.focus();
        return;
    }
    createSettingsWin(false);
}

document.getElementById('btn-settings').addEventListener('click', openSettings);

function createVizWin(prewarm, mode, kind) {
    nw.Window.open('visualization/visualization.html' + (prewarm ? '#prewarm' : ''), {
        width: 720,
        height: 600,
        min_width: 520,
        min_height: 420,
        frame: false,
        show: false,
        position: 'center'
    }, (createdWin) => {
        vizWin = createdWin;
        createdWin.window.mainWindowRef = window;
        createdWin.window.initialMode = mode ? { mode, kind } : null;
        createdWin.on('closed', () => { vizWin = null; });
        if (!prewarm) setTimeout(() => createdWin.show(), 2500);
    });
}

function openViz(mode, kind) {
    if (vizWin) {
        const w = vizWin.window;
        if (mode && w.showMode) w.showMode(mode, kind);
        else if (w.onShown) w.onShown();
        else vizWin.show();
        vizWin.focus();
        return;
    }
    createVizWin(false, mode, kind);
}

document.getElementById('btn-viz').addEventListener('click', () => openViz());

window.openVizSummary = function (kind) {
    openViz('summary', kind);
};

window.getVizData = function () {
    const snapshot = JSON.parse(JSON.stringify(stats));
    if (currentApp) addTime(snapshot, currentApp, Date.now() - sessionStart);
    const siteSnap = JSON.parse(JSON.stringify(sites));
    if (currentSite) addTime(siteSnap, currentSite, Date.now() - siteStart);
    return { stats: snapshot, names: friendlyNames, icons, sites: siteSnap, siteIcons: siteIcons.icons };
};

window.updateThemeFromSettings = function (theme) {
    settings.theme = theme;
    refreshTheme();
};

window.updateThemeScheduleFromSettings = function () {
    Object.assign(settings, loadSettings());
    refreshTheme();
};

window.updateFontFromSettings = function (fontFamily) {
    settings.fontFamily = fontFamily;
    applyFont(fontFamily, document);
    if (vizWin && vizWin.window.onAppearanceChanged) vizWin.window.onAppearanceChanged();
};

window.updateExcludedFromSettings = function (list) {
    settings.excludedApps = list;
    if (currentApp && isExcluded(currentApp)) {
        addTime(stats, currentApp, Date.now() - sessionStart);
        currentApp = null;
        sessionStart = Date.now();
        renderList();
    }
};

window.updateGlowFromSettings = function (px) {
    settings.glow = px;
    setGlow(px);
    if (vizWin) vizWin.window.document.body.style.setProperty('--glow-size', px + 'px');
};

window.updateBlurFromSettings = function (px) {
    settings.backgroundBlur = px;
    document.body.style.setProperty('--bg-blur', px);
    if (vizWin) vizWin.window.document.body.style.setProperty('--bg-blur', px);
};

window.updateShowIconsFromSettings = function (showIcons) {
    settings.showIcons = showIcons;
    renderList();
};

window.updateLanguageFromSettings = function (language) {
    settings.language = language;
    setLanguage(language);
    applyTranslations(document);
    updatePeriodLabel();
    if (tray) tray.rebuildMenu();
    if (vizWin && vizWin.window.onAppearanceChanged) vizWin.window.onAppearanceChanged();
};

window.flushDataToDisk = function () {
    if (currentApp) {
        addTime(stats, currentApp, Date.now() - sessionStart);
        sessionStart = Date.now();
    }
    if (currentSite) {
        addTime(sites, currentSite, Date.now() - siteStart);
        siteStart = Date.now();
    }
    saveStats(stats);
    saveSites(sites);
    saveFriendlyNames(friendlyNames);
};

window.updateSettingsFromDisk = function () {
    Object.assign(settings, loadSettings());
    applyAnimations();
    if (!settings.trackSites) switchSite(null);
    ensureUrlReader();
    if (settings.windowSize !== lastSizeMode) {
        lastSizeMode = settings.windowSize;
        applyWindowSize();
    }
    configureDiscord();
    if (vizWin && vizWin.window.onAppearanceChanged) vizWin.window.onAppearanceChanged();
};

if (isTrayLaunch && settings.minimizeToTrayOnAutostart) {
    tray = setupTray(win, { iconPath: 'media/icon.png', appName: APP_NAME });
} else if (isTrayLaunch) {
    win.show();
}

const periodBtn = document.getElementById('period-btn');
const periodDropdown = document.getElementById('period-dropdown');

function updatePeriodLabel() {
    periodBtn.textContent = t('period.' + selectedPeriod) + ' ▾';
}
updatePeriodLabel();

periodBtn.addEventListener('click', () => periodDropdown.classList.toggle('hidden'));

periodDropdown.querySelectorAll('.dropdown-item').forEach((item) => {
    item.addEventListener('click', () => {
        selectedPeriod = item.dataset.period;
        updatePeriodLabel();
        periodDropdown.classList.add('hidden');
        renderList();
    });
});

document.addEventListener('click', (e) => {
    if (!periodBtn.contains(e.target) && !periodDropdown.contains(e.target)) {
        periodDropdown.classList.add('hidden');
    }
});

setTimeout(cleanupUpdateFiles, 10000);

setTimeout(() => {
    checkForUpdates('boochear', 'rastrata', pkg.version).then((result) => {
        if (!result.available) return;
        window.flushDataToDisk();
        if (settingsWin) settingsWin.close();
        if (vizWin) vizWin.close();
        if (tray) {
            tray.remove();
            tray = null;
        }
        applyUpdateAndRestart(result.downloadUrl).catch((err) => {
            console.error('Ошибка обновления:', err.message);
        });
    });
}, 5000);
