const { t } = require('./i18n');

function buildMenu(win) {
    const menu = new nw.Menu();
    menu.append(new nw.MenuItem({ label: t('tray.show'), click: () => { win.show(); win.focus(); } }));
    menu.append(new nw.MenuItem({ label: t('tray.quit'), click: () => nw.App.quit() }));
    return menu;
}

function setupTray(win, { iconPath, appName }) {
    const tray = new nw.Tray({ icon: iconPath });
    tray.tooltip = appName;
    tray.menu = buildMenu(win);
    tray.on('click', () => { win.show(); win.focus(); });
    tray.rebuildMenu = () => { tray.menu = buildMenu(win); };
    return tray;
}

module.exports = { setupTray };