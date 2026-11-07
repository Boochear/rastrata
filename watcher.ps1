$src = @'
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Text;
using System.Collections.Generic;

public class Watcher {
    delegate void WinEventDelegate(IntPtr hWinEventHook, uint eventType, IntPtr hwnd, int idObject, int idChild, uint dwEventThread, uint dwmsEventTime);
    static WinEventDelegate fgDelegate = new WinEventDelegate(OnForeground);
    static WinEventDelegate nameDelegate = new WinEventDelegate(OnNameChange);
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

    class Info { public string name, desc, exe; }
    static readonly Dictionary<uint, Info> cache = new Dictionary<uint, Info>();
    static IntPtr nameHook = IntPtr.Zero;
    static uint nameHookPid = 0;

    static string lastEmittedKey = null;
    static bool lastIsBrowser = false;

    [StructLayout(LayoutKind.Sequential)]
    struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam; public uint time; public int ptX; public int ptY; }

    [DllImport("user32.dll")]
    static extern IntPtr SetWinEventHook(uint eventMin, uint eventMax, IntPtr hmodWinEventProc, WinEventDelegate lpfnWinEventProc, uint idProcess, uint idThread, uint dwFlags);

    [DllImport("user32.dll")]
    static extern bool UnhookWinEvent(IntPtr hook);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern int GetMessage(out MSG m, IntPtr hWnd, uint min, uint max);

    [DllImport("user32.dll")]
    static extern bool TranslateMessage(ref MSG m);

    [DllImport("user32.dll")]
    static extern IntPtr DispatchMessage(ref MSG m);

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

    static void SetNameHook(uint pid, bool wanted) {
        if (!wanted) {
            if (nameHook != IntPtr.Zero) { UnhookWinEvent(nameHook); nameHook = IntPtr.Zero; nameHookPid = 0; }
            return;
        }
        if (nameHook != IntPtr.Zero && nameHookPid == pid) return;
        if (nameHook != IntPtr.Zero) UnhookWinEvent(nameHook);
        nameHook = SetWinEventHook(EVENT_OBJECT_NAMECHANGE, EVENT_OBJECT_NAMECHANGE, IntPtr.Zero, nameDelegate, pid, 0, WINEVENT_OUTOFCONTEXT);
        nameHookPid = pid;
    }

    static void ProcessWindow(IntPtr hwnd, bool updateHook) {
        if (hwnd == IntPtr.Zero) {
            if (updateHook) SetNameHook(0, false);
            EmitNone();
            return;
        }

        uint pid;
        GetWindowThreadProcessId(hwnd, out pid);
        try {
            using (var proc = Process.GetProcessById((int)pid)) {
                string name = proc.ProcessName;

                if (name == "explorer") {
                    string title = GetTitle(hwnd);
                    if (title == "Program Manager" || title == "") {
                        if (updateHook) SetNameHook(0, false);
                        EmitNone();
                        return;
                    }
                } else if (IgnoredProcesses.Contains(name)) {
                    if (updateHook) SetNameHook(0, false);
                    EmitNone();
                    return;
                }

                Info info;
                if (!cache.TryGetValue(pid, out info) || info.name != name) {
                    string exePath = "";
                    string desc = "";
                    try {
                        exePath = proc.MainModule.FileName;
                        desc = proc.MainModule.FileVersionInfo.FileDescription;
                    } catch { }
                    if (string.IsNullOrWhiteSpace(desc)) desc = name;
                    info = new Info { name = name, desc = desc, exe = exePath };
                    if (cache.Count > 256) cache.Clear();
                    cache[pid] = info;
                }

                bool isBrowser = Browsers.Contains(name.ToLower());
                lastIsBrowser = isBrowser;
                if (updateHook) SetNameHook(pid, isBrowser);
                string winTitle = isBrowser ? GetTitle(hwnd).Replace("|", "/") : "";
                string key = name + "|" + pid + (isBrowser ? "|" + winTitle : "");
                Emit(key, name, info.desc, info.exe, winTitle);
            }
        } catch {
            if (updateHook) SetNameHook(0, false);
            EmitNone();
        }
    }

    static void OnForeground(IntPtr hook, uint eventType, IntPtr hwnd, int idObject, int idChild, uint thread, uint time) {
        ProcessWindow(hwnd, true);
    }

    static void OnNameChange(IntPtr hook, uint eventType, IntPtr hwnd, int idObject, int idChild, uint thread, uint time) {
        if (idObject != 0 || !lastIsBrowser || hwnd != GetForegroundWindow()) return;
        ProcessWindow(hwnd, false);
    }

    public static void Run() {
        ProcessWindow(GetForegroundWindow(), true);
        SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, IntPtr.Zero, fgDelegate, 0, 0, WINEVENT_OUTOFCONTEXT);
        MSG m;
        while (GetMessage(out m, IntPtr.Zero, 0, 0) > 0) {
            TranslateMessage(ref m);
            DispatchMessage(ref m);
        }
    }
}
'@

$sha = [System.Security.Cryptography.SHA1]::Create()
$h = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($src)))).Replace('-', '').Substring(0, 12)
$dll = Join-Path $env:TEMP "rastrata-watcher-$h.dll"
$loaded = $false
if (Test-Path $dll) { try { Add-Type -Path $dll; $loaded = $true } catch { } }
if (-not $loaded) {
    try { Add-Type -TypeDefinition $src -OutputAssembly $dll; Add-Type -Path $dll; $loaded = $true } catch { }
}
if (-not $loaded) { Add-Type -TypeDefinition $src }

[Watcher]::Run()