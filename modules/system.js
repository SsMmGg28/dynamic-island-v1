// System utilities: volume, brightness, CPU/RAM, weather, lyrics.
// Pure async functions — no main-window or tray references needed.
const { exec } = require('child_process');
const https = require('https');
const http = require('http');

// ── Lazy-loaded native modules ──
let loudness = null, loudnessLoaded = false;
let si = null, siLoaded = false;

function getLoudness() {
    if (!loudnessLoaded) {
        loudnessLoaded = true;
        try { loudness = require('loudness'); } catch {}
    }
    return loudness;
}

function getSI() {
    if (!siLoaded) {
        siLoaded = true;
        try { si = require('systeminformation'); } catch {}
    }
    return si;
}

// ── HTTP helper ──
function httpGet(url) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        mod.get(url, { headers: { 'User-Agent': 'DynamicIsland/1.0' } }, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(data); }
            });
        }).on('error', reject);
    });
}

// ── Volume ──
async function getVolume() {
    const vol = getLoudness();
    if (vol) {
        try { return await vol.getVolume(); } catch {}
    }
    return new Promise((resolve) => {
        exec('powershell -NoProfile -Command "[Math]::Round([Audio.Volume]::Volume * 100)"', (err, out) => {
            resolve(err ? 50 : parseInt(out) || 50);
        });
    });
}

async function setVolume(val) {
    val = Math.max(0, Math.min(100, Math.round(val)));
    const vol = getLoudness();
    if (vol) {
        try { await vol.setVolume(val); return; } catch {}
    }
    exec(`powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"`, () => {});
}

// ── Brightness ──
async function getBrightness() {
    return new Promise((resolve) => {
        exec(
            'powershell -NoProfile -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness"',
            (err, out) => resolve(err ? -1 : parseInt(out) || -1)
        );
    });
}

async function setBrightness(val) {
    val = Math.max(0, Math.min(100, Math.round(val)));
    return new Promise((resolve) => {
        exec(
            `powershell -NoProfile -Command "(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${val})"`,
            () => resolve()
        );
    });
}

// ── System Info ──
async function getSystemInfo() {
    const sysinfo = getSI();
    if (!sysinfo) return { cpu: 0, mem: 0, gpu: 0 };
    try {
        const [cpuLoad, mem] = await Promise.all([
            sysinfo.currentLoad(),
            sysinfo.mem(),
        ]);
        return {
            cpu: Math.round(cpuLoad.currentLoad || 0),
            mem: Math.round(((mem.used || 0) / (mem.total || 1)) * 100),
            memUsed: ((mem.used || 0) / 1073741824).toFixed(1),
            memTotal: ((mem.total || 0) / 1073741824).toFixed(1),
        };
    } catch {
        return { cpu: 0, mem: 0, gpu: 0 };
    }
}

// ── Weather ──
async function getWeatherLocation() {
    try {
        return await httpGet('http://ip-api.com/json/?fields=lat,lon,city,country');
    } catch { return null; }
}

async function getWeather(lat, lon) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
        return await httpGet(url);
    } catch { return null; }
}

// ── Lyrics (with LRU cache, max 15 entries) ──
const lyricsCache = {};
const lyricsCacheKeys = [];
const LYRICS_CACHE_MAX = 15;

async function getLyrics(title, artist, duration) {
    if (!title) return null;
    const cacheKey = `${title}|${artist}`;
    if (lyricsCache[cacheKey]) return lyricsCache[cacheKey];
    try {
        const params = new URLSearchParams({ track_name: title, artist_name: artist || '' });
        if (duration) params.append('duration', Math.round(duration));
        const url = `https://lrclib.net/api/get?${params.toString()}`;
        const data = await httpGet(url);
        if (data && (data.syncedLyrics || data.plainLyrics)) {
            if (lyricsCacheKeys.length >= LYRICS_CACHE_MAX) {
                const oldest = lyricsCacheKeys.shift();
                delete lyricsCache[oldest];
            }
            lyricsCache[cacheKey] = data;
            lyricsCacheKeys.push(cacheKey);
        }
        return data;
    } catch { return null; }
}

module.exports = {
    getLoudness, getSI, httpGet,
    getVolume, setVolume,
    getBrightness, setBrightness,
    getSystemInfo,
    getWeatherLocation, getWeather,
    getLyrics,
};
