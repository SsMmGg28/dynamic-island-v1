const { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage, globalShortcut, clipboard, shell, dialog, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const https = require('https');
const http = require('http');

let Store;
try { Store = require('electron-store'); } catch (e) { Store = null; }

// Lazy-loaded on first use to reduce startup RAM (~20-30MB each)
let loudness = null;
let loudnessLoaded = false;
function getLoudness() {
    if (!loudnessLoaded) {
        loudnessLoaded = true;
        try { loudness = require('loudness'); } catch (e) { loudness = null; }
    }
    return loudness;
}

let si = null;
let siLoaded = false;
function getSI() {
    if (!siLoaded) {
        siLoaded = true;
        try { si = require('systeminformation'); } catch (e) { si = null; }
    }
    return si;
}

// ── Globals ──
let mainWindow, tray, store, mediaBridge;
let mediaBridgeReady = false;
let mediaBridgeCallbacks = [];
let gameModeActive = false;
let mediaPollingInterval;
let mediaBridgeCrashCount = 0;
let clipboardInterval = null;
let lastClipboardText = '';
let clipboardHistory = [];
let cachedInstalledApps = null;
let installedAppsLoading = false;

const DEFAULT_SETTINGS = {
    accentColor: '#3b82f6',
    opacity: 90,
    position: 'center',
    showLyrics: true,
    weatherCity: '',
    weatherLat: null,
    weatherLon: null,
    timerMinutes: 25,
    autoStart: false,
    islandWidth: 360,
    theme: 'dark',
    shortcuts: {
        toggleIsland: 'CmdOrCtrl+Alt+Space',
        mediaToggle: 'CmdOrCtrl+Alt+M',
        mediaNext: 'CmdOrCtrl+Alt+Right',
        mediaPrev: 'CmdOrCtrl+Alt+Left',
        gameMode: 'CmdOrCtrl+Alt+G',
        timerToggle: 'CmdOrCtrl+Alt+T',
    },
    launcherApps: [],
    notes: [],
    idleTimeout: 15,
};

// ── Store ──
function initStore() {
    if (Store) {
        store = new Store({ defaults: { settings: DEFAULT_SETTINGS } });
    } else {
        store = {
            _data: { settings: { ...DEFAULT_SETTINGS } },
            get(key) { return key ? this._data[key] : this._data; },
            set(key, val) { this._data[key] = val; },
        };
    }
}

// ── Window ──
function createWindow() {
    const primary = screen.getPrimaryDisplay();
    const { width: sw } = primary.workAreaSize;
    const settings = store.get('settings') || DEFAULT_SETTINGS;
    const winW = 520, winH = 800;
    let x = Math.round((sw - winW) / 2);
    
    // Restore saved position
    const savedPos = store.get('windowPosition');
    if (savedPos && typeof savedPos.x === 'number') {
        x = savedPos.x;
    } else if (settings.position === 'left') {
        x = 20;
    } else if (settings.position === 'right') {
        x = sw - winW - 20;
    }

    const y = savedPos && typeof savedPos.y === 'number' ? savedPos.y : 0;

    mainWindow = new BrowserWindow({
        width: winW,
        height: winH,
        x,
        y,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        focusable: true,
        show: false,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            backgroundThrottling: false,
        },
    });

    mainWindow.setAlwaysOnTop(true, 'floating');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    mainWindow.setIgnoreMouseEvents(true, { forward: true });

    // Show window only after content is painted to avoid blank flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.showInactive();
    });

    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

    // Debounced position save to avoid excessive writes
    let moveSaveTimer = null;
    mainWindow.on('moved', () => {
        if (moveSaveTimer) clearTimeout(moveSaveTimer);
        moveSaveTimer = setTimeout(() => {
            const [wx, wy] = mainWindow.getPosition();
            store.set('windowPosition', { x: wx, y: wy });
        }, 300);
    });

    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // Apply saved auto-start setting
    applyAutoStart(settings.autoStart);
}

