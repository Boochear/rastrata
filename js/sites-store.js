const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'sites.json');
let lastSaved = null;

function loadSites() {
    try {
        const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
        lastSaved = JSON.stringify(data);
        return data;
    } catch {
        return {};
    }
}

function saveSites(sites) {
    const json = JSON.stringify(sites);
    if (json === lastSaved) return;
    const tmpPath = FILE + '.tmp';
    try {
        fs.writeFileSync(tmpPath, json);
        fs.renameSync(tmpPath, FILE);
        lastSaved = json;
    } catch (err) {
        console.error('failed to save sites:', err.message);
    }
}

module.exports = { loadSites, saveSites };