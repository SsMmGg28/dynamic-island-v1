// Screen capture: hides window, captures primary display, saves to Desktop, copies to clipboard.
const { clipboard, screen, desktopCapturer, app } = require('electron');
const path = require('path');
const fs = require('fs');

async function takeScreenshot(ctx) {
    try {
        ctx.mainWindow.hide();
        await new Promise(r => setTimeout(r, 300));

        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: screen.getPrimaryDisplay().size,
        });

        ctx.mainWindow.show();

        if (sources.length > 0) {
            const screenshot = sources[0].thumbnail;
            const pngBuffer = screenshot.toPNG();
            const desktopPath = app.getPath('desktop');
            const filename = `screenshot_${Date.now()}.png`;
            const filePath = path.join(desktopPath, filename);
            fs.writeFileSync(filePath, pngBuffer);
            clipboard.writeImage(screenshot);
            return { success: true, path: filePath, filename };
        }
        return { success: false, error: 'No source' };
    } catch (e) {
        if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) ctx.mainWindow.show();
        return { success: false, error: e.message };
    }
}

module.exports = { takeScreenshot };