// ── System Tray ──
function createTray() {
    const iconPath = path.join(__dirname, 'icon.ico');
    let trayIcon;
    try {
        trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    } catch {
        // Fallback: generate simple icon
        const size = 16;
        const canvas = Buffer.alloc(size * size * 4);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;
                const cx = x - size / 2, cy = y - size / 2;
                const dist = Math.sqrt(cx * cx + cy * cy);
                if (dist < size / 2 - 1) {
                    canvas[idx] = 59; canvas[idx + 1] = 130; canvas[idx + 2] = 246; canvas[idx + 3] = 255;
                }
            }
        }
        trayIcon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
    }

    tray = new Tray(trayIcon);
    tray.setToolTip('Dynamic Island');
    updateTrayMenu();
}

function updateTrayMenu() {
    if (!tray) return;
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Dynamic Island v1.1', enabled: false },
        { type: 'separator' },
        { label: '⏯ Çal / Duraklat', click: () => sendMediaCommand('toggle') },
        { label: '⏭ Sonraki', click: () => sendMediaCommand('next') },
        { label: '⏮ Önceki', click: () => sendMediaCommand('prev') },
        { type: 'separator' },
        {
            label: '🎮 Oyun Modu',
            type: 'checkbox',
            checked: gameModeActive,
            click: (item) => {
                setGameMode(item.checked);
            },
        },
        { type: 'separator' },
        { label: '📋 Panoyu Göster', click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('open:panel', 'notes');
            }
        }},
        { label: '⏱ Zamanlayıcı', click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('open:panel', 'timer');
            }
        }},
        { type: 'separator' },
        { label: 'Çıkış', click: () => app.quit() },
    ]));
}

// ── Media Bridge ──
function startMediaBridge() {
    const scriptPath = app.isPackaged
        ? path.join(process.resourcesPath, 'scripts', 'get-media.ps1')
        : path.join(__dirname, 'scripts', 'get-media.ps1');
    mediaBridge = spawn('powershell.exe', [
        '-ExecutionPolicy', 'Bypass',
        '-NoProfile',
        '-File', scriptPath,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let buffer = '';
    mediaBridge.stdout.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const raw of lines) {
            const line = raw.trim();
            if (line === 'READY') {
                mediaBridgeReady = true;
                mediaBridgeCrashCount = 0;
                startMediaPolling();
            } else if (line.startsWith('DATA:')) {
                const cb = mediaBridgeCallbacks.shift();
                if (cb) {
                    try { cb.resolve(JSON.parse(line.substring(5))); }
                    catch { cb.resolve(null); }
                }
            } else if (line === 'OK' || line === 'BYE') {
                const cb = mediaBridgeCallbacks.shift();
                if (cb) cb.resolve(line);
            } else if (line.startsWith('ERR:')) {
                const cb = mediaBridgeCallbacks.shift();
                if (cb) cb.resolve(null);
            }
        }
    });

    mediaBridge.stderr.on('data', (d) => {
        // Silently ignore PowerShell stderr unless in dev
        if (process.argv.includes('--dev')) console.error('PS:', d.toString());
    });

    mediaBridge.on('close', () => {
        mediaBridgeReady = false;
        // Exponential backoff on crash
        mediaBridgeCrashCount++;
        const delay = Math.min(1000 * Math.pow(2, mediaBridgeCrashCount - 1), 10000);
        setTimeout(startMediaBridge, delay);
    });
}

function sendMediaCommand(cmd) {
    if (!mediaBridgeReady || !mediaBridge) {
        return Promise.resolve(null);
    }
    return new Promise((resolve) => {
        mediaBridgeCallbacks.push({ resolve });
        mediaBridge.stdin.write(cmd + '\n');
    });
}

function startMediaPolling() {
    if (mediaPollingInterval) clearInterval(mediaPollingInterval);
    mediaPollingInterval = setInterval(async () => {
        if (!mediaBridgeReady) return;
        const info = await sendMediaCommand('info');
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('media:update', info);
        }
    }, 2000);
}

// ── HTTP Helper ──
function httpGet(url) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        mod.get(url, { headers: { 'User-Agent': 'DynamicIsland/1.0' } }, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(data); }
            });
        }).on('error', reject);
    });
}

// ── Volume ──
async function getVolume() {
    const vol = getLoudness();
    if (vol) {
        try { return await vol.getVolume(); } catch {}
    }
    // Fallback: PowerShell
    return new Promise((resolve) => {
        exec('powershell -NoProfile -Command "[Math]::Round([Audio.Volume]::Volume * 100)"', (err, out) => {
            resolve(err ? 50 : parseInt(out) || 50);
        });
    });
}

