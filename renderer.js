const fs = require('fs');
const path = require('path');

const { loadSettings, saveSettings } = require('./js/settings-store');
const { loadIcons, createIconRequester } = require('./js/icon-store');
const { loadFriendlyNames, saveFriendlyNames } = require('./js/friendly-names-store');
const { todayKey, loadStats, saveStats, addTime, getStatsForPeriod, periodIncludesToday } = require('./js/stats-store');
const { startWatcher } = require('./js/watcher-client');
const { setupTray } = require('./js/tray');
const { checkForUpdates, applyUpdateAndRestart } = require('./js/updater');
const { applyFont } = require('./js/fonts');
const { setLanguage, t, applyTranslations } = require('./js/i18n');
const { resolveTheme } = require('./js/theme-scheduler');

const APP_NAME = 'Rastrata';
const SAVE_INTERVAL = 10000;
const pkg = require('./package.json');

let settings = loadSettings();
let stats = loadStats();
let friendlyNames = loadFriendlyNames();
let icons = loadIcons();

let currentApp = null;
let sessionStart = Date.now();
let selectedPeriod = 'today';
let settingsWin = null;
let vizWin = null;
let tray = null;

const win = nw.Window.get();

const TRAY_FLAG_PATH = path.join(process.cwd(), 'tray.flag');
const isTrayLaunch = fs.existsSync(TRAY_FLAG_PATH);

if (!isTrayLaunch) {
    win.show();
}

function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
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

function renderList() {
    const dayStats = getStatsForPeriod(stats, selectedPeriod);

    if (currentApp && periodIncludesToday(selectedPeriod)) {
        dayStats[currentApp] = (dayStats[currentApp] || 0) + (Date.now() - sessionStart);
    }
    const sorted = Object.entries(dayStats).sort((a, b) => b[1] - a[1]);
    const list = document.getElementById('list');
    const seenNames = new Set();
    sorted.forEach(([name, ms], index) => {
        seenNames.add(name);
        const isActive = name === currentApp && periodIncludesToday(selectedPeriod);
        const displayName = friendlyNames[name] || name;
        let row = list.querySelector(`[data-app="${CSS.escape(name)}"]`);
        if (!row) {
            row = document.createElement('div');
            row.className = 'row';
            row.dataset.app = name;
            row.innerHTML = `
        <div class="row-left">
          <span class="row-number"></span>
          <span class="row-icon-slot"></span>
          <span class="name">${displayName}</span>
        </div>
        <span class="time"></span>
      `;
            row.classList.add('row-new');
            list.appendChild(row);
        }
        row.querySelector('.row-number').textContent = `${index + 1}.`;
        row.querySelector('.time').textContent = formatMs(ms);
        row.classList.toggle('active', isActive);
        const iconSlot = row.querySelector('.row-icon-slot');
        const shouldHaveIcon = settings.showIcons && icons[name];
        const hasIconNow = iconSlot.querySelector('img') !== null;
        if (shouldHaveIcon && !hasIconNow) {
            iconSlot.innerHTML = `<img class="row-icon" src="${icons[name]}">`;
        } else if (!shouldHaveIcon && hasIconNow) {
            iconSlot.innerHTML = '';
        }
        const currentPos = Array.from(list.children).indexOf(row);
        if (currentPos !== index) {
            list.insertBefore(row, list.children[index] || null);
        }
    });
    Array.from(list.children).forEach((row) => {
        if (!seenNames.has(row.dataset.app)) {
            row.remove();
        }
    });
}

const requestIcon = createIconRequester(icons, renderList);

startWatcher({
    onNone() {
        if (currentApp) addTime(stats, currentApp, Date.now() - sessionStart);
        currentApp = null;
        sessionStart = Date.now();
        renderList();
    },
    onAppChange(appName, friendlyName, exePath) {
        if (appName === currentApp) return;
        friendlyNames[appName] = friendlyName || appName;
        requestIcon(appName, exePath);
        if (currentApp) addTime(stats, currentApp, Date.now() - sessionStart);
        currentApp = appName;
        sessionStart = Date.now();
        renderList();
    }
});

setLanguage(settings.language);
applyTranslations(document);
refreshTheme();
document.body.style.setProperty('--bg-blur', Number(settings.backgroundBlur) || 0);
applyFont(settings.fontFamily, document);
renderList();

setInterval(renderList, 1000);
setInterval(() => {
    saveStats(stats);
    saveFriendlyNames(friendlyNames);
}, SAVE_INTERVAL);
setInterval(refreshTheme, 30000);

window.addEventListener('beforeunload', () => {
    if (currentApp) addTime(stats, currentApp, Date.now() - sessionStart);
    saveStats(stats);
});

document.getElementById('btn-minimize').addEventListener('click', () => win.minimize());

document.getElementById('btn-close').addEventListener('click', () => {
    if (tray) {
        win.hide();
    } else {
        if (settingsWin) settingsWin.close();
        if (vizWin) vizWin.close();
        win.close(true);
    }
});

win.on('close', function () {
    if (tray) {
        this.hide();
    } else {
        if (settingsWin) settingsWin.close();
        if (vizWin) vizWin.close();
        this.close(true);
    }
});

nw.App.on('open', function (cmdline) {
    win.show();
    win.focus();
});

document.getElementById('btn-settings').addEventListener('click', () => {
    if (settingsWin) {
        settingsWin.focus();
        return;
    }
    nw.Window.open('settings/settings.html', {
        width: 420,
        height: Math.min(600, screen.availHeight - 60),
        min_width: 340,
        min_height: 300,
        frame: false,
        position: 'center',
        resizable: true
    }, (createdWin) => {
        settingsWin = createdWin;
        createdWin.window.mainWindowRef = window;
        settingsWin.on('closed', () => { settingsWin = null; });
    });
});

document.getElementById('btn-viz').addEventListener('click', () => {
    if (vizWin) {
        vizWin.focus();
        return;
    }
    nw.Window.open('visualization/visualization.html', {
        width: 720,
        height: 600,
        min_width: 520,
        min_height: 420,
        frame: false,
        position: 'center'
    }, (createdWin) => {
        vizWin = createdWin;
        createdWin.window.mainWindowRef = window;
        vizWin.on('closed', () => { vizWin = null; });
    });
});

window.getVizData = function () {
    const snapshot = JSON.parse(JSON.stringify(stats));
    if (currentApp) addTime(snapshot, currentApp, Date.now() - sessionStart);
    return { stats: snapshot, names: friendlyNames };
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
    saveStats(stats);
    saveFriendlyNames(friendlyNames);
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

checkForUpdates('boochear', 'rastrata', pkg.version).then((result) => {
    if (result.available) {
        applyUpdateAndRestart(result.downloadUrl).catch((err) => {
            console.error('Ошибка обновления:', err.message);
        });
    }
});