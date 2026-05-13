/* ── gamemode.js ── Performance-first game mode HUD
 *
 * Design principles:
 *  1. ZERO timers run when the HUD is hidden → no CPU wake-ups → no FPS impact.
 *  2. System stats are fetched ON DEMAND (once on open, then every 6 s while visible).
 *  3. Uptime counter uses requestAnimationFrame but only ticks while visible.
 *  4. Volume slider fires IPC only on 'change' (pointer-up), not on 'input'.
 *  5. Main process sets window opacity=0 when HUD is hidden → DWM bypass.
 */

const GM_STATS_INTERVAL = 6000;   // ms between system-info fetches while HUD is open
const GM_AUTO_HIDE_MS   = 25000;  // auto-hide the HUD after 25 s of no interaction

let _statsTimeout   = null;   // setTimeout chain for stats while HUD open
let _uptimeRaf      = null;   // requestAnimationFrame handle for uptime ticker
let _autoHideTimer  = null;   // auto-hide countdown

/* ── Public entry points called from renderer.js ──────────────────────── */

function setupGameMode() {
    if (dom.gamemodeBtn) {
        dom.gamemodeBtn.addEventListener('click', async () => {
            await window.api.setGameMode(!state.gameModeActive);
        });
    }
}

function setupGameModeHud() {
    const prevBtn   = $('#gm-prev');
    const playBtn   = $('#gm-play');
    const nextBtn   = $('#gm-next');
    const exitBtn   = $('#gm-exit');
    const volSlider = $('#gm-vol-slider');
    const hud       = $('#gm-hud');

    if (prevBtn)  prevBtn.addEventListener('click',  () => window.api.mediaPrev());
    if (playBtn)  playBtn.addEventListener('click',  () => window.api.mediaToggle());
    if (nextBtn)  nextBtn.addEventListener('click',  () => window.api.mediaNext());
    if (exitBtn)  exitBtn.addEventListener('click',  async () => { await window.api.setGameMode(false); });

    if (volSlider) {
        // Update display on every drag tick (no IPC)
        volSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            state.volume = val;
            const volVal = $('#gm-vol-val');
            if (volVal) volVal.textContent = val;
            if (dom.volumeSlider) dom.volumeSlider.value = val;
            if (dom.volumeVal)    dom.volumeVal.textContent = val;
            _resetAutoHide();
        });
        // Send IPC only once the user releases the slider
        volSlider.addEventListener('change', (e) => {
            window.api.setVolume(parseInt(e.target.value));
        });
    }

    // Reset auto-hide timer while the user is interacting with the HUD.
    // Also ensure mouse events are never ignored while the HUD is visible and
    // the user is actively pressing a button (pointerdown fires before click).
    if (hud) {
        hud.addEventListener('pointerenter', () => {
            window.api.setMouseIgnore(false);
            _cancelAutoHide();
        });
        hud.addEventListener('pointerleave', _resetAutoHide);
        hud.addEventListener('pointerdown',  () => window.api.setMouseIgnore(false));
        hud.addEventListener('click',        _resetAutoHide);
    }
}

/* ── Game mode activation / deactivation ──────────────────────────────── */

function handleGameModeSwitch(active) {
    if (active) {
        _enterGameMode();
    } else {
        _exitGameMode();
    }
}

function _enterGameMode() {
    // Freeze every renderer-side timer that could wake the CPU
    _stopAllRendererTimers();

    // Clear leftover UI state
    state.lyricsData        = null;
    state.lastLyricsQuery   = '';
    if (dom.lyricsScroll) dom.lyricsScroll.innerHTML = '';
    if (dom.weatherBody)  dom.weatherBody.innerHTML  = '';

    state.gameModeStartTime = Date.now();

    // Collapse the island (it will be hidden by CSS when window moves)
    collapseIsland();
    dom.island.classList.add('gamemode-hidden');

    showGameModeSidebar();
    showToast('Oyun Modu aktif');
}

function _exitGameMode() {
    hideGameModeSidebar();

    dom.island.classList.remove('gamemode-hidden');
    state.gameModeStartTime = null;

    // Resume position interpolation if media was playing
    if (state.media && state.media.status === 'Playing' && !state.posInterval) {
        state.posInterval = setInterval(interpolatePosition, 100);
    }

    startIdleTimer();
    showToast('Oyun Modu kapatıldı');
}

function updateGameModeUI() {
    const active = state.gameModeActive;
    if (dom.gamemodeCard)   dom.gamemodeCard.classList.toggle('active', active);
    if (dom.gamemodeStatus) dom.gamemodeStatus.textContent = active ? 'Aktif' : 'Kapalı';
    if (dom.gamemodeBtn)    dom.gamemodeBtn.textContent    = active ? 'Devre Dışı Bırak' : 'Etkinleştir';
    if (dom.island)         dom.island.classList.toggle('gamemode-active', active);
    const gmBtn = $('#act-gamemode');
    if (gmBtn) gmBtn.classList.toggle('active', active);
}

/* ── Sidebar show / hide ──────────────────────────────────────────────── */

