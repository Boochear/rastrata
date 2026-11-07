param([string]$IconPath, [string]$Tip, [uint32]$AppPid, [string]$AppTitle)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$src = @'
using System;
using System.Drawing;
using System.Threading;
using System.Windows.Forms;
using System.Runtime.InteropServices;

public class TrayHost {
    [DllImport("user32.dll")]
    static extern bool AllowSetForegroundWindow(int pid);

    [DllImport("user32.dll")]
    static extern short GetAsyncKeyState(int vKey);

    static volatile bool resync;
    static int rl, rt, rr, rb;
    static readonly ManualResetEvent gate = new ManualResetEvent(false);

    static bool Down(int vk) {
        return (GetAsyncKeyState(vk) & 0x8000) != 0;
    }

    static bool ButtonsDown() {
        return Down(1) || Down(2) || Down(4);
    }

    static volatile bool pending;

    // пока меню открыто: ловим нажатие любой кнопки мыши вне его области.
    // Закрытие засчитывается, когда кнопку отпустили, и отменяется, если это был клик по иконке трея
    static void Poll() {
        bool prev = false;
        while (true) {
            gate.WaitOne();
            if (resync) { prev = ButtonsDown(); resync = false; pending = false; }
            bool down = ButtonsDown();
            if (down && !prev) {
                Point p = Cursor.Position;
                if (p.X < rl || p.X >= rr || p.Y < rt || p.Y >= rb) pending = true;
            }
            if (pending && !down) {
                Thread.Sleep(150);
                if (pending) {
                    pending = false;
                    gate.Reset();
                    Console.WriteLine("outside");
                    Console.Out.Flush();
                }
            }
            prev = down;
            Thread.Sleep(25);
        }
    }

    public static void Run(string iconPath, string tip, uint pid, string title) {
        var ni = new NotifyIcon();
        try {
            using (var original = new Bitmap(iconPath))
            using (var bmp = new Bitmap(original, new Size(32, 32))) {
                ni.Icon = Icon.FromHandle(bmp.GetHicon());
            }
        } catch {
            ni.Icon = SystemIcons.Application;
        }
        ni.Text = tip.Length > 63 ? tip.Substring(0, 63) : tip;
        ni.Visible = true;

        ni.MouseUp += (s, e) => {
            pending = false;
            // разрешаем окнам приложения забрать фокус после клика
            AllowSetForegroundWindow(-1);
            if (e.Button == MouseButtons.Left) {
                Console.WriteLine("click");
            } else if (e.Button == MouseButtons.Right) {
                Point p = Cursor.Position;
                Console.WriteLine("menu|" + p.X + "|" + p.Y);
            }
            Console.Out.Flush();
        };

        var poller = new Thread(Poll);
        poller.IsBackground = true;
        poller.Start();

        // команды от приложения: arm|left|top|right|bottom и disarm; закрытие ввода = выход
        var reader = new Thread(() => {
            string line;
            while ((line = Console.In.ReadLine()) != null) {
                if (line.StartsWith("arm|")) {
                    string[] a = line.Split('|');
                    try {
                        rl = int.Parse(a[1]); rt = int.Parse(a[2]);
                        rr = int.Parse(a[3]); rb = int.Parse(a[4]);
                        resync = true;
                        gate.Set();
                    } catch { }
                } else if (line == "disarm") {
                    gate.Reset();
                    pending = false;
                }
            }
            ni.Visible = false;
            ni.Dispose();
            Environment.Exit(0);
        });
        reader.IsBackground = true;
        reader.Start();

        Application.Run();
    }
}
'@

$refs = @('System.Windows.Forms', 'System.Drawing')
$sha = [System.Security.Cryptography.SHA1]::Create()
$h = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($src)))).Replace('-', '').Substring(0, 12)
$dll = Join-Path $env:TEMP "rastrata-trayhost-$h.dll"
$loaded = $false
if (Test-Path $dll) { try { Add-Type -Path $dll; $loaded = $true } catch { } }
if (-not $loaded) {
    try { Add-Type -TypeDefinition $src -ReferencedAssemblies $refs -OutputAssembly $dll; Add-Type -Path $dll; $loaded = $true } catch { }
}
if (-not $loaded) { Add-Type -TypeDefinition $src -ReferencedAssemblies $refs }

[TrayHost]::Run($IconPath, $Tip, $AppPid, $AppTitle)
