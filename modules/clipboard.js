// Clipboard polling monitor — stores last 20 entries and pushes new items to renderer.
const { clipboard } = require('electron');

function startClipboardMonitor(ctx) {
    ctx.lastClipboardText = clipboard.readText() || '';
    if (ctx.clipboardInterval) clearInterval(ctx.clipboardInterval);
    ctx.clipboardInterval = setInterval(() => {
        if (ctx.gameModeActive) return;
        const text = clipboard.readText() || '';
        if (text && text !== ctx.lastClipboardText) {
            ctx.lastClipboardText = text;
            ctx.clipboardHistory.unshift({ text: text.substring(0, 500), time: Date.now() });
            if (ctx.clipboardHistory.length > 20) ctx.clipboardHistory.pop();
            if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
                ctx.mainWindow.webContents.send('clipboard:new', { text: text.substring(0, 500), time: Date.now() });
            }
        }
    }, 1000);
}

module.exports = { startClipboardMonitor };
