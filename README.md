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
<img width="620" height="705" alt="2026_10_03_23_17_02_Rastrata" src="https://github.com/user-attachments/assets/6e066acd-7c07-4d98-9190-5b0402374444" />
<img width="620" height="705" alt="2026_10_03_23_17_06_Rastrata" src="https://github.com/user-attachments/assets/f2cc9d86-33a1-4df6-8bb6-cd68c8ee8dea" />
<img width="620" height="705" alt="2026_10_03_23_17_58_Rastrata" src="https://github.com/user-attachments/assets/292372cb-6ae6-4b77-9e14-ca12aabb40fb" />
<img width="620" height="705" alt="2026_10_03_23_17_53_Rastrata" src="https://github.com/user-attachments/assets/7d308948-7166-463a-8f72-2f7c89368ebd" />
<img width="620" height="705" alt="2026_10_03_23_17_50_Rastrata" src="https://github.com/user-attachments/assets/5b8a6a06-f539-40bd-b798-f1bd570aab2e" />
<img width="620" height="705" alt="2026_10_03_23_17_47_Rastrata" src="https://github.com/user-attachments/assets/7cf7212c-2a22-44e5-9275-f3a5a55a9017" />
<img width="620" height="705" alt="2026_10_03_23_17_44_Rastrata" src="https://github.com/user-attachments/assets/2a425350-0f2e-492f-b9b0-8e08dbe55e4e" />
<img width="620" height="705" alt="2026_10_03_23_17_42_Rastrata" src="https://github.com/user-attachments/assets/f23e46b7-7aae-456a-9c76-45bed9f0e9b8" />
<img width="620" height="705" alt="2026_10_03_23_17_38_Rastrata" src="https://github.com/user-attachments/assets/49f1205f-f1dc-4667-a780-fe8aa0a1e9d7" />
<img width="620" height="705" alt="2026_10_03_23_17_33_Rastrata" src="https://github.com/user-attachments/assets/aa093c70-59d2-456b-b061-8f3d8da28247" />
<img width="620" height="705" alt="2026_10_03_23_17_29_Rastrata" src="https://github.com/user-attachments/assets/a405358a-8d71-4f1a-8da8-36b4d83c25e6" />
<img width="620" height="705" alt="2026_10_03_23_17_26_Rastrata" src="https://github.com/user-attachments/assets/960f0329-10c6-4c59-be91-debac0ab360e" />
<img width="620" height="705" alt="2026_10_03_23_17_21_Rastrata" src="https://github.com/user-attachments/assets/8288fb6e-88d3-4a2e-82fb-955963315f1c" />
<img width="620" height="705" alt="2026_10_03_23_17_18_Rastrata" src="https://github.com/user-attachments/assets/576ea61c-f468-428e-83cc-326a61b10e0e" />
<img width="620" height="705" alt="2026_10_03_23_17_14_Rastrata" src="https://github.com/user-attachments/assets/b5c08e6f-1110-4ec3-ba3f-2610d65ffd0c" />
<img width="620" height="705" alt="2026_10_03_23_17_09_Rastrata" src="https://github.com/user-attachments/assets/e76b04f1-30f2-4b1b-905f-2010f756bc28" />

- Font selection (any installed system font)
<img width="620" height="705" alt="2026_10_03_23_18_40_Rastrata" src="https://github.com/user-attachments/assets/3d8eb91e-6aa4-46bc-8e81-feb5989b230e" />
<img width="620" height="705" alt="2026_10_03_23_18_01_Rastrata" src="https://github.com/user-attachments/assets/adcdb466-4109-458d-8179-6b121184d4f0" />
<img width="620" height="705" alt="2026_10_03_23_18_45_Rastrata" src="https://github.com/user-attachments/assets/29ef47df-b3ac-44a6-9a30-704ec3c9fa04" />

- Export of all-time data (see [Data export](#data-export))

- Data visualization
<img width="775" height="694" alt="2026_10_03_23_20_15_Rastrata" src="https://github.com/user-attachments/assets/8928d1c9-7d02-4b93-a68a-5aadbdeacb81" />
<img width="775" height="694" alt="2026_10_03_23_20_11_Rastrata" src="https://github.com/user-attachments/assets/34b20a5d-7e50-4248-8439-a5668c9e3874" />

- 92 new languages
<img width="620" height="705" alt="2026_10_03_23_20_53_Rastrata" src="https://github.com/user-attachments/assets/7616c0e5-e487-4057-93b5-7911912f2c48" />
<img width="620" height="705" alt="2026_10_03_23_20_38_Rastrata" src="https://github.com/user-attachments/assets/b8ead205-0cca-4f4c-bdac-75c0d1373408" />
<img width="620" height="705" alt="2026_10_03_23_20_32_Rastrata" src="https://github.com/user-attachments/assets/98db3957-8987-4f8c-b8d8-714f94f290e4" />

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