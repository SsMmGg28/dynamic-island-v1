// Game mode — performance-first design.
//
// Core concept: when game mode is active and the HUD sidebar is NOT visible,
// mainWindow.setOpacity(0) removes the window from the Windows DWM composition
// pipeline entirely — zero GPU cost while you're gaming.
//
// Window layout in game mode:
//   • Window is repositioned to a narrow strip (HUD_WIDTH px wide, full workArea
//     height) at the RIGHT edge of the primary display.
//   • HUD hidden: opacity=0, mouse events ignored → invisible to DWM.
//   • HUD shown:  opacity=1, HUD slides in via CSS transform.
//   • All background polling stops while game mode is active.
const { exec } = require('child_process');

const POWER_HIGH_PERF = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c';
const POWER_BALANCED  = '381b4222-f694-41f0-9685-ff5bb260df2e';
const HUD_WIDTH       = 260;
// Delay before setting opacity=0 on hide — must exceed CSS transition duration
const HUD_HIDE_DELAY  = 200;

// Module-level: persist across game-mode toggle without polluting ctx
let _savedBounds = null;

function setGameMode(ctx, enabled) {
    if (ctx.gameModeActive === enabled) return ctx.gameModeActive;
    ctx.gameModeActive = enabled;

    if (enabled) {
        // Switch to high-performance power plan
        exec(`powercfg /setactive ${POWER_HIGH_PERF}`, () => {});
        // Suppress Windows toast notifications via registry
        exec(`powershell -NoProfile -Command "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings' -Name 'NOC_GLOBAL_SETTING_TOASTS_ENABLED' -Value 0 -Type DWord -Force"`, () => {});

        // Keep media polling alive (uses POLL_INTERVAL_IDLE = 8 s automatically
        // because ctx.gameModeActive is now true) so the HUD stays current.
        // Only clipboard monitoring needs to stop — it has no HUD display.
        if (ctx.clipboardInterval) { clearInterval(ctx.clipboardInterval); ctx.clipboardInterval = null; }

        // Reposition window to the right-edge HUD strip
        if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
            const [wx, wy] = ctx.mainWindow.getPosition();
            const [ww, wh] = ctx.mainWindow.getSize();
            _savedBounds = { x: wx, y: wy, w: ww, h: wh };

            const { screen } = require('electron');
            const { x: sx, y: sy, width: sw, height: sh } = screen.getPrimaryDisplay().workArea;
            ctx.mainWindow.setBounds({ x: sx + sw - HUD_WIDTH, y: sy, width: HUD_WIDTH, height: sh });

            // Start visible and interactive — renderer will show the HUD immediately
            ctx.gameModeHudVisible = true;
            ctx.mainWindow.setOpacity(1);
            ctx.mainWindow.setIgnoreMouseEvents(false);
            ctx.mainWindow.webContents.setBackgroundThrottling(false);
        }
    } else {
        // Restore balanced power plan
        exec(`powercfg /setactive ${POWER_BALANCED}`, () => {});
        // Re-enable Windows toast notifications
        exec(`powershell -NoProfile -Command "Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings' -Name 'NOC_GLOBAL_SETTING_TOASTS_ENABLED' -Value 1 -Type DWord -Force"`, () => {});

        // Restore window to its original position and size
        if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
            ctx.gameModeHudVisible = false;
            ctx.mainWindow.setOpacity(1);
            ctx.mainWindow.setIgnoreMouseEvents(false);
            ctx.mainWindow.webContents.setBackgroundThrottling(false);
            if (_savedBounds) {
                ctx.mainWindow.setBounds({ x: _savedBounds.x, y: _savedBounds.y, width: _savedBounds.w, height: _savedBounds.h });
                _savedBounds = null;
            }
        }

        // Restart all background services
        const { startMediaPolling } = require('./media');
        if (ctx.mediaPollingTimeout) clearTimeout(ctx.mediaPollingTimeout);
        startMediaPolling(ctx);

        const { startClipboardMonitor } = require('./clipboard');
        if (!ctx.clipboardInterval) startClipboardMonitor(ctx);
    }

    if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send('gamemode:updated', enabled);
    }

    require('./tray').updateTrayMenu(ctx);
    return ctx.gameModeActive;
}

// Called via IPC when the renderer shows the HUD sidebar
function showSidebar(ctx) {
    if (!ctx.mainWindow || ctx.mainWindow.isDestroyed() || !ctx.gameModeActive) return;
    ctx.gameModeHudVisible = true;
    ctx.mainWindow.setOpacity(1);
    ctx.mainWindow.setIgnoreMouseEvents(false);
    ctx.mainWindow.webContents.setBackgroundThrottling(false);
}

// Called via IPC when the renderer hides the HUD sidebar
function hideSidebar(ctx) {
    if (!ctx.mainWindow || ctx.mainWindow.isDestroyed() || !ctx.gameModeActive) return;
    ctx.gameModeHudVisible = false;
    // Ignore mouse immediately so clicks fall through to the game
    ctx.mainWindow.setIgnoreMouseEvents(true, { forward: true });
    // Wait for the CSS hide animation before pulling the window from DWM
    setTimeout(() => {
        if (!ctx.mainWindow || ctx.mainWindow.isDestroyed()) return;
        if (!ctx.gameModeActive) return; // user exited game mode during the delay
        ctx.mainWindow.setOpacity(0);
        ctx.mainWindow.webContents.setBackgroundThrottling(true);
    }, HUD_HIDE_DELAY);
}

module.exports = { setGameMode, showSidebar, hideSidebar };
