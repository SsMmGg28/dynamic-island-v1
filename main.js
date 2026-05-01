// ─── main.js — Dynamic Island Entry Point ──────────────────────────────────
// Orchestrates window/tray/IPC/bridge/shortcuts. Business logic lives in modules/.
const { app, BrowserWindow, globalShortcut, screen } = require('electron');
const path = require('path');

let Store;
try { Store = require('electron-store'); } catch { Store = null; }

// ── Shared context (mutable singleton imported by all modules) ──
const ctx = require('./modules/context');

// ── Module imports ──
const { startMediaBridge } = require('./modules/media');
const { startClipboardMonitor } = require('./modules/clipboard');
const { startNotificationBridge, stopNotificationBridge } = require('./modules/notifications');
const { startSocketServer, stopSocketServer } = require('./modules/notificationSocket');
const { createTray } = require('./modules/tray');
const { registerShortcuts } = require('./modules/shortcuts');
const { registerIPC } = require('./modules/ipc');
const { applyAutoStart } = require('./modules/autostart');
const { getInstalledApps } = require('./modules/launcher');

// ── Default Settings ──
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
        mediaToggle:  'CmdOrCtrl+Alt+M',
        mediaNext:    'CmdOrCtrl+Alt+Right',
        mediaPrev:    'CmdOrCtrl+Alt+Left',
        gameMode:     'CmdOrCtrl+Alt+G',
        timerToggle:  'CmdOrCtrl+Alt+T',
    },
    launcherApps: [],
    notes: [],
    idleTimeout: 15,
};

// ── Theme Presets ──
const THEME_PRESETS = [
    { id: 'dark',       name: 'Karanlik',    bg: 'rgba(15, 15, 15, 0.92)',   text: '#ffffff',  textDim: 'rgba(255,255,255,0.5)',  border: 'rgba(255,255,255,0.08)' },
    { id: 'nord',       name: 'Nord',        bg: 'rgba(46, 52, 64, 0.94)',   text: '#ECEFF4',  textDim: 'rgba(216,222,233,0.6)',  border: 'rgba(216,222,233,0.1)',  accent: '#88C0D0' },
    { id: 'catppuccin', name: 'Catppuccin',  bg: 'rgba(30, 30, 46, 0.94)',   text: '#CDD6F4',  textDim: 'rgba(205,214,244,0.6)',  border: 'rgba(205,214,244,0.1)',  accent: '#CBA6F7' },
    { id: 'rose',       name: 'Rose Pine',   bg: 'rgba(25, 23, 36, 0.94)',   text: '#E0DEF4',  textDim: 'rgba(224,222,244,0.5)',  border: 'rgba(224,222,244,0.08)', accent: '#EB6F92' },
    { id: 'solarized',  name: 'Solarized',   bg: 'rgba(0, 43, 54, 0.94)',    text: '#93A1A1',  textDim: 'rgba(147,161,161,0.6)',  border: 'rgba(147,161,161,0.1)', accent: '#268BD2' },
    { id: 'light',      name: 'Acik',        bg: 'rgba(245, 245, 247, 0.95)',text: '#1C1C1E',  textDim: 'rgba(28,28,30,0.5)',    border: 'rgba(28,28,30,0.1)',    accent: '#007AFF' },
];

// ── Store Initialization ──
function initStore() {
    if (Store) {
        ctx.store = new Store({ defaults: { settings: DEFAULT_SETTINGS } });
    } else {
        ctx.store = {
            _data: { settings: { ...DEFAULT_SETTINGS } },
            get(key) { return key ? this._data[key] : this._data; },
            set(key, val) { this._data[key] = val; },
        };
    }
}

// ── Window Creation ──
function createWindow() {
    const primary = screen.getPrimaryDisplay();
    const { width: sw } = primary.workAreaSize;
    const settings = ctx.store.get('settings') || DEFAULT_SETTINGS;
    const winW = 520, winH = 800;
    let x = Math.round((sw - winW) / 2);

    const savedPos = ctx.store.get('windowPosition');
    if (savedPos && typeof savedPos.x === 'number') {
        x = savedPos.x;
    } else if (settings.position === 'left') {
        x = 20;
    } else if (settings.position === 'right') {
        x = sw - winW - 20;
    }
    const y = savedPos && typeof savedPos.y === 'number' ? savedPos.y : 0;

    ctx.mainWindow = new BrowserWindow({
        width: winW, height: winH, x, y,
        frame: false, transparent: true, alwaysOnTop: true,
        skipTaskbar: true, resizable: false, hasShadow: false,
        focusable: true, show: false,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            backgroundThrottling: false,
        },
    });

    ctx.mainWindow.setAlwaysOnTop(true, 'floating');
    ctx.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    ctx.mainWindow.setIgnoreMouseEvents(true, { forward: true });

    ctx.mainWindow.once('ready-to-show', () => ctx.mainWindow.showInactive());
    ctx.mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

    let moveSaveTimer = null;
    ctx.mainWindow.on('moved', () => {
        if (moveSaveTimer) clearTimeout(moveSaveTimer);
        moveSaveTimer = setTimeout(() => {
            const [wx, wy] = ctx.mainWindow.getPosition();
            ctx.store.set('windowPosition', { x: wx, y: wy });
        }, 300);
    });

    if (process.argv.includes('--dev')) {
        ctx.mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    applyAutoStart(settings.autoStart);
}

// ── App Lifecycle ──
app.whenReady().then(() => {
    initStore();
    createWindow();
    createTray(ctx);
    registerIPC(ctx, DEFAULT_SETTINGS, THEME_PRESETS);
    startMediaBridge(ctx);
    registerShortcuts(ctx, DEFAULT_SETTINGS);
    startClipboardMonitor(ctx);
    const notifSettings = ctx.store.get('settings') || {};
    if (notifSettings.notifEnabled !== false) {
        startNotificationBridge(ctx);
        startSocketServer(ctx);
    }
    getInstalledApps(ctx).catch(() => {});
});

app.on('window-all-closed', () => {
    globalShortcut.unregisterAll();
    if (ctx.clipboardInterval) clearInterval(ctx.clipboardInterval);
    stopNotificationBridge(ctx);
    stopSocketServer(ctx);
    if (ctx.mediaBridge) {
        try { ctx.mediaBridge.stdin.write('exit\n'); } catch {}
        ctx.mediaBridge.kill();
    }
    if (ctx.mediaPollingInterval) clearInterval(ctx.mediaPollingInterval);
    app.quit();
});

app.on('before-quit', () => {
    globalShortcut.unregisterAll();
    if (ctx.clipboardInterval) clearInterval(ctx.clipboardInterval);
    stopNotificationBridge(ctx);
    stopSocketServer(ctx);
    if (ctx.mediaBridge) {
        try { ctx.mediaBridge.stdin.write('exit\n'); } catch {}
        ctx.mediaBridge.kill();
    }
});
