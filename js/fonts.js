const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

let cache = null;

function getSystemFonts() {
    if (cache) return Promise.resolve(cache);

    return new Promise((resolve) => {
        const psScript = `
Add-Type -AssemblyName System.Drawing
$names = (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }
$json = ConvertTo-Json -InputObject @($names) -Compress
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
`.trim();

        const tmpFile = path.join(os.tmpdir(), 'list-fonts.ps1');
        fs.writeFileSync(tmpFile, psScript, 'utf-8');

        exec(
            `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpFile}"`,
            { maxBuffer: 1024 * 1024 * 10 },
            (err, stdout, stderr) => {
                fs.unlink(tmpFile, () => { });
                if (err || !stdout.trim()) {
                    console.error('font list failed:', stderr || (err && err.message));
                    return resolve([]);
                }
                try {
                    const json = Buffer.from(stdout.trim(), 'base64').toString('utf8');
                    cache = JSON.parse(json).sort((a, b) => a.localeCompare(b));
                    resolve(cache);
                } catch (e) {
                    console.error('font list parse error:', e.message);
                    resolve([]);
                }
            }
        );
    });
}

function applyFont(fontName, doc) {
    let styleEl = doc.getElementById('app-font-style');
    if (!styleEl) {
        styleEl = doc.createElement('style');
        styleEl.id = 'app-font-style';
        doc.head.appendChild(styleEl);
    }
    if (!fontName) {
        styleEl.textContent = '';
        return;
    }
    const safe = fontName.replace(/["\\]/g, '');
    styleEl.textContent = `body, body *, .btn { font-family: "${safe}", 'Montserrat', sans-serif !important; }`;
}

module.exports = { getSystemFonts, applyFont };