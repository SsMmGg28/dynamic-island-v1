// System tray icon and context menu.
const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

function createTray(ctx) {
    const iconPath = path.join(__dirname, '..', 'icon.ico');
    let trayIcon;
    try {
        trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    } catch {
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
    ctx.tray = new Tray(trayIcon);
    ctx.tray.setToolTip('Dynamic Island');
    updateTrayMenu(ctx);
}

function updateTrayMenu(ctx) {
    if (!ctx.tray) return;
    const { sendMediaCommand } = require('./media');
    const { setGameMode } = require('./gamemode');
    ctx.tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Dynamic Island v1.1', enabled: false },
        { type: 'separator' },
        { label: '⏯ Çal / Duraklat', click: () => sendMediaCommand(ctx, 'toggle') },
        { label: '⏭ Sonraki',        click: () => sendMediaCommand(ctx, 'next') },
        { label: '⏮ Önceki',         click: () => sendMediaCommand(ctx, 'prev') },
        { type: 'separator' },
        {
            label: '🎮 Oyun Modu',
            type: 'checkbox',
            checked: ctx.gameModeActive,
            click: (item) => setGameMode(ctx, item.checked),
        },
        { type: 'separator' },
        { label: '📋 Panoyu Göster', click: () => {
            if (ctx.mainWindow && !ctx.mainWindow.isDestroyed())
                ctx.mainWindow.webContents.send('open:panel', 'notes');
        }},
        { label: '⏱ Zamanlayıcı', click: () => {
            if (ctx.mainWindow && !ctx.mainWindow.isDestroyed())
                ctx.mainWindow.webContents.send('open:panel', 'timer');
        }},
        { type: 'separator' },
        { label: 'Çıkış', click: () => require('electron').app.quit() },
    ]));
}

module.exports = { createTray, updateTrayMenu };
