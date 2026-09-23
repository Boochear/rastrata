const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');

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
                    const asset = (json.assets || []).find(a => a.name.endsWith('.zip'));
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
    const rootDir = path.dirname(packageNwDir);
    const exeName = path.basename(process.execPath);
    const currentPid = process.pid;
    return downloadFile(downloadUrl, zipPath).then(() => {
        return new Promise((resolve, reject) => {
            const psExtract = `Expand-Archive -Path "${zipPath}" -DestinationPath "${extractDir}" -Force`;
            exec(`powershell -NoProfile -Command "${psExtract}"`, (err, stdout, stderr) => {
                if (err) {
                    console.error('extract failed:', stderr || err.message);
                    return reject(err);
                }
                resolve();
            });
        });
    }).then(() => {
        const batScript = `
@echo off
:wait
tasklist /FI "PID eq ${currentPid}" 2>NUL | find "${currentPid}" >NUL
if not errorlevel 1 (
  timeout /t 1 /nobreak >NUL
  goto wait
)
xcopy /E /Y /I "${extractDir}\\package.nw\\*" "${packageNwDir}"
if errorlevel 1 (
  echo update copy failed >> "${path.join(tmpDir, APP_NAME + '-update-error.log')}"
) else (
  rmdir /S /Q "${extractDir}"
  del "${zipPath}"
)
start "" "${path.join(rootDir, exeName)}"
del "%~f0"
`.trim();

        const batPath = path.join(tmpDir, `${APP_NAME}-apply-update.bat`);
        fs.writeFileSync(batPath, batScript, 'utf-8');

        spawn('cmd.exe', ['/c', batPath], { detached: true, stdio: 'ignore' }).unref();

        nw.App.quit();
    });
}

module.exports = { checkForUpdates, applyUpdateAndRestart };