async function setVolume(val) {
    val = Math.max(0, Math.min(100, Math.round(val)));
    const vol = getLoudness();
    if (vol) {
        try { await vol.setVolume(val); return; } catch {}
    }
    exec(`powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"`, () => {});
}

// ── Brightness ──
async function getBrightness() {
    return new Promise((resolve) => {
        exec(
            'powershell -NoProfile -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness"',
            (err, out) => resolve(err ? -1 : parseInt(out) || -1)
        );
    });
}

async function setBrightness(val) {
    val = Math.max(0, Math.min(100, Math.round(val)));
    return new Promise((resolve) => {
        exec(
            `powershell -NoProfile -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${val})"`,
            () => resolve()
        );
    });
}

// ── System Info ──
async function getSystemInfo() {
    const sysinfo = getSI();
    if (!sysinfo) return { cpu: 0, mem: 0, gpu: 0 };
    try {
        const [cpuLoad, mem] = await Promise.all([
            sysinfo.currentLoad(),
            sysinfo.mem(),
        ]);
        return {
            cpu: Math.round(cpuLoad.currentLoad || 0),
            mem: Math.round(((mem.used || 0) / (mem.total || 1)) * 100),
            memUsed: ((mem.used || 0) / 1073741824).toFixed(1),
            memTotal: ((mem.total || 0) / 1073741824).toFixed(1),
        };
    } catch {
        return { cpu: 0, mem: 0, gpu: 0 };
    }
}

// ── Weather ──
async function getWeatherLocation() {
    try {
        const data = await httpGet('http://ip-api.com/json/?fields=lat,lon,city,country');
        return data;
    } catch { return null; }
}

async function getWeather(lat, lon) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
        return await httpGet(url);
    } catch { return null; }
}

// ── Lyrics (with LRU cache, max 15 entries) ──
const lyricsCache = {};
const lyricsCacheKeys = [];
const LYRICS_CACHE_MAX = 15;

async function getLyrics(title, artist, duration) {
    if (!title) return null;
    const cacheKey = `${title}|${artist}`;
    if (lyricsCache[cacheKey]) return lyricsCache[cacheKey];
    try {
        const params = new URLSearchParams({ track_name: title, artist_name: artist || '' });
        if (duration) params.append('duration', Math.round(duration));
        const url = `https://lrclib.net/api/get?${params.toString()}`;
        const data = await httpGet(url);
        if (data && (data.syncedLyrics || data.plainLyrics)) {
            // LRU eviction
            if (lyricsCacheKeys.length >= LYRICS_CACHE_MAX) {
                const oldest = lyricsCacheKeys.shift();
                delete lyricsCache[oldest];
            }
            lyricsCache[cacheKey] = data;
            lyricsCacheKeys.push(cacheKey);
        }
        return data;
    } catch { return null; }
}

// ── Game Mode ──
function setGameMode(enabled) {
    gameModeActive = enabled;
    if (enabled) {
        exec('powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', () => {});
        exec('powershell -NoProfile -Command "Set-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings\' -Name \'NOC_GLOBAL_SETTING_TOASTS_ENABLED\' -Value 0 -Type DWord -Force"', () => {});
        // Stop ALL polling in game mode for maximum performance
        if (mediaPollingInterval) { clearInterval(mediaPollingInterval); mediaPollingInterval = null; }
        // Pause clipboard monitoring in game mode
        if (clipboardInterval) { clearInterval(clipboardInterval); clipboardInterval = null; }
    } else {
        exec('powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e', () => {});
        exec('powershell -NoProfile -Command "Set-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings\' -Name \'NOC_GLOBAL_SETTING_TOASTS_ENABLED\' -Value 1 -Type DWord -Force"', () => {});
        // Restore normal polling
        if (mediaPollingInterval) clearInterval(mediaPollingInterval);
        startMediaPolling();
        // Restart clipboard monitor
        if (!clipboardInterval) startClipboardMonitor();
    }
    // Notify renderer to hide/show island
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('gamemode:updated', enabled);
    }
    updateTrayMenu();
    return gameModeActive;
}

