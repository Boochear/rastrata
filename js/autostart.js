const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const APP_NAME = 'Rastrata';
const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

function setAutostartPosix(enabled) {
  const exePath = process.execPath;
  try {
    if (process.platform === 'linux') {
      const dir = path.join(os.homedir(), '.config', 'autostart');
      const file = path.join(dir, `${APP_NAME}.desktop`);
      if (enabled) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, `[Desktop Entry]\nType=Application\nName=${APP_NAME}\nExec="${exePath}"\nX-GNOME-Autostart-enabled=true\n`);
      } else {
        fs.rmSync(file, { force: true });
      }
    } else {
      const file = path.join(os.homedir(), 'Library', 'LaunchAgents', `com.${APP_NAME.toLowerCase()}.app.plist`);
      if (enabled) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>Label</key><string>com.${APP_NAME.toLowerCase()}.app</string><key>ProgramArguments</key><array><string>${exePath}</string></array><key>RunAtLoad</key><true/></dict></plist>\n`);
      } else {
        fs.rmSync(file, { force: true });
      }
    }
    return true;
  } catch (err) {
    console.error('autostart error:', err.message);
    return false;
  }
}

function setAutostart(enabled) {
  if (process.platform !== 'win32') return Promise.resolve(setAutostartPosix(enabled));
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