Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Text;
using System.Collections.Generic;

public class Watcher {
    delegate void WinEventDelegate(IntPtr hWinEventHook, uint eventType, IntPtr hwnd, int idObject, int idChild, uint dwEventThread, uint dwmsEventTime);
    static WinEventDelegate procDelegate = new WinEventDelegate(WinEventProc);
    const uint EVENT_SYSTEM_FOREGROUND = 3;
    const uint EVENT_OBJECT_NAMECHANGE = 0x800C;
    const uint WINEVENT_OUTOFCONTEXT = 0;

    static readonly HashSet<string> IgnoredProcesses = new HashSet<string> {
        "ShellExperienceHost",
        "StartMenuExperienceHost",
        "SearchApp",
        "SearchHost",
        "ApplicationFrameHost"
    };

    static readonly HashSet<string> Browsers = new HashSet<string> {
        "chrome", "msedge", "firefox", "opera", "brave", "vivaldi", "browser", "iexplore", "arc", "chromium"
    };

    static string lastEmittedKey = null;
    static bool lastIsBrowser = false;

    [DllImport("user32.dll")]
    static extern IntPtr SetWinEventHook(uint eventMin, uint eventMax, IntPtr hmodWinEventProc, WinEventDelegate lpfnWinEventProc, uint idProcess, uint idThread, uint dwFlags);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    static extern int GetWindowTextLength(IntPtr hWnd);

    static string GetTitle(IntPtr hwnd) {
        int len = GetWindowTextLength(hwnd);
        if (len == 0) return "";
        var sb = new StringBuilder(len + 1);
        GetWindowText(hwnd, sb, sb.Capacity);
        return sb.ToString();
    }

    static void Emit(string key, string name, string desc, string exePath, string title) {
        if (key == lastEmittedKey) return;
        lastEmittedKey = key;

        string raw = name + "|" + desc + "|" + exePath + "|" + title;
        byte[] bytes = Encoding.UTF8.GetBytes(raw);
        Console.WriteLine(Convert.ToBase64String(bytes));
        Console.Out.Flush();
    }

    static void EmitNone() {
        if (lastEmittedKey == "none") return;
        lastEmittedKey = "none";
        lastIsBrowser = false;

        Console.WriteLine("none");
        Console.Out.Flush();
    }

    static void ProcessWindow(IntPtr hwnd) {
        if (hwnd == IntPtr.Zero) {
            EmitNone();
            return;
        }

        uint pid;
        GetWindowThreadProcessId(hwnd, out pid);
        try {
            var proc = Process.GetProcessById((int)pid);
            string name = proc.ProcessName;

            if (name == "explorer") {
                string title = GetTitle(hwnd);
                if (title == "Program Manager" || title == "") {
                    EmitNone();
                    return;
                }
            } else if (IgnoredProcesses.Contains(name)) {
                EmitNone();
                return;
            }

            string desc = "";
            string exePath = "";
            try {
                exePath = proc.MainModule.FileName;
                desc = proc.MainModule.FileVersionInfo.FileDescription;
            } catch {
            }
            if (string.IsNullOrWhiteSpace(desc)) desc = name;

            bool isBrowser = Browsers.Contains(name.ToLower());
            lastIsBrowser = isBrowser;
            string winTitle = isBrowser ? GetTitle(hwnd).Replace("|", "/") : "";
            string key = name + "|" + pid + (isBrowser ? "|" + winTitle : "");
            Emit(key, name, desc, exePath, winTitle);
        } catch {
            EmitNone();
        }
    }

    static void WinEventProc(IntPtr hWinEventHook, uint eventType, IntPtr hwnd, int idObject, int idChild, uint dwEventThread, uint dwmsEventTime) {
        if (eventType == EVENT_OBJECT_NAMECHANGE) {
            if (idObject != 0 || !lastIsBrowser || hwnd != GetForegroundWindow()) return;
        }
        ProcessWindow(hwnd);
    }

    public static void Run() {
        ProcessWindow(GetForegroundWindow());

        SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, IntPtr.Zero, procDelegate, 0, 0, WINEVENT_OUTOFCONTEXT);
        SetWinEventHook(EVENT_OBJECT_NAMECHANGE, EVENT_OBJECT_NAMECHANGE, IntPtr.Zero, procDelegate, 0, 0, WINEVENT_OUTOFCONTEXT);
        Application.Run();
    }
}
"@ -ReferencedAssemblies System.Windows.Forms

[Watcher]::Run()