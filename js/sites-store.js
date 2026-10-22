const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'sites.json');

function loadSites() {
    try {
        return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    } catch {
        return {};
    }
}

function saveSites(sites) {
    const tmpPath = FILE + '.tmp';
    try {
        fs.writeFileSync(tmpPath, JSON.stringify(sites));
        fs.renameSync(tmpPath, FILE);
    } catch (err) {
        console.error('failed to save sites:', err.message);
    }
}

module.exports = { loadSites, saveSites };
