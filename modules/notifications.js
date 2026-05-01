// Windows notification bridge — polls UserNotificationListener via PowerShell.
// Same spawn/backoff/protocol pattern as media.js.
const { spawn } = require('child_process');
const { app } = require('electron');
const path = require('path');

const NOTIF_HISTORY_MAX = 50;

function startNotificationBridge(ctx) {
    if (ctx.notifBridgeDisabled) return;

    const scriptPath = app.isPackaged
        ? path.join(process.resourcesPath, 'scripts', 'get-notifications.ps1')
        : path.join(__dirname, '..', 'scripts', 'get-notifications.ps1');

    ctx.notifBridge = spawn('powershell.exe', [
        '-ExecutionPolicy', 'Bypass',
        '-NoProfile',
        '-File', scriptPath,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let buffer = '';
    ctx.notifBridge.stdout.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const raw of lines) {
            const line = raw.trim();
            if (line === 'READY') {
                ctx.notifBridgeCrashCount = 0;
                if (process.argv.includes('--dev')) console.log('[Notifications] Bridge ready');
            } else if (line.startsWith('DATA:')) {
                try {
                    const notif = JSON.parse(line.substring(5));
                    _pushNotification(ctx, notif);
                } catch {}
            } else if (line.startsWith('ERR:')) {
                if (process.argv.includes('--dev')) console.error('[Notifications] Bridge error:', line.substring(4));
            }
        }
    });

    ctx.notifBridge.stderr.on('data', (d) => {
        if (process.argv.includes('--dev')) console.error('[Notifications PS]', d.toString().trim());
    });

    ctx.notifBridge.on('close', () => {
        ctx.notifBridge = null;
        if (ctx.notifBridgeDisabled) return;
        ctx.notifBridgeCrashCount = (ctx.notifBridgeCrashCount || 0) + 1;
        const delay = Math.min(1000 * Math.pow(2, ctx.notifBridgeCrashCount - 1), 30000);
        setTimeout(() => startNotificationBridge(ctx), delay);
    });
}

function stopNotificationBridge(ctx) {
    ctx.notifBridgeDisabled = true;
    if (ctx.notifBridge) {
        try { ctx.notifBridge.kill(); } catch {}
        ctx.notifBridge = null;
    }
}

// Called by notificationSocket.js when a phone notification arrives
function pushPhoneNotification(ctx, notif) {
    _pushNotification(ctx, { ...notif, source: 'phone' });
}

function _pushNotification(ctx, notif) {
    if (ctx.gameModeActive) return; // suppressed in game mode

    const settings = ctx.store ? ctx.store.get('settings') || {} : {};
    const blockedApps = (settings.notifBlockedApps || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);

    if (blockedApps.length && notif.app && blockedApps.includes(notif.app.toLowerCase())) return;

    const entry = {
        id:        notif.id || String(Date.now()),
        source:    notif.source || 'pc',
        app:       notif.app || '',
        title:     notif.title || '',
        body:      notif.body || '',
        icon:      notif.icon || null,
        timestamp: notif.timestamp || Date.now(),
        read:      false,
    };

    // Prepend to history, cap at max
    ctx.notificationHistory = [entry, ...(ctx.notificationHistory || [])].slice(0, NOTIF_HISTORY_MAX);

    if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send('notification:new', entry);
    }
}

module.exports = { startNotificationBridge, stopNotificationBridge, pushPhoneNotification };
