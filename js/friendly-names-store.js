const fs = require('fs');
const path = require('path');

const NAMES_FILE = path.join(process.cwd(), 'names.json');

function loadFriendlyNames() {
    try {
        return JSON.parse(fs.readFileSync(NAMES_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

function saveFriendlyNames(names) {
    const tmpPath = NAMES_FILE + '.tmp';
    try {
        fs.writeFileSync(tmpPath, JSON.stringify(names, null, 2));
        fs.renameSync(tmpPath, NAMES_FILE);
    } catch (err) {
        console.error('failed to save friendly names:', err.message);
    }
}

module.exports = { loadFriendlyNames, saveFriendlyNames };