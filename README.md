<div align="center">

**English** · [Русский](./README.ru.md)

<img width="256" height="256" alt="icon" src="https://github.com/user-attachments/assets/0c0a15db-b16e-430e-a8bc-63da9d1175dd" />

# Rastrata

**A time tracker for the apps you use on Windows**

Rastrata is a lightweight desktop app that tracks how much time you spend in each program and shows your statistics for any period: from today to your entire usage history.

</div>

---

## Features

- **Real-time tracking**: the active app is detected instantly, with no polling and no extra load on the system
- **Statistics by period**: today, yesterday, 7 days, 30 days, a year, all time
- **Data visualization**: interactive charts by app or by day, with drill-down (click an app to see its daily usage, click a day to see its apps)
- **19 themes**: from classic black and white to Windows XP, Evangelion, Glitchcore and soft dark palettes
- **Custom fonts**: pick any font installed on your system
- **93 languages**: the interface follows your system language automatically and can be switched in settings
- **Data export**: copy your full history to a folder on the desktop as plain JSON
- **App icons**: the list shows the real icons of your processes
- **Autostart**: launches with the system, minimized to the tray, with no extra windows at Windows startup
- **Desktop shortcut**: created in one click from settings
- **Auto-update**: the app checks GitHub for new versions and updates itself
- **Privacy**: all statistics are stored locally and nothing is sent to any server

## Screenshots

<img width="814" height="633" alt="2026_09_23_12_37_14_explorer" src="https://github.com/user-attachments/assets/655e3118-c337-492d-ada3-7c13c3df2af2" />

## Installation

1. Go to [Releases](https://github.com/boochear/rastrata/releases)
2. Download `Rastrata-X.X.X-win-x64-full.zip`
3. Extract the archive to any folder
4. Run `Rastrata.exe`

The app works on **Windows 10/11** and needs no installation: just extract and run.

## How it works

Rastrata tracks active window changes through Windows system events and records time per process. The bare desktop and system overlays (Start menu, search) do not count as activity.

All data is stored locally as JSON files next to the app. There is no telemetry and no data is sent anywhere.

## Changelog

### v1.0.2: October 3, 2026

- 17 new themes
<img width="1318" height="1189" alt="Фрейм 19" src="https://github.com/user-attachments/assets/473b54ec-e47f-4ad1-bbdd-fae2afcd6cbb" />


- Font selection (any installed system font)
<img width="996" height="548" alt="Фрейм 23" src="https://github.com/user-attachments/assets/b33fdc5a-7327-4eb3-941d-65c5fcd861c0" />


- Export of all-time data (see [Data export](#data-export))

- Data visualization
<img width="1012" height="442" alt="Фрейм 24" src="https://github.com/user-attachments/assets/9f203dc0-3dd2-4111-94c6-e7150fe14852" />


- 92 new languages
<img width="1502" height="548" alt="Фрейм 25" src="https://github.com/user-attachments/assets/25142d8c-b7f6-476f-bd58-2c54190b4c47" />


- Removed developer options
- Removed the protection module, since this is now a release build

### v1.0.1: September 23, 2026

- Fixed a bug where the desktop shortcut icon disappeared if the app was located in a folder with a Cyrillic name

### v1.0: September 23, 2026

- Initial release

## Data export

In **Settings → Export data** the app copies `stats.json`, `names.json` and `icons.json` to `Desktop/Rastrata Export`. The files are copied as is, without any conversion.

**`stats.json`**: date → app → time spent in milliseconds.

```json
{
  "2026-10-02": {
    "chrome": 5400000,
    "Code": 1800000
  },
  "2026-10-03": {
    "chrome": 1260000,
    "Telegram": 95000
  }
}
```

**`names.json`**: internal app name → display name.

```json
{
  "chrome": "Google Chrome",
  "Code": "Visual Studio Code"
}
```

**`icons.json`**: internal app name → icon as a base64-encoded PNG data URL.

```json
{
  "chrome": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
}
```

Notes for anyone parsing the export:

- The three files are linked by the **internal app name** (the key in `stats.json`). Join on it to get display names and icons.
- Dates are `YYYY-MM-DD` in **UTC**, so a new "day" starts at midnight UTC, not local midnight.
- Time values are in **milliseconds**: `5400000` is 1 h 30 min.
- If an app has no icon yet, `icons.json` simply has no entry for it.

## Auto-update

On every launch Rastrata checks the [latest release on GitHub](https://github.com/boochear/rastrata/releases/latest). If a newer version is found, it is downloaded and applied automatically.

## License

This app is distributed **for free**, but with restrictions. See the [LICENSE](./LICENSE) file for details.

In short: you can freely download and use it, but you may not modify it, sell it or pass it off as your own.

## Creator

<div align="center">

<img width="240" height="240" alt="avatar" src="https://github.com/user-attachments/assets/630b1111-bb8c-4b73-ad39-8dbbdadc17a3" />

**Boochear**

[Telegram](https://t.me/boochear) · b0ochear2208@gmail.com

</div>

---

<div align="center">
<sub>2026 · Rastrata</sub>
</div>
