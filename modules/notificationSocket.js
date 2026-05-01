// WebSocket server — receives Android phone notifications over local network.
// Listens on configurable port (default 8765, LAN-only via 0.0.0.0).
const os = require('os');
const { pushPhoneNotification } = require('./notifications');

let wss = null;

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

function startSocketServer(ctx) {
    let WebSocketServer;
    try {
        WebSocketServer = require('ws').WebSocketServer;
    } catch {
        if (process.argv.includes('--dev')) console.warn('[NotifSocket] ws module not installed — phone notifications disabled.');
        return;
    }

    const settings = ctx.store ? ctx.store.get('settings') || {} : {};
    const port = settings.notifSocketPort || 8765;

    if (wss) {
        try { wss.close(); } catch {}
        wss = null;
    }

    wss = new WebSocketServer({ host: '0.0.0.0', port });

    wss.on('listening', () => {
        ctx.notifSocketPort = port;
        ctx.notifSocketIP   = getLocalIP();
        if (process.argv.includes('--dev')) console.log(`[NotifSocket] Listening on ${ctx.notifSocketIP}:${port}`);
    });

    wss.on('connection', (ws, req) => {
        const remoteIP = req.socket.remoteAddress || '';
        if (process.argv.includes('--dev')) console.log('[NotifSocket] Client connected:', remoteIP);
        ctx.notifSocketClients = (ctx.notifSocketClients || 0) + 1;
        _broadcastSocketStatus(ctx);

        ws.on('message', (raw) => {
            let data;
            try { data = JSON.parse(raw.toString()); } catch { return; }
            if (!data || typeof data !== 'object') return;

            // Sanitize incoming payload — only accept known fields
            const sanitized = {
                id:        String(data.id || Date.now()),
                source:    'phone',
                app:       String(data.app || '').slice(0, 100),
                title:     String(data.title || '').slice(0, 200),
                body:      String(data.body || '').slice(0, 500),
                icon:      typeof data.icon === 'string' && data.icon.startsWith('data:image/') ? data.icon : null,
                timestamp: typeof data.ts === 'number' ? data.ts : Date.now(),
            };

            pushPhoneNotification(ctx, sanitized);
        });

        ws.on('close', () => {
            ctx.notifSocketClients = Math.max(0, (ctx.notifSocketClients || 1) - 1);
            _broadcastSocketStatus(ctx);
        });

        ws.on('error', () => {});
    });

    wss.on('error', (err) => {
        if (process.argv.includes('--dev')) console.error('[NotifSocket] Error:', err.message);
    });
}

function stopSocketServer(ctx) {
    if (wss) {
        try { wss.close(); } catch {}
        wss = null;
    }
    ctx.notifSocketClients = 0;
    ctx.notifSocketPort = null;
}

function getSocketStatus(ctx) {
    return {
        running:  !!wss,
        port:     ctx.notifSocketPort || null,
        ip:       ctx.notifSocketIP || getLocalIP(),
        clients:  ctx.notifSocketClients || 0,
    };
}

function _broadcastSocketStatus(ctx) {
    if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send('notification:socketStatus', getSocketStatus(ctx));
    }
}

module.exports = { startSocketServer, stopSocketServer, getSocketStatus, getLocalIP };
