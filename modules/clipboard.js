// Clipboard polling monitor — stores last 20 entries and pushes new items to renderer.
const { clipboard } = require('electron');

function startClipboardMonitor(ctx) {
    ctx.lastClipboardText = clipboard.readText() || '';
    if (ctx.clipboardInterval) clearInterval(ctx.clipboardInterval);
    ctx.clipboardInterval = setInterval(() => {
        if (ctx.gameModeActive) return;
        const text = clipboard.readText() || '';
        // Skip empty or whitespace-only content and unchanged content — no IPC needed
        if (!text.trim() || text === ctx.lastClipboardText) return;
        ctx.lastClipboardText = text;
        const entry = { text: text.substring(0, 500), time: Date.now() };
        ctx.clipboardHistory.unshift(entry);
        if (ctx.clipboardHistory.length > 20) ctx.clipboardHistory.pop();
        if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
            ctx.mainWindow.webContents.send('clipboard:new', entry);
        }
    }, 1500);
}

module.exports = { startClipboardMonitor };
