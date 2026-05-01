// Game mode: power plan + notification suppression + polling control.
const { exec } = require('child_process');

function setGameMode(ctx, enabled) {
    ctx.gameModeActive = enabled;
    if (enabled) {
        exec('powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', () => {});
        exec('powershell -NoProfile -Command "Set-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings\' -Name \'NOC_GLOBAL_SETTING_TOASTS_ENABLED\' -Value 0 -Type DWord -Force"', () => {});
        if (ctx.mediaPollingInterval) { clearInterval(ctx.mediaPollingInterval); ctx.mediaPollingInterval = null; }
        if (ctx.clipboardInterval) { clearInterval(ctx.clipboardInterval); ctx.clipboardInterval = null; }
        // Notification bridge keeps running in background but _pushNotification will suppress delivery
    } else {
        exec('powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e', () => {});
        exec('powershell -NoProfile -Command "Set-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings\' -Name \'NOC_GLOBAL_SETTING_TOASTS_ENABLED\' -Value 1 -Type DWord -Force"', () => {});
        const { startMediaPolling } = require('./media');
        if (ctx.mediaPollingInterval) clearInterval(ctx.mediaPollingInterval);
        startMediaPolling(ctx);
        const { startClipboardMonitor } = require('./clipboard');
        if (!ctx.clipboardInterval) startClipboardMonitor(ctx);
    }
    if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send('gamemode:updated', enabled);
    }
    // Lazy require to avoid circular dependency
    require('./tray').updateTrayMenu(ctx);
    return ctx.gameModeActive;
}

module.exports = { setGameMode };
