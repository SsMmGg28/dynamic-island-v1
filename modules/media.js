// Windows media bridge — spawns get-media.ps1 (simple blocking-readline bridge).
const { spawn } = require('child_process');
const { app } = require('electron');
const path = require('path');

// Polling intervals
const POLL_INTERVAL_PLAYING = 2000;
const POLL_INTERVAL_IDLE    = 3000;

function startMediaBridge(ctx) {
    const scriptPath = app.isPackaged
        ? path.join(process.resourcesPath, 'scripts', 'get-media.ps1')
        : path.join(__dirname, '..', 'scripts', 'get-media.ps1');

    ctx.mediaBridge = spawn('powershell.exe', [
        '-ExecutionPolicy', 'Bypass',
        '-NoProfile',
        '-File', scriptPath,
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let buffer = '';
    ctx.mediaBridge.stdout.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const raw of lines) {
            const line = raw.trim();
            if (line === 'READY') {
                ctx.mediaBridgeReady = true;
                ctx.mediaBridgeCrashCount = 0;
                startMediaPolling(ctx);
            } else if (line.startsWith('DATA:')) {
                const cb = ctx.mediaBridgeCallbacks.shift();
                if (cb) {
                    try {
                        const data = JSON.parse(line.substring(5));
                        ctx.mediaLastStatus = data?.status ?? 'None';
                        cb.resolve(data);
                    } catch { cb.resolve(null); }
                }
            } else if (line === 'OK' || line === 'BYE') {
                const cb = ctx.mediaBridgeCallbacks.shift();
                if (cb) cb.resolve(line);
            } else if (line.startsWith('ERR:') || line.startsWith('FATAL:')) {
                const cb = ctx.mediaBridgeCallbacks.shift();
                if (cb) cb.resolve(null);
            }
        }
    });

    ctx.mediaBridge.stderr.on('data', (d) => {
        if (process.argv.includes('--dev')) console.error('PS:', d.toString());
    });

    ctx.mediaBridge.on('close', () => {
        ctx.mediaBridgeReady = false;
        // Drain pending callbacks so in-flight poll() calls don't hang forever.
        const pending = ctx.mediaBridgeCallbacks.splice(0);
        for (const cb of pending) cb.resolve(null);
        ctx.mediaBridgeCrashCount++;
        const delay = Math.min(1000 * Math.pow(2, ctx.mediaBridgeCrashCount - 1), 10000);
        setTimeout(() => startMediaBridge(ctx), delay);
    });
}

function sendMediaCommand(ctx, cmd) {
    if (!ctx.mediaBridgeReady || !ctx.mediaBridge) {
        return Promise.resolve(null);
    }
    return new Promise((resolve) => {
        ctx.mediaBridgeCallbacks.push({ resolve });
        ctx.mediaBridge.stdin.write(cmd + '\n');
    });
}

// Sends a control command and then pushes an immediate media:update after the
// OS has had time to process it (400 ms grace period), so the renderer UI
// refreshes without waiting for the next scheduled poll.
async function sendControlCommand(ctx, cmd) {
    const result = await sendMediaCommand(ctx, cmd);
    setTimeout(async () => {
        try {
            const info = await sendMediaCommand(ctx, 'info');
            if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
                ctx.mainWindow.webContents.send('media:update', info);
            }
        } catch {}
    }, 400);
    return result;
}

function startMediaPolling(ctx) {
    if (ctx.mediaPollingTimeout) clearTimeout(ctx.mediaPollingTimeout);

    async function poll() {
        // Always reschedule — even when the bridge is down — so polling
        // resumes automatically when the bridge reconnects and sets READY.
        if (!ctx.mediaBridgeReady) {
            ctx.mediaPollingTimeout = setTimeout(poll, POLL_INTERVAL_IDLE);
            return;
        }
        const info = await sendMediaCommand(ctx, 'info');
        if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
            ctx.mainWindow.webContents.send('media:update', info);
        }
        const isPlaying  = ctx.mediaLastStatus === 'Playing';
        const hudVisible = ctx.gameModeActive && ctx.gameModeHudVisible;
        const interval   = (hudVisible || (isPlaying && !ctx.gameModeActive))
            ? POLL_INTERVAL_PLAYING
            : POLL_INTERVAL_IDLE;
        ctx.mediaPollingTimeout = setTimeout(poll, interval);
    }

    poll();
}

module.exports = { startMediaBridge, sendMediaCommand, sendControlCommand, startMediaPolling };