function showGameModeSidebar() {
    const hud = $('#gm-hud');
    if (!hud) return;

    state.gameModeOverlayVisible = true;

    // Tell main process: window should be visible + unthrottled
    window.api.setGameModeSidebar(true);

    // Populate from current state immediately; if state.media is stale/null,
    // do a one-shot IPC fetch so the HUD isn't blank on first open.
    if (state.media && state.media.title) {
        _updateHudMedia();
    } else {
        window.api.getMediaInfo().then(info => {
            if (info) {
                handleMediaUpdate(info);
                _updateHudMedia();
            }
        }).catch(() => {});
    }

    // Fetch stats once — starts the refresh chain
    _fetchStats();

    // Start uptime display
    _startUptimeTick();

    // Show via GPU-composited CSS transform only
    hud.classList.add('visible');

    // Sync volume slider with current state
    const volSlider = $('#gm-vol-slider');
    const volVal    = $('#gm-vol-val');
    if (volSlider) volSlider.value = state.volume;
    if (volVal)    volVal.textContent = state.volume;

    // Auto-hide after GM_AUTO_HIDE_MS of inactivity
    _resetAutoHide();
}

function hideGameModeSidebar() {
    const hud = $('#gm-hud');
    if (!hud) return;

    state.gameModeOverlayVisible = false;

    // Kill all HUD timers before telling main to go dark
    _stopHudTimers();

    // Slide out via CSS transform
    hud.classList.remove('visible');

    // Tell main process: window can go opacity=0 (DWM bypass)
    window.api.setGameModeSidebar(false);
}

/* ── Stats (on-demand, no constant polling) ───────────────────────────── */

function _fetchStats() {
    window.api.getSystemInfo().then(info => {
        if (!info || !state.gameModeOverlayVisible) return;

        const cpuEl = $('#gm-cpu-val');
        const ramEl = $('#gm-ram-val');
        if (cpuEl) cpuEl.textContent = info.cpu + '%';
        if (ramEl) ramEl.textContent = info.mem + '%';

        // Schedule the next refresh only while HUD is open
        _statsTimeout = setTimeout(() => {
            if (state.gameModeOverlayVisible) _fetchStats();
        }, GM_STATS_INTERVAL);
    }).catch(() => {
        // Retry after the interval even on error
        _statsTimeout = setTimeout(() => {
            if (state.gameModeOverlayVisible) _fetchStats();
        }, GM_STATS_INTERVAL);
    });
}

/* ── Uptime (rAF-based, only while HUD is open) ──────────────────────── */

function _startUptimeTick() {
    if (_uptimeRaf) cancelAnimationFrame(_uptimeRaf);
    const uptimeEl = $('#gm-uptime');
    if (!uptimeEl || !state.gameModeStartTime) return;

    let lastSec = -1;
    function tick() {
        if (!state.gameModeOverlayVisible) return; // stop when hidden
        const elapsed = Math.floor((Date.now() - state.gameModeStartTime) / 1000);
        if (elapsed !== lastSec) {
            lastSec = elapsed;
            const h = Math.floor(elapsed / 3600);
            const m = Math.floor((elapsed % 3600) / 60);
            const s = elapsed % 60;
            uptimeEl.textContent = h > 0
                ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        _uptimeRaf = requestAnimationFrame(tick);
    }
    _uptimeRaf = requestAnimationFrame(tick);
}

/* ── Media display (event-driven, no polling) ────────────────────────── */

function _updateHudMedia() {
    const titleEl  = $('#gm-title');
    const artistEl = $('#gm-artist');
    const playIcon = $('#gm-play-icon');

    if (state.media && state.media.title && state.media.status !== 'None') {
        if (titleEl)  titleEl.textContent  = state.media.title;
        if (artistEl) artistEl.textContent = state.media.artist || '';
        if (playIcon) {
            const playing = state.media.status === 'Playing';
            playIcon.innerHTML = playing
                ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
                : '<polygon points="5,3 19,12 5,21"/>';
        }
    } else {
        if (titleEl)  titleEl.textContent  = 'Müzik çalmıyor';
        if (artistEl) artistEl.textContent = '—';
    }
}

// Called from media.js / renderer.js whenever a media:update event arrives
function updateHudOnMediaChange() {
    if (state.gameModeOverlayVisible) _updateHudMedia();
}

/* ── Auto-hide helpers ───────────────────────────────────────────────── */

function _cancelAutoHide() {
    if (_autoHideTimer) { clearTimeout(_autoHideTimer); _autoHideTimer = null; }
}

function _resetAutoHide() {
    _cancelAutoHide();
    if (state.gameModeOverlayVisible) {
        _autoHideTimer = setTimeout(hideGameModeSidebar, GM_AUTO_HIDE_MS);
    }
}

/* ── Timer helpers ───────────────────────────────────────────────────── */

function _stopHudTimers() {
    if (_statsTimeout)  { clearTimeout(_statsTimeout);          _statsTimeout  = null; }
    if (_autoHideTimer) { clearTimeout(_autoHideTimer);         _autoHideTimer = null; }
    if (_uptimeRaf)     { cancelAnimationFrame(_uptimeRaf);     _uptimeRaf     = null; }
}

function _stopAllRendererTimers() {
    _stopHudTimers();
    if (state.posInterval)     { clearInterval(state.posInterval);      state.posInterval     = null; }
    if (state.idleTimer)       { clearTimeout(state.idleTimer);         state.idleTimer       = null; }
    if (state.monitorInterval) { stopMonitorPolling(); }
    if (state.slPollTimer)     { clearTimeout(state.slPollTimer);       state.slPollTimer     = null; }
    if (state.slSmoothInterval){ clearInterval(state.slSmoothInterval); state.slSmoothInterval = null; }
    if (state.isIdle)          { exitIdleMode(); }
}
