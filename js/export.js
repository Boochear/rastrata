const fs = require('fs');
const os = require('os');
const path = require('path');

const FILES = ['stats.json', 'icons.json', 'names.json'];

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

module.exports = { exportData };