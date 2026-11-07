const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

let cache = null;
const CACHE_FILE = path.join(os.tmpdir(), 'rastrata-fonts.json');

function fontsStamp() {
    const dirs = [
        path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts'),
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Fonts')
    ];
    return dirs.map((d) => { try { return fs.statSync(d).mtimeMs; } catch { return 0; } }).join('|');
}

function readDiskCache() {
    try {
        const c = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        if (c.stamp === fontsStamp() && Array.isArray(c.list)) return c.list;
    } catch { }
    return null;
}

function getPosixFonts() {
    return new Promise((resolve) => {
        const done = (list) => {
            cache = [...new Set(list)].sort((a, b) => a.localeCompare(b));
            resolve(cache);
        };
        if (process.platform === 'linux') {
            exec('fc-list : family', { maxBuffer: 1024 * 1024 * 10 }, (err, stdout) => {
                done(err ? [] : stdout.split('\n').map((l) => l.split(',')[0].trim()).filter(Boolean));
            });
        } else if (window.queryLocalFonts) {
            window.queryLocalFonts().then((list) => done(list.map((x) => x.family))).catch(() => done([]));
        } else {
            done([]);
        }
    });
}

function getSystemFonts() {
    if (cache) return Promise.resolve(cache);
    if (process.platform !== 'win32') return getPosixFonts();
    const disk = readDiskCache();
    if (disk) { cache = disk; return Promise.resolve(cache); }
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
                    cache = JSON.parse(json).sort((a, b) => a.localeCompare(b));
                    try { fs.writeFileSync(CACHE_FILE, JSON.stringify({ stamp: fontsStamp(), list: cache })); } catch { }
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
    let css = '';
    if (fontName) {
        const safe = fontName.replace(/["\\]/g, '');
        css = `body, body *, .btn { font-family: "${safe}", 'Montserrat', sans-serif !important; }`;
    }
    if (styleEl.textContent !== css) styleEl.textContent = css;
}

module.exports = { getSystemFonts, applyFont };