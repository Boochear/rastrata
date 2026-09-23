const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

const DEFAULT_SETTINGS = {
    autostart: false,
    minimizeToTrayOnAutostart: true,
    theme: 'white', // 'white' | 'black' | 'sepia' | 'midnight' | 'forest' | 'crimson' | 'lavender' | 'ocean' | 'sunset' | 'graphite'
    showIcons: true
};

function loadSettings() {
    try {
        const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings(settings) {
    const tmpPath = SETTINGS_FILE + '.tmp';
    try {
        fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2));
        fs.renameSync(tmpPath, SETTINGS_FILE);
    } catch (err) {
        console.error('failed to save settings:', err.message);
    }
}

module.exports = { loadSettings, saveSettings, DEFAULT_SETTINGS };