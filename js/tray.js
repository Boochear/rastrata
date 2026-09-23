function setupTray(win, { iconPath, appName }) {
    const tray = new nw.Tray({ icon: iconPath });
    tray.tooltip = appName;

    const menu = new nw.Menu();
    menu.append(new nw.MenuItem({ label: 'Показать', click: () => { win.show(); win.focus(); } }));
    menu.append(new nw.MenuItem({ label: 'Выход', click: () => nw.App.quit() }));
    tray.menu = menu;

    tray.on('click', () => { win.show(); win.focus(); });

    return tray;
}

module.exports = { setupTray };