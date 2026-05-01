// Global shortcuts registration.
const { globalShortcut } = require('electron');

function registerShortcuts(ctx, DEFAULT_SETTINGS) {
    const settings = ctx.store.get('settings') || DEFAULT_SETTINGS;
    const sc = settings.shortcuts || DEFAULT_SETTINGS.shortcuts;

    globalShortcut.unregisterAll();

    const tryRegister = (accel, action) => {
        try { if (accel) globalShortcut.register(accel, action); } catch {}
    };

    const { sendMediaCommand } = require('./media');
    const { setGameMode } = require('./gamemode');

    tryRegister(sc.toggleIsland, () => {
        if (ctx.mainWindow && !ctx.mainWindow.isDestroyed())
            ctx.mainWindow.webContents.send('shortcut:toggleIsland');
    });
    tryRegister(sc.mediaToggle,  () => sendMediaCommand(ctx, 'toggle'));
    tryRegister(sc.mediaNext,    () => sendMediaCommand(ctx, 'next'));
    tryRegister(sc.mediaPrev,    () => sendMediaCommand(ctx, 'prev'));
    tryRegister(sc.gameMode,     () => setGameMode(ctx, !ctx.gameModeActive));
    tryRegister(sc.timerToggle,  () => {
        if (ctx.mainWindow && !ctx.mainWindow.isDestroyed())
            ctx.mainWindow.webContents.send('shortcut:timerToggle');
    });
}

module.exports = { registerShortcuts };
