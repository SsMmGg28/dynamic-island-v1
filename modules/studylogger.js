// Firebase auth + StudyLogger REST API helpers.
const https = require('https');
const http = require('http');

const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyClGwTN8RFi6nIzpLajlruiO9ntjtvRZcI',
    authDomain: 'studylogger-c55fe.firebaseapp.com',
    projectId: 'studylogger-c55fe',
    storageBucket: 'studylogger-c55fe.firebasestorage.app',
    messagingSenderId: '54405801440',
    appId: '1:54405801440:web:4ae8870a091193277bf785',
};

async function initFirebase(ctx) {
    if (ctx._fbAuth) return true;
    try {
        const { initializeApp, getApps } = await import('firebase/app');
        const { getAuth, signInWithCustomToken, signOut } = await import('firebase/auth');
        const { getFirestore, collection, addDoc, Timestamp } = await import('firebase/firestore');
        const fbApp = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
        ctx._fbAuth = getAuth(fbApp);
        ctx._fbDb = getFirestore(fbApp);
        ctx._fbHelpers = { signInWithCustomToken, signOut, collection, addDoc, Timestamp };
        return true;
    } catch (e) {
        console.error('[StudyLogger] Firebase init failed:', e.message);
        return false;
    }
}

// Exchange a Firebase refresh token for a fresh ID token via REST API.
function exchangeRefreshToken(refreshToken, store) {
    return new Promise((resolve) => {
        const url = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`;
        const body = JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken });
        const req = https.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.id_token) {
                        const saved = store.get('studylogger') || {};
                        store.set('studylogger', { ...saved, refreshToken: json.refresh_token || refreshToken });
                        resolve(json.id_token);
                    } else { resolve(null); }
                } catch { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(8000, () => { req.destroy(); resolve(null); });
        req.write(body);
        req.end();
    });
}

async function getDesktopIdToken(ctx) {
    if (ctx._fbAuth && ctx._fbAuth.currentUser) {
        try { return await ctx._fbAuth.currentUser.getIdToken(); } catch {}
    }
    const saved = ctx.store.get('studylogger') || {};
    if (saved.refreshToken) {
        const idToken = await exchangeRefreshToken(saved.refreshToken, ctx.store);
        if (idToken) return idToken;
    }
    if (!saved.customToken) return null;
    try {
        const ok = await initFirebase(ctx);
        if (!ok) return null;
        const cred = await ctx._fbHelpers.signInWithCustomToken(ctx._fbAuth, saved.customToken);
        const user = cred.user;
        const idToken = await user.getIdToken();
        const refreshToken = user.refreshToken;
        ctx.store.set('studylogger', { ...saved, idToken, refreshToken, firebaseUid: user.uid });
        return idToken;
    } catch { return null; }
}

function slApiRequest(method, urlPath, cfg, body) {
    return new Promise((resolve, reject) => {
        let urlStr;
        try {
            const u = new URL(urlPath, cfg.baseUrl);
            if (method === 'GET') u.searchParams.set('uid', cfg.uid);
            urlStr = u.toString();
        } catch (e) { return reject(new Error('invalid_url')); }

        const mod = urlStr.startsWith('https') ? https : http;
        const payload = body ? JSON.stringify(body) : null;
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${cfg.desktopToken}`,
                'User-Agent': 'DynamicIsland/1.0',
                ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
            },
        };

        const req = mod.request(urlStr, options, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                console.log(`[SL] ${method} ${urlStr} → ${res.statusCode}`, data.substring(0, 200));
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
        if (payload) req.write(payload);
        req.end();
    });
}

module.exports = { FIREBASE_CONFIG, initFirebase, exchangeRefreshToken, getDesktopIdToken, slApiRequest };
