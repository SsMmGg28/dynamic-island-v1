// All ipcMain handler registrations.
const { ipcMain, screen, clipboard, shell } = require('electron');

const { sendMediaCommand } = require('./media');
const { getVolume, setVolume, getBrightness, setBrightness, getSystemInfo, getWeatherLocation, getWeather, getLyrics } = require('./system');
const { setGameMode } = require('./gamemode');
const { applyAutoStart } = require('./autostart');
const { takeScreenshot } = require('./screenshot');
const { launchApp, pickApp, getInstalledApps } = require('./launcher');
const { getDesktopIdToken, initFirebase, slApiRequest } = require('./studylogger');
const { startNotificationBridge, stopNotificationBridge } = require('./notifications');
const { startSocketServer, stopSocketServer, getSocketStatus } = require('./notificationSocket');
const { registerShortcuts } = require('./shortcuts');

function registerIPC(ctx, DEFAULT_SETTINGS, THEME_PRESETS) {
    // ── Media ──
    ipcMain.handle('media:info',   () => sendMediaCommand(ctx, 'info'));
    ipcMain.handle('media:play',   () => sendMediaCommand(ctx, 'play'));
    ipcMain.handle('media:pause',  () => sendMediaCommand(ctx, 'pause'));
    ipcMain.handle('media:toggle', () => sendMediaCommand(ctx, 'toggle'));
    ipcMain.handle('media:next',   () => sendMediaCommand(ctx, 'next'));
    ipcMain.handle('media:prev',   () => sendMediaCommand(ctx, 'prev'));

    // ── System ──
    ipcMain.handle('system:getVolume',    () => getVolume());
    ipcMain.handle('system:setVolume',    (_, val) => setVolume(val));
    ipcMain.handle('system:getBrightness',() => getBrightness());
    ipcMain.handle('system:setBrightness',(_, val) => setBrightness(val));
    ipcMain.handle('system:info',         () => getSystemInfo());

    // ── Weather & Lyrics ──
    ipcMain.handle('weather:get',      (_, lat, lon) => getWeather(lat, lon));
    ipcMain.handle('weather:location', () => getWeatherLocation());
    ipcMain.handle('lyrics:get',       (_, title, artist, dur) => getLyrics(title, artist, dur));

    // ── Game Mode ──
    ipcMain.handle('gamemode:get', () => ctx.gameModeActive);
    ipcMain.handle('gamemode:set', (_, enabled) => setGameMode(ctx, enabled));

    // ── Settings ──
    ipcMain.handle('settings:get', () => ctx.store.get('settings'));
    ipcMain.handle('settings:set', (_, key, value) => {
        const settings = ctx.store.get('settings') || { ...DEFAULT_SETTINGS };
        settings[key] = value;
        ctx.store.set('settings', settings);
        if (key === 'autoStart') applyAutoStart(!!value);
        if (key === 'position') {
            const primary = screen.getPrimaryDisplay();
            const winW = 520;
            let x;
            if (value === 'left')  x = primary.workArea.x + 20;
            else if (value === 'right') x = primary.workArea.x + primary.workArea.width - winW - 20;
            else x = primary.workArea.x + Math.round((primary.workArea.width - winW) / 2);
            ctx.mainWindow.setPosition(x, ctx.mainWindow.getPosition()[1]);
            ctx.store.set('windowPosition', { x, y: ctx.mainWindow.getPosition()[1] });
        }
        if (key === 'shortcuts') registerShortcuts(ctx, DEFAULT_SETTINGS);
        return settings;
    });
    ipcMain.handle('settings:reset', () => {
        ctx.store.set('settings', { ...DEFAULT_SETTINGS });
        registerShortcuts(ctx, DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
    });

    // ── Clipboard & Notes ──
    ipcMain.handle('clipboard:getHistory', () => ctx.clipboardHistory);
    ipcMain.handle('clipboard:copy', (_, text) => { clipboard.writeText(text); return true; });
    ipcMain.handle('notes:get', () => {
        const settings = ctx.store.get('settings') || {};
        return settings.notes || [];
    });
    ipcMain.handle('notes:save', (_, notes) => {
        const settings = ctx.store.get('settings') || { ...DEFAULT_SETTINGS };
        settings.notes = (notes || []).slice(0, 50);
        ctx.store.set('settings', settings);
        return settings.notes;
    });

    // ── Screenshot ──
    ipcMain.handle('screenshot:take', () => takeScreenshot(ctx));

    // ── App Launcher ──
    ipcMain.handle('launcher:pick',             () => pickApp(ctx));
    ipcMain.handle('launcher:launch',           (_, appPath) => launchApp(appPath));
    ipcMain.handle('launcher:getInstalled',     () => getInstalledApps(ctx));
    ipcMain.handle('launcher:refreshInstalled', () => { ctx.cachedInstalledApps = null; return getInstalledApps(ctx); });
    ipcMain.handle('launcher:getApps', () => {
        const settings = ctx.store.get('settings') || {};
        return settings.launcherApps || [];
    });
    ipcMain.handle('launcher:saveApps', (_, apps) => {
        const settings = ctx.store.get('settings') || { ...DEFAULT_SETTINGS };
        settings.launcherApps = (apps || []).slice(0, 8);
        ctx.store.set('settings', settings);
        return settings.launcherApps;
    });

    // ── Multi-Monitor ──
    ipcMain.handle('displays:get', () => {
        return screen.getAllDisplays().map((d, i) => ({
            id: d.id,
            label: `Monitör ${i + 1} (${d.size.width}x${d.size.height})`,
            bounds: d.workArea,
            primary: d.id === screen.getPrimaryDisplay().id,
        }));
    });
    ipcMain.handle('displays:moveTo', (_, displayId) => {
        const display = screen.getAllDisplays().find(d => d.id === displayId);
        if (!display || !ctx.mainWindow) return true;
        const settings = ctx.store.get('settings') || DEFAULT_SETTINGS;
        const winW = 520;
        let x;
        if (settings.position === 'left') x = display.workArea.x + 20;
        else if (settings.position === 'right') x = display.workArea.x + display.workArea.width - winW - 20;
        else x = display.workArea.x + Math.round((display.workArea.width - winW) / 2);
        ctx.mainWindow.setPosition(x, display.workArea.y);
        ctx.store.set('windowPosition', { x, y: display.workArea.y });
        return true;
    });

    // ── Window ──
    ipcMain.handle('window:getPosition', () => ctx.mainWindow ? ctx.mainWindow.getPosition() : [0, 0]);
    ipcMain.handle('window:setPosition', (_, x, y) => {
        if (ctx.mainWindow) ctx.mainWindow.setPosition(Math.round(x), Math.round(y));
    });
    ipcMain.on('mouse:setIgnore', (_, ignore) => {
        if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
            if (ignore) ctx.mainWindow.setIgnoreMouseEvents(true, { forward: true });
            else ctx.mainWindow.setIgnoreMouseEvents(false);
        }
    });

    let savedWindowBounds = null;
    ipcMain.handle('window:gameMode', (_, enabled) => {
        if (!ctx.mainWindow || ctx.mainWindow.isDestroyed()) return;
        if (enabled) {
            if (!savedWindowBounds) {
                const [wx, wy] = ctx.mainWindow.getPosition();
                const [ww, wh] = ctx.mainWindow.getSize();
                savedWindowBounds = { x: wx, y: wy, w: ww, h: wh };
            }
            const primary = screen.getPrimaryDisplay();
            const workArea = primary.workArea;
            ctx.mainWindow.setBounds({ x: workArea.x, y: workArea.y, width: 96, height: workArea.height });
        } else if (savedWindowBounds) {
            ctx.mainWindow.setBounds({ x: savedWindowBounds.x, y: savedWindowBounds.y, width: savedWindowBounds.w, height: savedWindowBounds.h });
            savedWindowBounds = null;
        }
    });

    // ── Theme & Misc ──
    ipcMain.handle('theme:getPresets', () => THEME_PRESETS);
    ipcMain.handle('app:quit',         () => require('electron').app.quit());
    ipcMain.handle('shell:openExternal', (_, url) => {
        const allowed = /^https:\/\/studyloggeryks\.vercel\.app/;
        if (allowed.test(url)) shell.openExternal(url);
    });

    // ── StudyLogger ──
    ipcMain.handle('studylogger:getConfig', () => ctx.store.get('studylogger') || {});

    ipcMain.handle('studylogger:signIn', async (_, customToken) => {
        try {
            const ok = await initFirebase(ctx);
            if (!ok) return { ok: false, error: 'Firebase başlatılamadı.' };
            const credential = await ctx._fbHelpers.signInWithCustomToken(ctx._fbAuth, customToken);
            const uid = credential.user.uid;
            const idToken = await credential.user.getIdToken();
            const refreshToken = credential.user.refreshToken;
            ctx.store.set('studylogger', { customToken, firebaseUid: uid, idToken, refreshToken });
            return { ok: true, uid };
        } catch (e) {
            const code = e.code || '';
            if (code.includes('expired') || code.includes('invalid-custom-token'))
                return { ok: false, error: 'expired' };
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('studylogger:logSession', async (_, payload) => {
        try {
            const ok = await initFirebase(ctx);
            if (!ok) return { ok: false, error: 'Firebase başlatılamadı.' };
            if (!ctx._fbAuth.currentUser) {
                const saved = ctx.store.get('studylogger') || {};
                if (!saved.customToken) return { ok: false, error: 'no_token' };
                await ctx._fbHelpers.signInWithCustomToken(ctx._fbAuth, saved.customToken);
            }
            const { collection, addDoc, Timestamp } = ctx._fbHelpers;
            const today = new Date().toISOString().split('T')[0];
            await addDoc(collection(ctx._fbDb, 'studyLogs'), {
                uid: payload.uid,
                subject: payload.subject,
                topic: payload.topic,
                durationMinutes: payload.durationMinutes,
                questionCount: payload.questionCount || 0,
                notes: payload.notes || 'Masaüstü uygulamasıyla eklendi.',
                date: today,
                source: 'desktop_app',
                createdAt: Timestamp.now(),
            });
            return { ok: true };
        } catch (e) {
            const code = e.code || '';
            if (code.includes('permission-denied') || code.includes('expired') || code.includes('unauthenticated'))
                return { ok: false, error: 'expired' };
            return { ok: false, error: e.message };
        }
    });

    ipcMain.handle('studylogger:clearToken', async () => {
        ctx.store.set('studylogger', {});
        if (ctx._fbAuth) { try { await ctx._fbHelpers.signOut(ctx._fbAuth); } catch {} }
        return true;
    });

    ipcMain.handle('studylogger:saveApiConfig', (_, cfg) => {
        const baseUrl = String(cfg.baseUrl || '').trim().replace(/\/+$/, '');
        if (!baseUrl) { ctx.store.set('studyloggerApi', {}); return { ok: true }; }
        ctx.store.set('studyloggerApi', { baseUrl });
        return { ok: true };
    });

    ipcMain.handle('studylogger:getApiConfig', () => {
        const api = ctx.store.get('studyloggerApi') || {};
        const fb  = ctx.store.get('studylogger') || {};
        return { baseUrl: api.baseUrl || '', uid: fb.firebaseUid || '' };
    });

    ipcMain.handle('studylogger:pollTimer', async () => {
        const cfg = ctx.store.get('studyloggerApi') || {};
        if (!cfg.baseUrl) return { ok: false, error: 'not_configured' };
        const idToken = await getDesktopIdToken(ctx);
        if (!idToken) return { ok: false, error: '401' };
        const uid = (ctx.store.get('studylogger') || {}).firebaseUid || '';
        try {
            const res = await slApiRequest('GET', '/api/desktop/timer', { baseUrl: cfg.baseUrl, desktopToken: idToken, uid }, null);
            if (res.status === 401) return { ok: false, error: '401' };
            if (res.status === 404) return { ok: true, data: { status: 'idle', elapsed: 0 } };
            if (res.status >= 500) return { ok: false, error: '500' };
            return { ok: true, data: res.body };
        } catch (e) { return { ok: false, error: 'network', message: e.message }; }
    });

    ipcMain.handle('studylogger:controlTimer', async (_, actionOrPayload) => {
        const cfg = ctx.store.get('studyloggerApi') || {};
        if (!cfg.baseUrl) return { ok: false, error: 'not_configured' };
        const idToken = await getDesktopIdToken(ctx);
        if (!idToken) return { ok: false, error: '401' };
        const uid = (ctx.store.get('studylogger') || {}).firebaseUid || '';
        const action = typeof actionOrPayload === 'string' ? actionOrPayload : actionOrPayload?.action;
        const branchKey = typeof actionOrPayload === 'object' ? actionOrPayload?.branchKey : undefined;
        const accumulatedSeconds = typeof actionOrPayload === 'object' ? (actionOrPayload?.accumulatedSeconds ?? 0) : 0;
        try {
            const body = { uid, action, ...(branchKey ? { branchKey } : {}), ...(accumulatedSeconds ? { accumulatedSeconds } : {}) };
            const res = await slApiRequest('POST', '/api/desktop/timer', { baseUrl: cfg.baseUrl, desktopToken: idToken, uid }, body);
            if (res.status === 401) return { ok: false, error: '401' };
            if (res.status === 404) return { ok: false, error: '404', data: res.body };
            return { ok: true, data: res.body };
        } catch (e) { return { ok: false, error: 'network', message: e.message }; }
    });

    ipcMain.handle('studylogger:getStats', async () => {
        const cfg = ctx.store.get('studyloggerApi') || {};
        if (!cfg.baseUrl) return { ok: false, error: 'not_configured' };
        const idToken = await getDesktopIdToken(ctx);
        if (!idToken) return { ok: false, error: '401' };
        const uid = (ctx.store.get('studylogger') || {}).firebaseUid || '';
        try {
            const res = await slApiRequest('GET', '/api/desktop/stats', { baseUrl: cfg.baseUrl, desktopToken: idToken, uid }, null);
            if (res.status === 401) return { ok: false, error: '401' };
            if (res.status >= 500) return { ok: false, error: '500' };
            return { ok: true, data: res.body };
        } catch (e) { return { ok: false, error: 'network', message: e.message }; }
    });

    ipcMain.handle('studylogger:logSessionApi', async (_, payload) => {
        const cfg = ctx.store.get('studyloggerApi') || {};
        if (!cfg.baseUrl) return { ok: false, error: 'not_configured' };
        const idToken = await getDesktopIdToken(ctx);
        if (!idToken) return { ok: false, error: '401' };
        const uid = (ctx.store.get('studylogger') || {}).firebaseUid || '';
        try {
            const body = {
                subject: String(payload.subject || ''),
                topic: String(payload.topic || ''),
                durationMinutes: Number(payload.durationMinutes) || 0,
                questionCount: Number(payload.questionCount) || 0,
                notes: payload.notes ? String(payload.notes) : undefined,
            };
            const res = await slApiRequest('POST', '/api/desktop/log', { baseUrl: cfg.baseUrl, desktopToken: idToken, uid }, body);
            if (res.status === 401) return { ok: false, error: '401' };
            if (res.status >= 400) return { ok: false, error: String(res.status), data: res.body };
            return { ok: true, data: res.body };
        } catch (e) { return { ok: false, error: 'network', message: e.message }; }
    });

    ipcMain.handle('studylogger:logExamApi', async (_, payload) => {
        const cfg = ctx.store.get('studyloggerApi') || {};
        if (!cfg.baseUrl) return { ok: false, error: 'not_configured' };
        const idToken = await getDesktopIdToken(ctx);
        if (!idToken) return { ok: false, error: '401' };
        const uid = (ctx.store.get('studylogger') || {}).firebaseUid || '';
        try {
            const body = {
                examType: String(payload.examType || ''),
                examCategory: String(payload.examCategory || 'brans'),
                subject: payload.subject ? String(payload.subject) : undefined,
                net: payload.net != null ? Number(payload.net) : undefined,
                durationMinutes: payload.durationMinutes ? Number(payload.durationMinutes) : undefined,
                date: payload.date ? String(payload.date) : new Date().toISOString().split('T')[0],
                notes: payload.notes ? String(payload.notes) : undefined,
                subjectNets: payload.subjectNets || undefined,
                totalNet: payload.totalNet != null ? Number(payload.totalNet) : undefined,
                uid,
            };
            const res = await slApiRequest('POST', '/api/desktop/exam', { baseUrl: cfg.baseUrl, desktopToken: idToken, uid }, body);
            if (res.status === 401) return { ok: false, error: '401' };
            if (res.status >= 400) return { ok: false, error: String(res.status), data: res.body };
            return { ok: true, data: res.body };
        } catch (e) { return { ok: false, error: 'network', message: e.message }; }
    });

    // ── Notifications ──
    ipcMain.handle('notifications:getAll', () => ctx.notificationHistory || []);

    ipcMain.handle('notifications:clear', () => {
        ctx.notificationHistory = [];
        return true;
    });

    ipcMain.handle('notifications:markRead', () => {
        (ctx.notificationHistory || []).forEach(n => { n.read = true; });
        return true;
    });

    ipcMain.handle('notifications:getSettings', () => {
        const s = ctx.store.get('settings') || {};
        return {
            notifEnabled:     s.notifEnabled !== false,
            notifBlockedApps: s.notifBlockedApps || '',
            notifSocketPort:  s.notifSocketPort || 8765,
        };
    });

    ipcMain.handle('notifications:saveSettings', (_, patch) => {
        const settings = ctx.store.get('settings') || {};
        if (typeof patch.notifEnabled === 'boolean')    settings.notifEnabled    = patch.notifEnabled;
        if (typeof patch.notifBlockedApps === 'string') settings.notifBlockedApps = patch.notifBlockedApps;
        if (typeof patch.notifSocketPort === 'number')  settings.notifSocketPort  = patch.notifSocketPort;
        ctx.store.set('settings', settings);

        // Apply bridge enable/disable
        if (patch.notifEnabled === false) {
            stopNotificationBridge(ctx);
            stopSocketServer(ctx);
        } else if (patch.notifEnabled === true && ctx.notifBridgeDisabled) {
            ctx.notifBridgeDisabled = false;
            startNotificationBridge(ctx);
            startSocketServer(ctx);
        }

        // Restart socket if port changed
        if (typeof patch.notifSocketPort === 'number') {
            stopSocketServer(ctx);
            startSocketServer(ctx);
        }

        return settings;
    });

    ipcMain.handle('notifications:getSocketStatus', () => getSocketStatus(ctx));
}

module.exports = { registerIPC };