// ── Auto Start (registry-based for dev, loginItem for packaged) ──
function applyAutoStart(enabled) {
    // Always use registry — setLoginItemSettings doesn't work for portable builds
    if (enabled) {
        let regValue;
        if (app.isPackaged) {
            regValue = `"${process.execPath}"`;
        } else {
            // Dev mode: electron.exe + project dir as separate quoted args
            regValue = `"\\\"${process.execPath}\\\" \\\"${__dirname}\\\""`;
        }
        exec(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v DynamicIsland /t REG_SZ /d ${regValue} /f`, (err) => {
            if (err && process.argv.includes('--dev')) console.error('AutoStart reg error:', err);
        });
    } else {
        exec('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v DynamicIsland /f', () => {});
    }
}

// ── Clipboard Monitor ──
function startClipboardMonitor() {
    lastClipboardText = clipboard.readText() || '';
    if (clipboardInterval) clearInterval(clipboardInterval);
    clipboardInterval = setInterval(() => {
        if (gameModeActive) return; // Skip in game mode
        const text = clipboard.readText() || '';
        if (text && text !== lastClipboardText) {
            lastClipboardText = text;
            // Add to history (max 20)
            clipboardHistory.unshift({ text: text.substring(0, 500), time: Date.now() });
            if (clipboardHistory.length > 20) clipboardHistory.pop();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('clipboard:new', { text: text.substring(0, 500), time: Date.now() });
            }
        }
    }, 1000);
}

// ── Screenshot ──
async function takeScreenshot() {
    try {
        // Hide window briefly for clean screenshot
        mainWindow.hide();
        await new Promise(r => setTimeout(r, 300));

        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: screen.getPrimaryDisplay().size,
        });

        mainWindow.show();

        if (sources.length > 0) {
            const screenshot = sources[0].thumbnail;
            const pngBuffer = screenshot.toPNG();
            
            // Save to desktop
            const desktopPath = app.getPath('desktop');
            const filename = `screenshot_${Date.now()}.png`;
            const filePath = path.join(desktopPath, filename);
            fs.writeFileSync(filePath, pngBuffer);
            
            // Copy to clipboard
            clipboard.writeImage(screenshot);
            
            return { success: true, path: filePath, filename };
        }
        return { success: false, error: 'No source' };
    } catch (e) {
        mainWindow.show();
        return { success: false, error: e.message };
    }
}

// ── Global Shortcuts ──
function registerShortcuts() {
    const settings = store.get('settings') || DEFAULT_SETTINGS;
    const sc = settings.shortcuts || DEFAULT_SETTINGS.shortcuts;

    // Unregister all first
    globalShortcut.unregisterAll();

    const tryRegister = (accel, action) => {
        try {
            if (accel) globalShortcut.register(accel, action);
        } catch (e) {}
    };

    tryRegister(sc.toggleIsland, () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('shortcut:toggleIsland');
        }
    });
    tryRegister(sc.mediaToggle, () => sendMediaCommand('toggle'));
    tryRegister(sc.mediaNext, () => sendMediaCommand('next'));
    tryRegister(sc.mediaPrev, () => sendMediaCommand('prev'));
    tryRegister(sc.gameMode, () => {
        setGameMode(!gameModeActive);
        // setGameMode already sends gamemode:updated to renderer
    });
    tryRegister(sc.timerToggle, () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('shortcut:timerToggle');
        }
    });
}

// ── App Launcher ──
async function launchApp(appPath) {
    try {
        const error = await shell.openPath(appPath);
        if (error) {
            return { success: false, error };
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function pickApp() {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Uygulama Seç',
        properties: ['openFile'],
        filters: [
            { name: 'Uygulamalar', extensions: ['exe', 'lnk', 'bat', 'cmd'] },
            { name: 'Tümü', extensions: ['*'] },
        ],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const name = path.basename(filePath, path.extname(filePath));
    return { path: filePath, name };
}

// Service/system keywords to filter out from installed apps
const SYSTEM_APP_FILTER = new Set([
    'uninstall', 'kaldır', 'remove', 'repair', 'update', 'updater',
    'readme', 'release notes', 'changelog', 'documentation', 'help',
    'license', 'about', 'eula', 'terms', 'privacy',
    'debug', 'diagnostic', 'config', 'configuration',
    'migration', 'setup', 'installer', 'prerequisite',
    'runtime', 'redistributable', 'vcredist', 'dotnet',
    'telemetry', 'feedback', 'report', 'crash',
    'command prompt', 'powershell ise',
]);

function isSystemApp(name) {
    const lower = name.toLowerCase();
    for (const kw of SYSTEM_APP_FILTER) {
        if (lower.includes(kw)) return true;
    }
    return false;
}

// Extract icon from .lnk target as base64
async function extractAppIcon(lnkPath) {
    try {
        // Try getting icon directly from the file first (works best for .lnk)
        const icon = await app.getFileIcon(lnkPath, { size: 'large' });
        if (icon) {
            const png = icon.toPNG();
            if (png && png.length > 0) {
                return 'data:image/png;base64,' + png.toString('base64');
            }
        }
    } catch {}
    // Fallback: resolve .lnk target and try its icon
    if (lnkPath.endsWith('.lnk')) {
        try {
            const shortcut = shell.readShortcutLink(lnkPath);
            if (shortcut && shortcut.target) {
                const icon = await app.getFileIcon(shortcut.target, { size: 'large' });
                if (icon) {
                    const png = icon.toPNG();
                    if (png && png.length > 0) {
                        return 'data:image/png;base64,' + png.toString('base64');
                    }
                }
            }
        } catch {}
    }
    return '';
}

// ── Installed Apps Scanner (Start Menu .lnk files) ──
async function getInstalledApps() {
    // Return cached if available
    if (cachedInstalledApps) return cachedInstalledApps;
    if (installedAppsLoading) {
        // Wait for ongoing load
        return new Promise((resolve) => {
            const check = setInterval(() => {
                if (cachedInstalledApps) { clearInterval(check); resolve(cachedInstalledApps); }
            }, 200);
        });
    }
    installedAppsLoading = true;

    const results = [];
    const dirs = [
        path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
        path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    ];
    // Also scan user desktop and public desktop
    const desktop = path.join(process.env.USERPROFILE || '', 'Desktop');
    const publicDesktop = path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop');
    dirs.push(desktop, publicDesktop);

    const seen = new Set();
    for (const dir of dirs) {
        try {
            scanLnkDirSync(dir, results, seen, 0);
        } catch {}
    }
    results.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

    // Extract icons for ALL apps in parallel batches of 20
    for (let i = 0; i < results.length; i += 20) {
        const batch = results.slice(i, i + 20);
        await Promise.all(batch.map(async (a) => {
            a.icon = await extractAppIcon(a.path);
        }));
    }

    cachedInstalledApps = results;
    installedAppsLoading = false;
    return results;
}

function scanLnkDirSync(dir, results, seen, depth) {
    if (depth > 4) return;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scanLnkDirSync(fullPath, results, seen, depth + 1);
            } else if (entry.name.endsWith('.lnk') || entry.name.endsWith('.exe') || entry.name.endsWith('.url')) {
                const ext = path.extname(entry.name);
                const name = path.basename(entry.name, ext);
                const lower = name.toLowerCase();
                if (isSystemApp(name) || seen.has(lower)) continue;
                seen.add(lower);
                results.push({ name, path: fullPath });
            }
        }
    } catch {}
}

// ── Multi-Monitor ──
function getDisplays() {
    return screen.getAllDisplays().map((d, i) => ({
        id: d.id,
        label: `Monitör ${i + 1} (${d.size.width}x${d.size.height})`,
        bounds: d.workArea,
        primary: d.id === screen.getPrimaryDisplay().id,
    }));
}

function moveToDisplay(displayId) {
    const display = screen.getAllDisplays().find(d => d.id === displayId);
    if (!display || !mainWindow) return;
    const settings = store.get('settings') || DEFAULT_SETTINGS;
    const winW = 520;
    let x;
    if (settings.position === 'left') x = display.workArea.x + 20;
    else if (settings.position === 'right') x = display.workArea.x + display.workArea.width - winW - 20;
    else x = display.workArea.x + Math.round((display.workArea.width - winW) / 2);
    mainWindow.setPosition(x, display.workArea.y);
    store.set('windowPosition', { x, y: display.workArea.y });
}

// ── IPC Handlers ──
function registerIPC() {
    ipcMain.handle('media:info', () => sendMediaCommand('info'));
    ipcMain.handle('media:play', () => sendMediaCommand('play'));
    ipcMain.handle('media:pause', () => sendMediaCommand('pause'));
    ipcMain.handle('media:toggle', () => sendMediaCommand('toggle'));
    ipcMain.handle('media:next', () => sendMediaCommand('next'));
    ipcMain.handle('media:prev', () => sendMediaCommand('prev'));

    ipcMain.handle('system:getVolume', () => getVolume());
    ipcMain.handle('system:setVolume', (_, val) => setVolume(val));
    ipcMain.handle('system:getBrightness', () => getBrightness());
    ipcMain.handle('system:setBrightness', (_, val) => setBrightness(val));

    ipcMain.handle('system:info', () => getSystemInfo());

    ipcMain.handle('weather:get', (_, lat, lon) => getWeather(lat, lon));
    ipcMain.handle('weather:location', () => getWeatherLocation());

    ipcMain.handle('lyrics:get', (_, title, artist, dur) => getLyrics(title, artist, dur));

    ipcMain.handle('gamemode:get', () => gameModeActive);
    ipcMain.handle('gamemode:set', (_, enabled) => {
        return setGameMode(enabled);
    });

    ipcMain.handle('settings:get', () => store.get('settings'));
    ipcMain.handle('settings:set', (_, key, value) => {
        const settings = store.get('settings') || { ...DEFAULT_SETTINGS };
        settings[key] = value;
        store.set('settings', settings);
        // Handle side effects
        if (key === 'autoStart') {
            applyAutoStart(!!value);
        }
        if (key === 'position') {
            const primary = screen.getPrimaryDisplay();
            const winW = 520;
            let x;
            if (value === 'left') x = primary.workArea.x + 20;
            else if (value === 'right') x = primary.workArea.x + primary.workArea.width - winW - 20;
            else x = primary.workArea.x + Math.round((primary.workArea.width - winW) / 2);
            mainWindow.setPosition(x, mainWindow.getPosition()[1]);
            store.set('windowPosition', { x, y: mainWindow.getPosition()[1] });
        }
        if (key === 'shortcuts') {
            registerShortcuts();
        }
        return settings;
    });
    ipcMain.handle('settings:reset', () => {
        store.set('settings', { ...DEFAULT_SETTINGS });
        registerShortcuts();
        return DEFAULT_SETTINGS;
    });

    // Clipboard / Notes
    ipcMain.handle('clipboard:getHistory', () => clipboardHistory);
    ipcMain.handle('clipboard:copy', (_, text) => { clipboard.writeText(text); return true; });
    ipcMain.handle('notes:get', () => {
        const settings = store.get('settings') || {};
        return settings.notes || [];
    });
    ipcMain.handle('notes:save', (_, notes) => {
        const settings = store.get('settings') || { ...DEFAULT_SETTINGS };
        settings.notes = (notes || []).slice(0, 50); // max 50 notes
        store.set('settings', settings);
        return settings.notes;
    });

    // Screenshot
    ipcMain.handle('screenshot:take', () => takeScreenshot());

    // App Launcher
    ipcMain.handle('launcher:pick', () => pickApp());
    ipcMain.handle('launcher:launch', (_, appPath) => launchApp(appPath));
    ipcMain.handle('launcher:getInstalled', () => getInstalledApps());
    ipcMain.handle('launcher:refreshInstalled', () => {
        cachedInstalledApps = null;
        return getInstalledApps();
    });
    ipcMain.handle('launcher:getApps', () => {
        const settings = store.get('settings') || {};
        return settings.launcherApps || [];
    });
    ipcMain.handle('launcher:saveApps', (_, apps) => {
        const settings = store.get('settings') || { ...DEFAULT_SETTINGS };
        settings.launcherApps = (apps || []).slice(0, 8);
        store.set('settings', settings);
        return settings.launcherApps;
    });

    // Multi-monitor
    ipcMain.handle('displays:get', () => getDisplays());
    ipcMain.handle('displays:moveTo', (_, displayId) => { moveToDisplay(displayId); return true; });

    // Window drag
    ipcMain.handle('window:startDrag', () => {
        if (mainWindow) mainWindow.setMovable(true);
    });
    ipcMain.handle('window:getPosition', () => {
        if (mainWindow) return mainWindow.getPosition();
        return [0, 0];
    });
    ipcMain.handle('window:setPosition', (_, x, y) => {
        if (mainWindow) mainWindow.setPosition(Math.round(x), Math.round(y));
    });

    // Click-through control
    ipcMain.on('mouse:setIgnore', (_, ignore) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (ignore) {
                mainWindow.setIgnoreMouseEvents(true, { forward: true });
            } else {
                mainWindow.setIgnoreMouseEvents(false);
            }
        }
    });

    // Game mode window positioning
    let savedWindowBounds = null;
    ipcMain.handle('window:gameMode', (_, enabled) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (enabled) {
            // Only save bounds if not already in game mode layout
            if (!savedWindowBounds) {
                const [wx, wy] = mainWindow.getPosition();
                const [ww, wh] = mainWindow.getSize();
                savedWindowBounds = { x: wx, y: wy, w: ww, h: wh };
            }
            // Move window to left edge, full screen height
            const primary = screen.getPrimaryDisplay();
            const workArea = primary.workArea;
            mainWindow.setBounds({
                x: workArea.x,
                y: workArea.y,
                width: 96,
                height: workArea.height
            });
        } else if (savedWindowBounds) {
            // Restore original window position/size
            mainWindow.setBounds({
                x: savedWindowBounds.x,
                y: savedWindowBounds.y,
                width: savedWindowBounds.w,
                height: savedWindowBounds.h
            });
            savedWindowBounds = null;
        }
    });

    // Theme presets
    ipcMain.handle('theme:getPresets', () => THEME_PRESETS);

    ipcMain.handle('app:quit', () => app.quit());
}

// ── Theme Presets ──
const THEME_PRESETS = [
    { id: 'dark', name: 'Karanlık', bg: 'rgba(15, 15, 15, 0.92)', text: '#ffffff', textDim: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.08)' },
    { id: 'nord', name: 'Nord', bg: 'rgba(46, 52, 64, 0.94)', text: '#ECEFF4', textDim: 'rgba(216,222,233,0.6)', border: 'rgba(216,222,233,0.1)', accent: '#88C0D0' },
    { id: 'catppuccin', name: 'Catppuccin', bg: 'rgba(30, 30, 46, 0.94)', text: '#CDD6F4', textDim: 'rgba(205,214,244,0.6)', border: 'rgba(205,214,244,0.1)', accent: '#CBA6F7' },
    { id: 'rose', name: 'Rosé Pine', bg: 'rgba(25, 23, 36, 0.94)', text: '#E0DEF4', textDim: 'rgba(224,222,244,0.5)', border: 'rgba(224,222,244,0.08)', accent: '#EB6F92' },
    { id: 'solarized', name: 'Solarized', bg: 'rgba(0, 43, 54, 0.94)', text: '#93A1A1', textDim: 'rgba(147,161,161,0.6)', border: 'rgba(147,161,161,0.1)', accent: '#268BD2' },
    { id: 'light', name: 'Açık', bg: 'rgba(245, 245, 247, 0.95)', text: '#1C1C1E', textDim: 'rgba(28,28,30,0.5)', border: 'rgba(28,28,30,0.1)', accent: '#007AFF' },
];

// ── App Lifecycle ──
app.whenReady().then(() => {
    initStore();
    createWindow();
    createTray();
    registerIPC();
    startMediaBridge();
    registerShortcuts();
    startClipboardMonitor();
    // Pre-cache installed apps in background for instant launcher panel
    getInstalledApps().catch(() => {});
});

app.on('window-all-closed', () => {
    globalShortcut.unregisterAll();
    if (clipboardInterval) clearInterval(clipboardInterval);
    if (mediaBridge) {
        try { mediaBridge.stdin.write('exit\n'); } catch {}
        mediaBridge.kill();
    }
    if (mediaPollingInterval) clearInterval(mediaPollingInterval);
    app.quit();
});

app.on('before-quit', () => {
    globalShortcut.unregisterAll();
    if (clipboardInterval) clearInterval(clipboardInterval);
    if (mediaBridge) {
        try { mediaBridge.stdin.write('exit\n'); } catch {}
        mediaBridge.kill();
    }
});
