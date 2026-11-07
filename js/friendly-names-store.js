const fs = require('fs');
const path = require('path');

const NAMES_FILE = path.join(process.cwd(), 'names.json');
let lastSaved = null;

function loadFriendlyNames() {
    try {
        const raw = fs.readFileSync(NAMES_FILE, 'utf-8');
        const data = JSON.parse(raw);
        lastSaved = JSON.stringify(data);
        return data;
    } catch {
        return {};
    }
}

function saveFriendlyNames(names) {
    const json = JSON.stringify(names);
    if (json === lastSaved) return;
    const tmpPath = NAMES_FILE + '.tmp';
    try {
        fs.writeFileSync(tmpPath, json);
        fs.renameSync(tmpPath, NAMES_FILE);
        lastSaved = json;
    } catch (err) {
        console.error('failed to save friendly names:', err.message);
    }
}

module.exports = { loadFriendlyNames, saveFriendlyNames };