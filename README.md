<div align="center">

**English** · [Русский](./README.ru.md)

<img width="256" height="256" alt="icon" src="https://github.com/user-attachments/assets/0c0a15db-b16e-430e-a8bc-63da9d1175dd" />

# Rastrata

**A time tracker for the apps you use on Windows**

Rastrata is a lightweight desktop app that tracks how much time you spend in each program and shows your statistics for any period: from today to your entire usage history.

</div>

---

## Features

- **Real-time tracking:** the active app is detected instantly, with no polling and no extra system load
- **Stats by period:** today, yesterday, 7 days, 30 days, year, all time
- **Data visualization:** interactive charts by app and by day with drill-down (click an app to see its usage per day, click a day to see the apps used that day)
- **32 themes:** from the classic black-and-white to Windows XP, Evangelion, Glitchcore, and soft dark palettes
  - 4 seasonal themes: Spring, Summer, Autumn, Winter
  - 4 holiday themes: Halloween, New Year, Thanksgiving, Longest Night Day
- **Automatic theme switching:** during holidays, during seasons, and during the night session
- **Night session hours:** choose when the night session starts and ends
- **Background blur**
- **Resizable settings window:** it now also has the same default size as the main window
- **Custom fonts:** choose any font installed on your system
- **93 languages:** the interface adapts to your system language automatically and can be switched in settings
- **Data export:** your entire history is copied to a folder on your desktop as plain JSON files (stats.json, names.json, icons.json)
- **App icons:** the list shows the real icons of your processes
- **Launch on startup:** starts minimized to the tray, with no extra windows when Windows boots
- **Desktop shortcut:** created in one click from settings
- **Auto-update:** the app checks GitHub for new versions and updates itself
- **Privacy:** all statistics are stored locally, nothing is sent to any server

## Screenshot
<img width="1920" height="1080" alt="2026_10_09_23_57_54" src="https://github.com/user-attachments/assets/c39cf80b-5d14-44d9-8bee-b5260c8cb357" />


## Installation

1. Go to [Releases](https://github.com/boochear/rastrata/releases)
2. Download `Rastrata-X.X.X-win-x64-full.zip`
3. Extract the archive to any folder
4. Run `Rastrata.exe`

The app works on **Windows 10/11** and needs no installation: just extract and run.

## How it works

Rastrata tracks active window changes through Windows system events and records time per process. The bare desktop and system overlays (Start menu, search) do not count as activity.

All data is stored locally as JSON files next to the app. There is no telemetry and no data is sent anywhere.

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
