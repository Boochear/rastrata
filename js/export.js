const fs = require('fs');
const os = require('os');
const path = require('path');

const FILES = ['stats.json', 'icons.json', 'names.json', 'sites.json', 'siteicons.json'];

function exportData() {
    const exportDir = path.join(os.homedir(), 'Desktop', 'Rastrata Export');
    fs.mkdirSync(exportDir, { recursive: true });
    const copied = [];
    FILES.forEach((name) => {
        const src = path.join(process.cwd(), name);
        if (!fs.existsSync(src)) return;
        fs.copyFileSync(src, path.join(exportDir, name));
        copied.push(name);
    });
    return { exportDir, copied };
}

function importData() {
    const exportDir = path.join(os.homedir(), 'Desktop', 'Rastrata Export');
    if (!fs.existsSync(exportDir)) return { exportDir, found: [] };
    const found = FILES.filter((name) => fs.existsSync(path.join(exportDir, name)));
    found.forEach((name) => JSON.parse(fs.readFileSync(path.join(exportDir, name), 'utf-8')));
    found.forEach((name) => fs.copyFileSync(path.join(exportDir, name), path.join(process.cwd(), name)));
    fs.rmSync(exportDir, { recursive: true, force: true });
    return { exportDir, found };
}

module.exports = { exportData, importData };