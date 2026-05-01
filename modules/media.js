// Windows media bridge — PowerShell GSMTC process.
const { spawn } = require('child_process');
const { app } = require('electron');
const path = require('path');

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
                    try { cb.resolve(JSON.parse(line.substring(5))); }
                    catch { cb.resolve(null); }
                }
            } else if (line === 'OK' || line === 'BYE') {
                const cb = ctx.mediaBridgeCallbacks.shift();
                if (cb) cb.resolve(line);
            } else if (line.startsWith('ERR:')) {
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

function startMediaPolling(ctx) {
    if (ctx.mediaPollingInterval) clearInterval(ctx.mediaPollingInterval);
    ctx.mediaPollingInterval = setInterval(async () => {
        if (!ctx.mediaBridgeReady) return;
        const info = await sendMediaCommand(ctx, 'info');
        if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
            ctx.mainWindow.webContents.send('media:update', info);
        }
    }, 2000);
}

module.exports = { startMediaBridge, sendMediaCommand, startMediaPolling };
