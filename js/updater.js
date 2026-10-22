const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const APP_NAME = 'Rastrata';
const USER_AGENT = `${APP_NAME}-app`;

function checkForUpdates(owner, repo, currentVersion) {
    return new Promise((resolve) => {
        https.get(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
            headers: { 'User-Agent': USER_AGENT }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const latestVersion = (json.tag_name || '').replace(/^v/, '');
                    const assets = json.assets || [];
                    const asset = assets.find(a => a.name.includes(`-${process.platform}-${process.arch}`) && a.name.endsWith('.zip')) || assets.find(a => a.name.includes(`-${process.platform}`) && a.name.endsWith('.zip')) || assets.find(a => a.name.endsWith('-update.zip')) || assets.find(a => a.name.endsWith('.zip'));
                    if (latestVersion && asset && isNewer(latestVersion, currentVersion)) {
                        resolve({ available: true, version: latestVersion, downloadUrl: asset.browser_download_url });
                    } else {
                        resolve({ available: false });
                    }
                } catch (e) {
                    console.error('update check parse error:', e.message);
                    resolve({ available: false });
                }
            });
        }).on('error', (e) => {
            console.error('update check request error:', e.message);
            resolve({ available: false });
        });
    });
}

function isNewer(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const x = pa[i] || 0, y = pb[i] || 0;
        if (x > y) return true;
        if (x < y) return false;
    }
    return false;
}

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                file.close();
                return reject(new Error(`download failed with status ${res.statusCode}`));
            }
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => {
            fs.unlink(destPath, () => { });
            reject(err);
        });
    });
}

function applyUpdateAndRestart(downloadUrl) {
    const tmpDir = os.tmpdir();
    const zipPath = path.join(tmpDir, `${APP_NAME}-update.zip`);
    const extractDir = path.join(tmpDir, `${APP_NAME}-update`);
    const packageNwDir = process.cwd();

    return downloadFile(downloadUrl, zipPath).then(() => new Promise((resolve, reject) => {
        fs.rmSync(extractDir, { recursive: true, force: true });
        const cmd = process.platform === 'win32'
            ? `powershell -NoProfile -Command "Expand-Archive -Path \"${zipPath}\" -DestinationPath \"${extractDir}\" -Force"`
            : `unzip -o -q "${zipPath}" -d "${extractDir}"`;
        exec(cmd, { windowsHide: true }, (err) => err ? reject(err) : resolve());
    })).then(() => {
        fs.cpSync(path.join(extractDir, 'package.nw'), packageNwDir, { recursive: true, force: true });
        fs.rmSync(extractDir, { recursive: true, force: true });
        fs.rmSync(zipPath, { force: true });
        nw.Window.get().reload();
    });
}

function cleanupUpdateFiles() {
    const tmpDir = os.tmpdir();
    const logPath = path.join(tmpDir, `${APP_NAME}-update.log`);
    const errPath = path.join(tmpDir, `${APP_NAME}-update-error.log`);
    const rm = (p, opts) => fs.rm(p, { force: true, ...opts }, () => { });

    rm(path.join(tmpDir, `${APP_NAME}-update.zip`));
    rm(path.join(tmpDir, `${APP_NAME}-apply-update.bat`));
    rm(path.join(tmpDir, `${APP_NAME}-update.vbs`));
    rm(path.join(tmpDir, `${APP_NAME}-update`), { recursive: true });
    rm(logPath);
    rm(errPath);
}

module.exports = { checkForUpdates, applyUpdateAndRestart, cleanupUpdateFiles };
