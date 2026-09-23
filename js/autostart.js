const { exec } = require('child_process');

const APP_NAME = 'Rastrata';
const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

function setAutostart(enabled) {
  return new Promise((resolve) => {
    if (enabled) {
      const exePath = process.execPath;
      const cmd = `reg add "${RUN_KEY}" /v "${APP_NAME}" /t REG_SZ /d "\\"${exePath}\\"" /f`;
      exec(cmd, (err, stdout, stderr) => {
        if (err) console.error('autostart error:', stderr || err.message);
        resolve(!err);
      });
    } else {
      exec(`reg delete "${RUN_KEY}" /v "${APP_NAME}" /f`, () => resolve(true));
    }
  });
}

module.exports = { setAutostart };