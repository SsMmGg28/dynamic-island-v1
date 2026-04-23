/* ══════════════════════════════════════════════════════════════
   Dynamic Island for Windows — Renderer v1.1
   ══════════════════════════════════════════════════════════════ */

// ── State ──
const state = {
    expanded: false,
    locked: false,
    activePanel: null,
    media: null,
    lyricsData: null,
    lyricsActive: false,
    lastLyricsQuery: '',
    volume: 50,
    brightness: 50,
    brightnessSupported: true,
    gameModeActive: false,
    gameModeOverlayVisible: false,
    gameModeAutoHideTimer: null,
    gameModeStartTime: null,
    gameModeUptimeInterval: null,
    weather: null,
    weatherLocation: null,
    timerTotal: 25 * 60,
    timerRemaining: 25 * 60,
    timerRunning: false,
    timerInterval: null,
    settings: {},
    monitorInterval: null,
    interpolatedPos: 0,
    lastMediaTime: 0,
    posInterval: null,
    notes: [],
    clipboardHistory: [],
    launcherApps: [],
    installedApps: [],
    themePresets: [],
    isDragging: false,
    isIdle: false,
    idleTimer: null,
    idleTimeout: 15000,
    studyLogger: {
        uid: null,
        connected: false,
    },
};

// ── DOM Cache ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    island: $('#island'),
    collapsedView: $('#collapsed-view'),
    expandedView: $('#expanded-view'),
    clock: $('#clock-display'),
    statusDot: $('#status-dot'),
    mediaMini: $('#media-mini'),
    miniText: $('#mini-text'),
    pulseRing: $('#pulse-ring'),
    mediaTitle: $('#media-title'),
    mediaArtist: $('#media-artist'),
    playIcon: $('#play-icon'),
    btnToggle: $('#btn-toggle'),
    btnPrev: $('#btn-prev'),
    btnNext: $('#btn-next'),
    timeCurrent: $('#time-current'),
    timeTotal: $('#time-total'),
    progressFill: $('#progress-fill'),
    progressThumb: $('#progress-thumb'),
    progressTrack: $('#progress-track'),
    lyricsToggle: $('#lyrics-toggle'),
    lyricsContainer: $('#lyrics-container'),
    lyricsScroll: $('#lyrics-scroll'),
    volumeSlider: $('#volume-slider'),
    volumeVal: $('#volume-val'),
    brightnessSlider: $('#brightness-slider'),
    brightnessVal: $('#brightness-val'),
    brightnessRow: $('#brightness-row'),
    gamemodeCard: $('#gamemode-card'),
    gamemodeStatus: $('#gamemode-status'),
    gamemodeBtn: $('#gamemode-btn'),
    timerDisplay: $('#timer-display'),
    timerRingFill: $('#timer-ring-fill'),
    timerStartBtn: $('#timer-start'),
    weatherBody: $('#weather-body'),
    cpuGauge: $('#cpu-gauge'),
    ramGauge: $('#ram-gauge'),
    cpuValue: $('#cpu-value'),
    ramValue: $('#ram-value'),
    ramDetail: $('#ram-detail'),
    opacitySlider: $('#opacity-slider'),
    lyricsSetting: $('#lyrics-setting'),
    toastContainer: $('#toast-container'),
};

// ── Initialization ──
async function init() {
    // Force initial paint of collapsed state
    dom.island.classList.add('collapsed');
    dom.island.offsetHeight; // Force reflow to ensure CSS applies immediately

    updateClock();
    setInterval(updateClock, 30000); // 30s is enough for HH:MM format
    setupClickThrough();
    setupIslandEvents();
    setupDragEvents();
    setupMediaControls();
    setupSliders();
    setupActions();
    setupTimer();
    setupSettings();
    setupNotesPanel();
    setupNotesEventDelegation();
    setupClipboardEventDelegation();
    setupScreenshotButton();
    setupMoreMenu();
    setupGameModeSidebar();
    setupStudyLogger();
    // Load theme presets BEFORE settings so saved theme can be applied
    try {
        state.themePresets = await window.api.getThemePresets() || [];
    } catch {}
    await loadSettings();
    await loadInitialData();

    // Events from main process
    window.api.onMediaUpdate(handleMediaUpdate);
    window.api.onGameModeUpdated((active) => {
        state.gameModeActive = active;
        updateGameModeUI();
        handleGameModeSwitch(active);
    });
    window.api.onClipboardNew((data) => {
        state.clipboardHistory.unshift(data);
        if (state.clipboardHistory.length > 20) state.clipboardHistory.pop();
        renderClipboardHistory();
    });
    window.api.onShortcutToggleIsland(() => {
        if (state.gameModeActive) {
            // In game mode, toggle sidebar visibility
            const sidebar = $('#gamemode-sidebar');
            if (sidebar && sidebar.classList.contains('visible')) {
                hideGameModeSidebar();
            } else {
                showGameModeSidebar();
            }
            return;
        }
        if (state.expanded) collapseIsland();
        else expandIsland();
    });
    window.api.onShortcutTimerToggle(() => {
        if (state.timerRunning) stopTimer();
        else startTimer();
    });
    window.api.onOpenPanel((panel) => {
        if (!state.expanded) expandIsland();
        setTimeout(() => openPanel(panel), 200);
    });
}

// ── SVG Icon Helpers ──
const SVG_ICONS = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="weather-svg"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    partcloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="weather-svg"><path d="M12 2v2m6.36.64l-1.41 1.41M20 12h2M17.66 17.66l1.41 1.41"/><circle cx="12" cy="10" r="4"/><path d="M8 16a5 5 0 0 1 8.54-3.54A4 4 0 1 1 19 20H7a3 3 0 1 1 1-5.83"/></svg>',
    fog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="weather-svg"><path d="M3 15h18M3 19h18M8 11a4 4 0 1 1 8 0"/></svg>',
    drizzle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="weather-svg"><path d="M8 19v2m4-2v2m4-2v2"/><path d="M4 13a5 5 0 0 1 9.9-1A3.5 3.5 0 1 1 18 16H5a4 4 0 0 1-1-3z"/></svg>',
    rain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="weather-svg"><path d="M7 19l-1 3m5-3l-1 3m5-3l-1 3m5-3l-1 3"/><path d="M4 13a5 5 0 0 1 9.9-1A3.5 3.5 0 1 1 18 16H5a4 4 0 0 1-1-3z"/></svg>',
    snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="weather-svg"><path d="M4 13a5 5 0 0 1 9.9-1A3.5 3.5 0 1 1 18 16H5a4 4 0 0 1-1-3z"/><circle cx="8" cy="20" r="1" fill="currentColor"/><circle cx="12" cy="22" r="1" fill="currentColor"/><circle cx="16" cy="20" r="1" fill="currentColor"/></svg>',
    thunder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="weather-svg"><path d="M4 13a5 5 0 0 1 9.9-1A3.5 3.5 0 1 1 18 16H5a4 4 0 0 1-1-3z"/><path d="M13 16l-2 4h3l-2 4"/></svg>',
    variable: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="weather-svg"><circle cx="12" cy="10" r="4"/><path d="M4 13a5 5 0 0 1 9.9-1A3.5 3.5 0 1 1 18 16H5a4 4 0 0 1-1-3z"/></svg>',
    humidity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14" style="vertical-align:-2px"><path d="M12 2C8 7 4 11 4 15a8 8 0 0 0 16 0c0-4-4-8-8-13z"/></svg>',
    wind: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14" style="vertical-align:-2px"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
};
function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ── Click-Through ──
function setupClickThrough() {
    // Window starts with setIgnoreMouseEvents(true, {forward:true})
    // This makes transparent areas click-through but still forwards mouse events
    // When mouse enters the island, we disable ignore so clicks work
    // When mouse leaves, we re-enable ignore so clicks pass through

    dom.island.addEventListener('mouseenter', () => {
        window.api.setMouseIgnore(false);
    });

    dom.island.addEventListener('mouseleave', () => {
        if (!state.gameModeActive) {
            window.api.setMouseIgnore(true);
        }
    });

    const sidebar = $('#gamemode-sidebar');
    if (sidebar) {
        sidebar.addEventListener('mouseenter', () => {
            window.api.setMouseIgnore(false);
        });
        sidebar.addEventListener('mouseleave', () => {
            window.api.setMouseIgnore(true);
        });
    }
}

// ── Clock ──
function updateClock() {
    const now = new Date();
    dom.clock.textContent = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// ── Island Expand / Collapse with Idle Tracking ──
let collapseTimeout = null;

function setupIslandEvents() {
    dom.island.addEventListener('mouseenter', () => {
        if (state.isDragging) return;
        if (collapseTimeout) { clearTimeout(collapseTimeout); collapseTimeout = null; }
        // Exit idle/notch mode on hover
        exitIdleMode();
        expandIsland();
    });

    dom.island.addEventListener('mouseleave', () => {
        if (state.locked || state.isDragging) return;
        collapseTimeout = setTimeout(collapseIsland, 400);
        // Start idle timer after collapse
        startIdleTimer();
    });
}

function startIdleTimer() {
    if (state.idleTimer) clearTimeout(state.idleTimer);
    if (state.gameModeActive) return; // No idle in game mode
    state.idleTimer = setTimeout(() => {
        if (!state.expanded && !state.locked && !state.gameModeActive) {
            enterIdleMode();
        }
    }, state.idleTimeout);
}

function enterIdleMode() {
    if (state.isIdle) return;
    state.isIdle = true;
    // Determine if media is actively playing
    const hasActiveMedia = state.media && state.media.title && state.media.status === 'Playing';
    dom.island.classList.add('idle-notch');
    if (!hasActiveMedia) {
        dom.island.classList.add('idle-clock-only');
    } else {
        dom.island.classList.remove('idle-clock-only');
    }
    // Stop position interpolation to save CPU
    if (state.posInterval) { clearInterval(state.posInterval); state.posInterval = null; }
}

function exitIdleMode() {
    if (!state.isIdle) return;
    state.isIdle = false;
    if (state.idleTimer) { clearTimeout(state.idleTimer); state.idleTimer = null; }
    dom.island.classList.remove('idle-notch', 'idle-clock-only');
    // Resume position interpolation if media is playing
    if (state.media && state.media.status === 'Playing' && !state.posInterval) {
        state.posInterval = setInterval(interpolatePosition, 100);
    }
}

function expandIsland() {
    if (state.expanded) return;
    state.expanded = true;
    dom.island.classList.remove('collapsed');
    dom.island.classList.add('expanded');
    // Refresh full media UI since we skip updates while collapsed
    if (state.media) updateMediaUI();
}

function collapseIsland() {
    if (!state.expanded || state.locked) return;
    state.expanded = false;
    state.activePanel = null;
    dom.island.classList.remove('expanded', 'sub-open');
    dom.island.classList.add('collapsed');
    $$('.sub-panel').forEach(p => p.classList.remove('active'));
    stopMonitorPolling();
}

// ── Drag to Reposition ──
function setupDragEvents() {
    const collapsed = dom.collapsedView;
    let startX, startY, winX, winY;

    collapsed.addEventListener('mousedown', async (e) => {
        if (state.expanded) return;
        startX = e.screenX;
        startY = e.screenY;
        const pos = await window.api.getWindowPosition();
        winX = pos[0];
        winY = pos[1];
        state.isDragging = false;

        const onMove = (ev) => {
            const dx = ev.screenX - startX;
            const dy = ev.screenY - startY;
            if (!state.isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
                state.isDragging = true;
            }
            if (state.isDragging) {
                window.api.setWindowPosition(winX + dx, winY + dy);
            }
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (state.isDragging) {
                setTimeout(() => { state.isDragging = false; }, 100);
            }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// ── Sub Panel Navigation ──
function openPanel(panelId) {
    state.locked = true;
    state.activePanel = panelId;
    dom.island.classList.add('sub-open');
    $$('.sub-panel').forEach(p => p.classList.remove('active'));
    const panel = $(`#panel-${panelId}`);
    if (panel) panel.classList.add('active');
    if (panelId === 'weather') loadWeather();
    if (panelId === 'monitor') startMonitorPolling();
    if (panelId === 'notes') loadNotesAndClipboard();
    if (panelId === 'settings') loadSettingsPanel();
    if (panelId === 'studylogger') loadStudyLoggerPanel();
}

function closePanel() {
    state.locked = false;
    state.activePanel = null;
    dom.island.classList.remove('sub-open');
    $$('.sub-panel').forEach(p => p.classList.remove('active'));
    stopMonitorPolling();
}

function setupActions() {
    $$('.action-btn[data-panel]').forEach(btn => {
        btn.addEventListener('click', () => openPanel(btn.dataset.panel));
    });
    $$('.back-btn[data-back]').forEach(btn => {
        btn.addEventListener('click', closePanel);
    });
}

// ── Media ──
function handleMediaUpdate(info) {
    if (!info) return;
    // Smooth position: if same track, blend instead of jumping
    if (state.media && info.title === state.media.title && info.duration === state.media.duration && info.status === 'Playing') {
        const diff = Math.abs(state.interpolatedPos - (info.position || 0));
        if (diff < 3) {
            // Small difference — keep interpolated to avoid jumping
            info = { ...info, position: state.interpolatedPos };
        }
    }
    state.media = info;
    state.interpolatedPos = info.position || 0;
    state.lastMediaTime = Date.now();

    // Only update mini-text when collapsed (full UI update is wasteful)
    if (!state.expanded && !state.gameModeOverlayVisible) {
        if (info.title && info.status !== 'None') {
            dom.miniText.textContent = `${info.title} — ${info.artist}`;
            dom.statusDot.classList.add('active');
            dom.mediaMini.classList.add('active');
            dom.clock.classList.add('hidden');
            const eq = dom.mediaMini.querySelector('.mini-equalizer');
            eq.classList.toggle('paused', info.status !== 'Playing');
        } else {
            dom.statusDot.classList.remove('active');
            dom.mediaMini.classList.remove('active');
            dom.clock.classList.remove('hidden');
        }
    } else {
        updateMediaUI();
    }

    if (state.gameModeOverlayVisible) updateSidebarContent();

    // Update idle-notch display when media state changes while idle
    if (state.isIdle) {
        const hasActiveMedia = info.title && info.status === 'Playing';
        dom.island.classList.toggle('idle-clock-only', !hasActiveMedia);
    }

    if (info.status === 'Playing' && !state.posInterval && !state.gameModeActive && !state.isIdle) {
        state.posInterval = setInterval(interpolatePosition, 100);
    } else if (info.status !== 'Playing' && state.posInterval) {
        clearInterval(state.posInterval);
        state.posInterval = null;
    }
}

function interpolatePosition() {
    if (!state.media || state.media.status !== 'Playing' || state.gameModeActive || state.isIdle) return;
    const elapsed = (Date.now() - state.lastMediaTime) / 1000;
    state.interpolatedPos = Math.min((state.media.position || 0) + elapsed, state.media.duration || 0);
    // Only update DOM if expanded (progress bar visible)
    if (state.expanded && state.media.duration > 0) {
        const pct = (state.interpolatedPos / state.media.duration) * 100;
        dom.progressFill.style.width = pct + '%';
        dom.progressThumb.style.left = pct + '%';
        dom.timeCurrent.textContent = formatTime(state.interpolatedPos);
    }
    if (state.lyricsActive && state.lyricsData) {
        updateLyricsDisplay(state.interpolatedPos);
    }
}

function updateMediaUI() {
    const m = state.media;
    if (!m || !m.title || m.status === 'None') {
        dom.statusDot.classList.remove('active');
        dom.mediaMini.classList.remove('active');
        dom.pulseRing.classList.remove('active');
        dom.clock.classList.remove('hidden');
        dom.mediaTitle.textContent = 'Müzik çalmıyor';
        dom.mediaArtist.textContent = '—';
        dom.miniText.textContent = '';
        updatePlayIcon(false);
        updateAlbumArt(null);
        return;
    }

    const isPlaying = m.status === 'Playing';

    dom.statusDot.classList.add('active');
    dom.pulseRing.classList.toggle('active', isPlaying);
    dom.clock.classList.add('hidden');
    dom.mediaMini.classList.add('active');
    dom.miniText.textContent = `${m.title} — ${m.artist}`;

    const eq = dom.mediaMini.querySelector('.mini-equalizer');
    eq.classList.toggle('paused', !isPlaying);

    dom.mediaTitle.textContent = m.title || 'Bilinmeyen';
    dom.mediaArtist.textContent = m.artist || 'Bilinmeyen Sanatçı';
    updatePlayIcon(isPlaying);
    updateAlbumArt(m.thumbnail);

    if (m.duration > 0) {
        const pct = (m.position / m.duration) * 100;
        dom.progressFill.style.width = pct + '%';
        dom.progressThumb.style.left = pct + '%';
        dom.timeCurrent.textContent = formatTime(m.position);
        dom.timeTotal.textContent = formatTime(m.duration);
    }

    const lyricsKey = `${m.title}|${m.artist}`;
    if (lyricsKey !== state.lastLyricsQuery && state.lyricsActive) {
        state.lastLyricsQuery = lyricsKey;
        fetchLyrics(m.title, m.artist, m.duration);
    }
    if (state.lyricsActive && state.lyricsData) {
        updateLyricsDisplay(m.position);
    }
}

function updatePlayIcon(playing) {
    dom.playIcon.innerHTML = playing
        ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
        : '<polygon points="5,3 19,12 5,21"/>';
}

// Album art helper — updates both main player and sidebar
let _lastThumbnailUrl = '';
function updateAlbumArt(thumbnail) {
    const albumEl = $('#album-art');
    const gmAlbumEl = $('#gm-sidebar-album');
    if (thumbnail && thumbnail.startsWith('data:') && thumbnail !== _lastThumbnailUrl) {
        _lastThumbnailUrl = thumbnail;
        if (albumEl) albumEl.innerHTML = `<img src="${thumbnail}" alt="Album Art">`;
        if (gmAlbumEl) gmAlbumEl.innerHTML = `<img src="${thumbnail}" alt="Album Art">`;
    } else if (!thumbnail && _lastThumbnailUrl) {
        _lastThumbnailUrl = '';
        const defaultSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
        if (albumEl) albumEl.innerHTML = defaultSvg;
        if (gmAlbumEl) gmAlbumEl.innerHTML = defaultSvg;
    }
}

function setupMediaControls() {
    dom.btnToggle.addEventListener('click', () => window.api.mediaToggle());
    dom.btnPrev.addEventListener('click', () => window.api.mediaPrev());
    dom.btnNext.addEventListener('click', () => window.api.mediaNext());
}

// ── Lyrics ──
async function fetchLyrics(title, artist, duration) {
    dom.lyricsScroll.innerHTML = '<p class="lyrics-placeholder">Şarkı sözleri aranıyor...</p>';
    try {
        const data = await window.api.getLyrics(title, artist, duration);
        if (data && data.syncedLyrics) {
            state.lyricsData = parseLRC(data.syncedLyrics);
            renderLyrics();
        } else if (data && data.plainLyrics) {
            state.lyricsData = null;
            dom.lyricsScroll.innerHTML = data.plainLyrics
                .split('\n')
                .map(l => `<p class="lyrics-line">${escapeHtml(l)}</p>`)
                .join('');
        } else {
            state.lyricsData = null;
            dom.lyricsScroll.innerHTML = '<p class="lyrics-placeholder">Şarkı sözü bulunamadı</p>';
        }
    } catch {
        state.lyricsData = null;
        dom.lyricsScroll.innerHTML = '<p class="lyrics-placeholder">Şarkı sözü yüklenemedi</p>';
    }
}

function parseLRC(lrc) {
    const lines = [];
    for (const line of lrc.split('\n')) {
        const match = line.match(/^\[(\d+):(\d+)\.(\d+)\](.*)/);
        if (match) {
            const time = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 100;
            const text = match[4].trim();
            if (time >= 0) lines.push({ time, text });
        }
    }
    return lines;
}

function renderLyrics() {
    if (!state.lyricsData || state.lyricsData.length === 0) return;
    dom.lyricsScroll.innerHTML = state.lyricsData
        .map((l, i) => `<p class="lyrics-line" data-idx="${i}">${escapeHtml(l.text) || '♪'}</p>`)
        .join('');
}

function updateLyricsDisplay(position) {
    if (!state.lyricsData) return;
    let activeIdx = 0;
    for (let i = 0; i < state.lyricsData.length; i++) {
        if (state.lyricsData[i].time <= position) activeIdx = i;
        else break;
    }
    const lines = dom.lyricsScroll.querySelectorAll('.lyrics-line');
    lines.forEach((el, i) => {
        el.classList.remove('active', 'near');
        if (i === activeIdx) el.classList.add('active');
        else if (Math.abs(i - activeIdx) <= 2) el.classList.add('near');
    });
    const activeLine = lines[activeIdx];
    if (activeLine) {
        const container = dom.lyricsContainer;
        const scrollTop = activeLine.offsetTop - container.clientHeight / 2 + activeLine.clientHeight / 2;
        dom.lyricsScroll.style.transform = `translateY(-${Math.max(0, scrollTop)}px)`;
    }
}

function setupLyricsToggle() {
    dom.lyricsToggle.addEventListener('click', () => {
        state.lyricsActive = !state.lyricsActive;
        dom.lyricsToggle.classList.toggle('active', state.lyricsActive);
        dom.lyricsContainer.classList.toggle('active', state.lyricsActive);

        const svg = dom.lyricsToggle.querySelector('svg');
        if (state.lyricsActive) {
            svg.innerHTML = '<path d="M18 6L6 18M6 6l12 12"/>';
        } else {
            svg.innerHTML = '<path d="M12 3v18M3 12h18"/>';
        }

        if (state.lyricsActive && state.media && state.media.title) {
            const key = `${state.media.title}|${state.media.artist}`;
            if (key !== state.lastLyricsQuery) {
                state.lastLyricsQuery = key;
                fetchLyrics(state.media.title, state.media.artist, state.media.duration);
            }
        }
    });
}

// ── System Controls ──
let volumeDebounce = null;
let brightnessDebounce = null;

function setupSliders() {
    dom.volumeSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        dom.volumeVal.textContent = val;
        if (volumeDebounce) clearTimeout(volumeDebounce);
        volumeDebounce = setTimeout(() => window.api.setVolume(val), 80);
    });

    dom.brightnessSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        dom.brightnessVal.textContent = val;
        if (brightnessDebounce) clearTimeout(brightnessDebounce);
        brightnessDebounce = setTimeout(() => window.api.setBrightness(val), 80);
    });

    [dom.volumeSlider, dom.brightnessSlider, dom.opacitySlider].forEach(setupSliderFill);
    setupLyricsToggle();
}

function setupSliderFill(slider) {
    if (!slider) return;
    const updateFill = () => {
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 100;
        const pct = ((slider.value - min) / (max - min)) * 100;
        slider.style.background = `linear-gradient(to right, var(--accent) ${pct}%, rgba(255,255,255,0.1) ${pct}%)`;
    };
    slider.addEventListener('input', updateFill);
    updateFill();
}

async function loadInitialData() {
    // Parallel fetch for faster startup
    const [volResult, brResult, gmResult] = await Promise.allSettled([
        window.api.getVolume(),
        window.api.getBrightness(),
        window.api.getGameMode()
    ]);

    if (volResult.status === 'fulfilled') {
        state.volume = volResult.value;
        dom.volumeSlider.value = volResult.value;
        dom.volumeVal.textContent = volResult.value;
        setupSliderFill(dom.volumeSlider);
    }

    if (brResult.status === 'fulfilled') {
        const br = brResult.value;
        if (br < 0) {
            state.brightnessSupported = false;
            dom.brightnessRow.style.display = 'none';
        } else {
            state.brightness = br;
            dom.brightnessSlider.value = br;
            dom.brightnessVal.textContent = br;
            setupSliderFill(dom.brightnessSlider);
        }
    } else {
        dom.brightnessRow.style.display = 'none';
    }

    if (gmResult.status === 'fulfilled') {
        state.gameModeActive = gmResult.value;
        updateGameModeUI();
    }
}

// ── Game Mode ──
function updateGameModeUI() {
    const active = state.gameModeActive;
    dom.gamemodeCard.classList.toggle('active', active);
    dom.gamemodeStatus.textContent = active ? 'Aktif' : 'Kapalı';
    dom.gamemodeBtn.textContent = active ? 'Devre Dışı Bırak' : 'Etkinleştir';
    dom.island.classList.toggle('gamemode-active', active);
    const gmBtn = $('#act-gamemode');
    if (gmBtn) gmBtn.classList.toggle('active', active);
}

function handleGameModeSwitch(active) {
    if (active) {
        // Collapse and hide the island
        collapseIsland();
        dom.island.classList.add('gamemode-hidden');
        // Stop position interpolation to save CPU
        if (state.posInterval) { clearInterval(state.posInterval); state.posInterval = null; }
        // Stop idle timer
        if (state.idleTimer) { clearTimeout(state.idleTimer); state.idleTimer = null; }
        if (state.isIdle) exitIdleMode();
        stopMonitorPolling();
        // Clear heavy DOM content to reduce memory
        state.lyricsData = null;
        state.lastLyricsQuery = '';
        dom.lyricsScroll.innerHTML = '';
        dom.weatherBody.innerHTML = '';
        // Track game mode uptime
        state.gameModeStartTime = Date.now();
        // Show sidebar
        showGameModeSidebar();
        // Resize window for sidebar
        window.api.setGameModeWindow(true);
        showToast('Oyun Modu aktif');
    } else {
        // Hide sidebar
        hideGameModeSidebar();
        // Restore window
        window.api.setGameModeWindow(false);
        dom.island.classList.remove('gamemode-hidden');
        // Reset idle state in case it changed during game mode
        if (state.isIdle) exitIdleMode();
        // Clear uptime tracking
        state.gameModeStartTime = null;
        if (state.gameModeUptimeInterval) { clearInterval(state.gameModeUptimeInterval); state.gameModeUptimeInterval = null; }
        // Resume position interpolation if media is playing
        if (state.media && state.media.status === 'Playing' && !state.posInterval) {
            state.posInterval = setInterval(interpolatePosition, 100);
        }
        // Restart idle timer
        startIdleTimer();
        showToast('Oyun Modu kapatıldı');
    }
}

function showGameModeSidebar() {
    const sidebar = $('#gamemode-sidebar');
    if (!sidebar) return;
    state.gameModeOverlayVisible = true;
    updateSidebarContent();
    updateSidebarStats();
    sidebar.classList.add('visible');
    window.api.setMouseIgnore(false);
    // Start periodic refresh
    if (state.gameModeUptimeInterval) clearInterval(state.gameModeUptimeInterval);
    state.gameModeUptimeInterval = setInterval(() => {
        updateSidebarContent();
        updateSidebarStats();
    }, 2000);
    // Fetch latest media info manually (polling is stopped)
    window.api.getMediaInfo().then(info => {
        if (info) handleMediaUpdate(info);
    }).catch(() => {});
    // Setup volume slider sync
    const volSlider = $('#gm-volume-slider');
    if (volSlider) {
        volSlider.value = state.volume;
        $('#gm-volume-val').textContent = state.volume;
    }
}

function hideGameModeSidebar() {
    const sidebar = $('#gamemode-sidebar');
    if (!sidebar) return;
    state.gameModeOverlayVisible = false;
    sidebar.classList.remove('visible');
    window.api.setMouseIgnore(true);
    if (state.gameModeUptimeInterval) { clearInterval(state.gameModeUptimeInterval); state.gameModeUptimeInterval = null; }
}

function setupGameModeSidebar() {
    const sidebar = $('#gamemode-sidebar');
    if (!sidebar) return;

    // Media controls
    const gmToggle = sidebar.querySelector('.gm-s-toggle');
    const gmPrev = sidebar.querySelector('.gm-s-prev');
    const gmNext = sidebar.querySelector('.gm-s-next');
    const gmExit = $('#gm-sidebar-exit');

    if (gmToggle) gmToggle.addEventListener('click', () => window.api.mediaToggle());
    if (gmPrev) gmPrev.addEventListener('click', () => window.api.mediaPrev());
    if (gmNext) gmNext.addEventListener('click', () => window.api.mediaNext());
    if (gmExit) gmExit.addEventListener('click', async () => {
        await window.api.setGameMode(false);
        // Don't call handleGameModeSwitch here — onGameModeUpdated will do it
    });

    // Volume slider
    const volSlider = $('#gm-volume-slider');
    if (volSlider) {
        volSlider.addEventListener('input', async (e) => {
            const val = parseInt(e.target.value);
            state.volume = val;
            $('#gm-volume-val').textContent = val;
            dom.volumeSlider.value = val;
            dom.volumeVal.textContent = val;
            await window.api.setVolume(val);
        });
    }
}

function updateSidebarContent() {
    const sidebar = $('#gamemode-sidebar');
    if (!sidebar) return;

    const titleEl = $('#gm-sidebar-title');
    const artistEl = $('#gm-sidebar-artist');
    const playIcon = sidebar.querySelector('.gm-s-play-icon');
    const uptimeEl = $('#gm-sidebar-uptime');
    const timerSection = $('#gm-sidebar-timer');
    const timerVal = $('#gm-sidebar-timer-val');

    if (state.media && state.media.title && state.media.status !== 'None') {
        if (titleEl) titleEl.textContent = state.media.title;
        if (artistEl) artistEl.textContent = state.media.artist || '';
        const isPlaying = state.media.status === 'Playing';
        if (playIcon) {
            playIcon.innerHTML = isPlaying
                ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
                : '<polygon points="5,3 19,12 5,21"/>';
        }
    } else {
        if (titleEl) titleEl.textContent = 'Müzik çalmıyor';
        if (artistEl) artistEl.textContent = '—';
    }

    if (state.timerRunning && timerSection && timerVal) {
        const mins = Math.floor(state.timerRemaining / 60);
        const secs = state.timerRemaining % 60;
        timerVal.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        timerSection.style.display = '';
    } else if (timerSection) {
        timerSection.style.display = 'none';
    }

    // Update uptime
    if (uptimeEl && state.gameModeStartTime) {
        const elapsed = Math.floor((Date.now() - state.gameModeStartTime) / 1000);
        const h = Math.floor(elapsed / 3600);
        const m = Math.floor((elapsed % 3600) / 60);
        const s = elapsed % 60;
        uptimeEl.textContent = h > 0
            ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
}

function updateSidebarStats() {
    window.api.getSystemInfo().then(info => {
        if (!info) return;
        const sidebar = $('#gamemode-sidebar');
        if (!sidebar) return;

        const cpuVal = sidebar.querySelector('.gm-s-cpu');
        const ramVal = sidebar.querySelector('.gm-s-ram');
        const cpuArc = sidebar.querySelector('.gm-cpu-arc');
        const ramArc = sidebar.querySelector('.gm-ram-arc');
        const gpuVal = sidebar.querySelector('.gm-s-gpu');
        const tempVal = sidebar.querySelector('.gm-s-temp');

        const circumference = 251.33; // 2 * PI * 40

        if (cpuVal) cpuVal.textContent = info.cpu + '%';
        if (ramVal) ramVal.textContent = info.mem + '%';

        if (cpuArc) cpuArc.setAttribute('stroke-dashoffset', circumference - (circumference * info.cpu / 100));
        if (ramArc) ramArc.setAttribute('stroke-dashoffset', circumference - (circumference * info.mem / 100));

        if (gpuVal && info.gpuTemp != null) gpuVal.textContent = info.gpuTemp + '°C';
        if (tempVal && info.cpuTemp != null) tempVal.textContent = info.cpuTemp + '°C';
        else if (tempVal) tempVal.textContent = '—';
    }).catch(() => {});
}

function setupGameMode() {
    dom.gamemodeBtn.addEventListener('click', async () => {
        const newState = !state.gameModeActive;
        await window.api.setGameMode(newState);
        // Don't call handleGameModeSwitch here — onGameModeUpdated will do it
    });
}

// ── Timer ──
function setupTimer() {
    $$('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (state.timerRunning) return;
            $$('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mins = parseInt(btn.dataset.minutes);
            state.timerTotal = mins * 60;
            state.timerRemaining = mins * 60;
            updateTimerDisplay();
        });
    });

    dom.timerStartBtn.addEventListener('click', () => {
        if (state.timerRunning) stopTimer();
        else startTimer();
    });

    updateTimerDisplay();
    setupGameMode();
}

function startTimer() {
    state.timerRunning = true;
    dom.timerStartBtn.textContent = 'Durdur';
    dom.timerStartBtn.classList.add('running');

    state.timerInterval = setInterval(() => {
        state.timerRemaining--;
        if (state.timerRemaining <= 0) {
            stopTimer();
            state.timerRemaining = state.timerTotal;
            new Notification('Dynamic Island', { body: 'Zamanlayıcı tamamlandı! ⏰', silent: false });
        }
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    state.timerRunning = false;
    clearInterval(state.timerInterval);
    dom.timerStartBtn.textContent = 'Başlat';
    dom.timerStartBtn.classList.remove('running');
}

function updateTimerDisplay() {
    const mins = Math.floor(state.timerRemaining / 60);
    const secs = state.timerRemaining % 60;
    dom.timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const circumference = 2 * Math.PI * 52;
    const progress = state.timerTotal > 0 ? state.timerRemaining / state.timerTotal : 1;
    const offset = circumference * (1 - progress);
    dom.timerRingFill.style.strokeDashoffset = offset;
}

// ── Weather ──
async function loadWeather() {
    dom.weatherBody.innerHTML = '<div class="weather-loading">Hava durumu yükleniyor...</div>';
    try {
        if (!state.weatherLocation) {
            state.weatherLocation = await window.api.getLocation();
        }
        if (!state.weatherLocation || !state.weatherLocation.lat) {
            dom.weatherBody.innerHTML = '<div class="weather-loading">Konum belirlenemedi</div>';
            return;
        }
        const data = await window.api.getWeather(state.weatherLocation.lat, state.weatherLocation.lon);
        if (data && data.current) {
            state.weather = data.current;
            renderWeather();
        } else {
            dom.weatherBody.innerHTML = '<div class="weather-loading">Veri alınamadı</div>';
        }
    } catch {
        dom.weatherBody.innerHTML = '<div class="weather-loading">Hava durumu yüklenemedi</div>';
    }
}

function renderWeather() {
    const w = state.weather;
    const loc = state.weatherLocation;
    const icon = getWeatherIcon(w.weather_code);
    const condition = getWeatherCondition(w.weather_code);

    dom.weatherBody.innerHTML = `
        <div class="weather-main">
            <span class="weather-icon">${icon}</span>
            <div>
                <div class="weather-temp">${Math.round(w.temperature_2m)}°</div>
                <div class="weather-condition">${condition}</div>
            </div>
        </div>
        <div class="weather-details">
            <span class="weather-extra">${SVG_ICONS.humidity} Nem: ${w.relative_humidity_2m || '—'}%</span>
            <span class="weather-extra">${SVG_ICONS.wind} Rüzgar: ${w.wind_speed_10m || '—'} km/s</span>
        </div>
        <div class="weather-city">${escapeHtml(loc.city || '')}, ${escapeHtml(loc.country || '')}</div>
        <button class="weather-refresh" id="weather-refresh">${SVG_ICONS.refresh} Yenile</button>
    `;
    const refreshBtn = $('#weather-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            state.weatherLocation = null;
            loadWeather();
        });
    }
}

function getWeatherIcon(code) {
    if (code === 0) return SVG_ICONS.sun;
    if (code <= 3) return SVG_ICONS.partcloud;
    if (code <= 48) return SVG_ICONS.fog;
    if (code <= 55) return SVG_ICONS.drizzle;
    if (code <= 65) return SVG_ICONS.rain;
    if (code <= 77) return SVG_ICONS.snow;
    if (code <= 82) return SVG_ICONS.rain;
    if (code <= 99) return SVG_ICONS.thunder;
    return SVG_ICONS.variable;
}

function getWeatherCondition(code) {
    if (code === 0) return 'Açık';
    if (code <= 3) return 'Parçalı Bulutlu';
    if (code <= 48) return 'Sisli';
    if (code <= 55) return 'Çisenti';
    if (code <= 65) return 'Yağmurlu';
    if (code <= 77) return 'Karlı';
    if (code <= 82) return 'Sağanak';
    if (code <= 99) return 'Gök Gürültülü';
    return 'Değişken';
}

// ── System Monitor ──
function startMonitorPolling() {
    refreshMonitor();
    state.monitorInterval = setInterval(refreshMonitor, 2000);
}

function stopMonitorPolling() {
    if (state.monitorInterval) {
        clearInterval(state.monitorInterval);
        state.monitorInterval = null;
    }
}

async function refreshMonitor() {
    try {
        const info = await window.api.getSystemInfo();
        if (!info) return;
        const cpuCircum = 263.89;
        const cpuOffset = cpuCircum * (1 - info.cpu / 100);
        dom.cpuGauge.style.strokeDashoffset = cpuOffset;
        dom.cpuValue.textContent = info.cpu + '%';

        if (info.cpu > 80) dom.cpuGauge.style.stroke = '#ef4444';
        else if (info.cpu > 50) dom.cpuGauge.style.stroke = '#f59e0b';
        else dom.cpuGauge.style.stroke = 'var(--accent)';

        const ramOffset = cpuCircum * (1 - info.mem / 100);
        dom.ramGauge.style.strokeDashoffset = ramOffset;
        dom.ramValue.textContent = info.mem + '%';
        dom.ramDetail.textContent = `${info.memUsed || '—'} / ${info.memTotal || '—'} GB`;
    } catch {}
}

// ── Notes & Clipboard ──
function setupNotesPanel() {
    // Tab switching
    $$('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            $$('.tab-content').forEach(c => c.classList.remove('active'));
            const tab = $(`#${btn.dataset.tab}`);
            if (tab) tab.classList.add('active');
        });
    });

    // Add note
    const noteInput = $('#note-input');
    const noteAddBtn = $('#note-add-btn');
    if (noteAddBtn) noteAddBtn.addEventListener('click', () => addNote());
    if (noteInput) noteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addNote();
    });
}

async function loadNotesAndClipboard() {
    try { state.notes = await window.api.getNotes() || []; } catch { state.notes = []; }
    renderNotes();
    try { state.clipboardHistory = await window.api.getClipboardHistory() || []; } catch { state.clipboardHistory = []; }
    renderClipboardHistory();
}

function addNote() {
    const input = $('#note-input');
    const text = input.value.trim();
    if (!text) return;
    state.notes.unshift({ text, time: Date.now(), pinned: false });
    if (state.notes.length > 50) state.notes.pop();
    input.value = '';
    renderNotes();
    window.api.saveNotes(state.notes);
}

function renderNotes() {
    const list = $('#notes-list');
    if (!list) return;
    if (state.notes.length === 0) {
        list.innerHTML = '<p class="empty-text">Henüz not eklenmemiş</p>';
        return;
    }
    const sorted = [...state.notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    list.innerHTML = sorted.map((n) => {
        const origIdx = state.notes.indexOf(n);
        return `
        <div class="note-item ${n.pinned ? 'pinned' : ''}" data-idx="${origIdx}">
            <span class="note-text">${escapeHtml(n.text)}</span>
            <div class="note-actions">
                <button class="note-action-btn" data-action="pin" title="${n.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}">${SVG_ICONS.pin}</button>
                <button class="note-action-btn" data-action="edit" title="Düzenle">${SVG_ICONS.edit}</button>
                <button class="note-action-btn" data-action="copy" title="Kopyala">${SVG_ICONS.copy}</button>
                <button class="note-action-btn" data-action="delete" title="Sil">${SVG_ICONS.trash}</button>
            </div>
        </div>`;
    }).join('');
}

function setupNotesEventDelegation() {
    const list = $('#notes-list');
    if (!list) return;
    list.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const item = btn.closest('.note-item');
        if (!item) return;
        const idx = parseInt(item.dataset.idx);
        const action = btn.dataset.action;
        if (action === 'pin') {
            if (state.notes[idx]) { state.notes[idx].pinned = !state.notes[idx].pinned; renderNotes(); window.api.saveNotes(state.notes); }
        } else if (action === 'copy') {
            if (state.notes[idx]) { window.api.copyToClipboard(state.notes[idx].text); showToast('Not panoya kopyalandı'); }
        } else if (action === 'delete') {
            state.notes.splice(idx, 1); renderNotes(); window.api.saveNotes(state.notes);
        } else if (action === 'edit') {
            startNoteEdit(item, idx);
        }
    });
    list.addEventListener('dblclick', (e) => {
        const item = e.target.closest('.note-item');
        if (!item || e.target.closest('[data-action]')) return;
        const idx = parseInt(item.dataset.idx);
        startNoteEdit(item, idx);
    });
}

function startNoteEdit(item, idx) {
    if (!state.notes[idx] || item.querySelector('.note-edit-input')) return;
    const textEl = item.querySelector('.note-text');
    const original = state.notes[idx].text;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'note-edit-input';
    input.value = original;
    textEl.replaceWith(input);
    input.focus();
    input.select();
    const save = () => {
        const val = input.value.trim();
        if (val && val !== original) {
            state.notes[idx].text = val;
            window.api.saveNotes(state.notes);
        }
        renderNotes();
    };
    input.addEventListener('blur', save, { once: true });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = original; input.blur(); }
    });
}

function renderClipboardHistory() {
    const list = $('#clipboard-list');
    if (!list) return;
    if (state.clipboardHistory.length === 0) {
        list.innerHTML = '<p class="empty-text">Pano geçmişi boş</p>';
        return;
    }
    list.innerHTML = state.clipboardHistory.map((item, i) => `
        <div class="clipboard-item" data-clip-idx="${i}">
            <span class="clipboard-text">${escapeHtml(item.text.substring(0, 100))}${item.text.length > 100 ? '...' : ''}</span>
            <div class="clipboard-meta">
                <span class="clipboard-time">${formatRelativeTime(item.time)}</span>
                <button class="clip-copy-btn" data-clip-copy="${i}" title="Kopyala">${SVG_ICONS.copy}</button>
            </div>
        </div>
    `).join('');
}

function setupClipboardEventDelegation() {
    const list = $('#clipboard-list');
    if (!list) return;
    list.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('[data-clip-copy]');
        const item = e.target.closest('.clipboard-item');
        if (!item) return;
        const idx = parseInt(copyBtn ? copyBtn.dataset.clipCopy : item.dataset.clipIdx);
        const clip = state.clipboardHistory[idx];
        if (clip) {
            window.api.copyToClipboard(clip.text);
            showToast('Panoya kopyalandı');
        }
    });
}

function formatRelativeTime(timestamp) {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Az önce';
    if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
    return new Date(timestamp).toLocaleDateString('tr-TR');
}

// ── Screenshot ──
function setupScreenshotButton() {
    // Screenshot in more menu
    const btn = $('#more-screenshot');
    if (btn) {
        btn.addEventListener('click', async () => {
            closeMoreMenu();
            showToast('Ekran görüntüsü alınıyor...');
            const result = await window.api.takeScreenshot();
            if (result.success) {
                showToast(`Kaydedildi: ${result.filename}`);
            } else {
                showToast('Ekran görüntüsü alınamadı');
            }
        });
    }
}

// ── More Menu ──
function setupMoreMenu() {
    const moreBtn = $('#act-more');
    const moreMenu = $('#more-menu');
    if (!moreBtn || !moreMenu) return;

    moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moreMenu.classList.toggle('open');
    });

    // Timer in more menu
    const timerItem = $('#more-timer');
    if (timerItem) {
        timerItem.addEventListener('click', () => {
            closeMoreMenu();
            openPanel('timer');
        });
    }

    // Close more menu on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-more-wrapper')) {
            closeMoreMenu();
        }
    });
}

function closeMoreMenu() {
    const m = $('#more-menu');
    if (m) m.classList.remove('open');
}

// ── Settings ──
async function loadSettingsPanel() {
    // Theme presets
    try {
        state.themePresets = await window.api.getThemePresets() || [];
        renderThemePresets();
    } catch {}

    // Multi-monitor
    try {
        const displays = await window.api.getDisplays();
        const select = $('#display-select');
        if (select && displays) {
            select.innerHTML = displays.map(d =>
                `<option value="${d.id}" ${d.primary ? 'selected' : ''}>${d.label}</option>`
            ).join('');
            select.addEventListener('change', () => {
                window.api.moveToDisplay(parseInt(select.value));
            });
        }
    } catch {}

    // Position
    $$('.pos-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.pos === (state.settings.position || 'center'));
    });
}

function renderThemePresets() {
    const container = $('#theme-options');
    if (!container || !state.themePresets.length) return;
    container.innerHTML = state.themePresets.map(t => `
        <button class="theme-btn ${state.settings.theme === t.id ? 'active' : ''}" data-theme="${t.id}">
            <span class="theme-preview" style="background:${t.bg}; color:${t.text}; border: 1px solid ${t.border}">A</span>
            <span class="theme-name">${t.name}</span>
        </button>
    `).join('');

    $$('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const themeId = btn.dataset.theme;
            const theme = state.themePresets.find(t => t.id === themeId);
            if (!theme) return;
            applyTheme(theme);
            $$('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.settings.theme = themeId;
            window.api.setSetting('theme', themeId);
        });
    });
}

function applyTheme(theme) {
    const root = document.documentElement.style;
    root.setProperty('--bg', theme.bg);
    root.setProperty('--text', theme.text);
    root.setProperty('--text-dim', theme.textDim);
    root.setProperty('--border', theme.border);
    if (theme.accent) {
        root.setProperty('--accent', theme.accent);
        root.setProperty('--accent-glow', theme.accent + '59');
        [dom.volumeSlider, dom.brightnessSlider, dom.opacitySlider].forEach(setupSliderFill);
    }
}

async function loadSettings() {
    try {
        const s = await window.api.getSettings();
        if (s) {
            state.settings = s;
            applySettings(s);
        }
    } catch {}
}

function applySettings(s) {
    if (s.accentColor) {
        document.documentElement.style.setProperty('--accent', s.accentColor);
        document.documentElement.style.setProperty('--accent-glow', s.accentColor + '59');
        $$('.color-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.color === s.accentColor);
        });
    }
    if (s.opacity != null) {
        const opVal = typeof s.opacity === 'number' && s.opacity <= 1 ? s.opacity * 100 : s.opacity;
        document.documentElement.style.setProperty('--bg', `rgba(15, 15, 15, ${opVal / 100})`);
        dom.opacitySlider.value = opVal;
        setupSliderFill(dom.opacitySlider);
    }
    if (s.showLyrics != null) {
        dom.lyricsSetting.checked = s.showLyrics;
    }
    // Idle timeout
    const idleSlider = $('#idle-timeout-slider');
    const idleVal = $('#idle-timeout-val');
    if (idleSlider && s.idleTimeout != null) {
        idleSlider.value = s.idleTimeout;
        if (idleVal) idleVal.textContent = s.idleTimeout + 'sn';
        state.idleTimeout = s.idleTimeout * 1000;
    }
    // Apply saved theme
    if (s.theme && state.themePresets.length > 0) {
        const theme = state.themePresets.find(t => t.id === s.theme);
        if (theme) applyTheme(theme);
    }
    // Auto-start checkbox
    const autoStartCb = $('#autostart-setting');
    if (autoStartCb) autoStartCb.checked = !!s.autoStart;
    // Position
    $$('.pos-btn').forEach(b => b.classList.toggle('active', b.dataset.pos === (s.position || 'center')));
}

function setupSettings() {
    // Color options
    $$('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const color = btn.dataset.color;
            document.documentElement.style.setProperty('--accent', color);
            document.documentElement.style.setProperty('--accent-glow', color + '59');
            window.api.setSetting('accentColor', color);
            [dom.volumeSlider, dom.brightnessSlider, dom.opacitySlider].forEach(setupSliderFill);
        });
    });

    // Opacity
    dom.opacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.documentElement.style.setProperty('--bg', `rgba(15, 15, 15, ${val / 100})`);
        window.api.setSetting('opacity', val);
    });

    // Lyrics toggle
    dom.lyricsSetting.addEventListener('change', () => {
        window.api.setSetting('showLyrics', dom.lyricsSetting.checked);
    });

    // Auto-start
    const autoStartCb = $('#autostart-setting');
    if (autoStartCb) {
        autoStartCb.addEventListener('change', () => {
            window.api.setSetting('autoStart', autoStartCb.checked);
        });
    }

    // Position
    $$('.pos-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.pos-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            window.api.setSetting('position', btn.dataset.pos);
        });
    });

    // Idle timeout
    const idleSlider = $('#idle-timeout-slider');
    if (idleSlider) {
        idleSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            const label = $('#idle-timeout-val');
            if (label) label.textContent = val + 'sn';
            state.idleTimeout = val * 1000;
            window.api.setSetting('idleTimeout', val);
        });
    }

    // Reset
    $('#reset-settings').addEventListener('click', async () => {
        const s = await window.api.resetSettings();
        if (s) applySettings(s);
        showToast('Ayarlar sıfırlandı');
    });
}

// ── StudyLogger Subject Topics ──
const SUBJECT_TOPICS = {
    turkce: ['Sözcükte Anlam','Cümlede Anlam','Paragrafta Anlam','Ses Bilgisi','Yazım Kuralları','Noktalama İşaretleri','Sözcük Türleri','Fiiller','Fiilimsiler','Sözcükte Yapı ve Ekler','Cümlenin Ögeleri','Cümle Türleri','Anlatım Bozuklukları'],
    matematik: ['Temel Kavramlar','Sayı Basamakları','Bölme ve Bölünebilme Kuralları','EBOB-EKOK','Rasyonel Sayılar','Basit Eşitsizlikler','Mutlak Değer','Üslü Sayılar','Köklü Sayılar','Çarpanlara Ayırma','Oran ve Orantı','Denklem Çözme','Problemler','Kümeler','Kartezyen Çarpım','Mantık','Fonksiyonlar','Polinomlar','İkinci Dereceden Denklemler','Permütasyon-Kombinasyon-Olasılık','Veri ve İstatistik'],
    geometri: ['Doğruda Açılar','Üçgende Açılar','Dik ve Özel Üçgenler','Dik Üçgende Trigonometrik Bağıntılar','İkizkenar ve Eşkenar Üçgen','Üçgende Açıortay ve Kenarortay','Üçgende Eşlik ve Benzerlik','Üçgende Alan','Üçgende Açı-Kenar Bağıntıları','Çokgenler','Dörtgenler ve Özel Dörtgenler','Çemberde Açı ve Uzunluk','Dairede Çevre ve Alan','Katı Cisimler','Analitik Geometri'],
    fizik: ['Fizik Bilimine Giriş','Madde ve Özellikleri','Hareket ve Kuvvet','İş-Güç-Enerji','Isı-Sıcaklık-Genleşme','Elektrostatik','Elektrik Akımı ve Devreler','Manyetizma','Basınç','Kaldırma Kuvveti','Dalgalar','Optik'],
    kimya: ['Kimya Bilimi','Atom ve Periyodik Sistem','Kimyasal Türler Arası Etkileşimler','Maddenin Halleri','Doğa ve Kimya','Kimyanın Temel Kanunları ve Kimyasal Hesaplamalar','Karışımlar','Asitler-Bazlar-Tuzlar','Kimya Her Yerde'],
    biyoloji: ['Yaşam Bilimi Biyoloji','Hücre ve Organelleri','Canlıların Dünyası','Hücre Bölünmeleri','Kalıtımın Genel İlkeleri','Ekosistem Ekolojisi ve Güncel Çevre Sorunları'],
    tarih: ['Tarih ve Zaman','İnsanlığın İlk Dönemleri',"Orta Çağ'da Dünya",'İlk ve Orta Çağlarda Türk Dünyası','İslam Medeniyetinin Doğuşu',"Türklerin İslamiyet'i Kabulü ve İlk Türk İslam Devletleri",'Yerleşme ve Devletleşme Sürecinde Selçuklu Türkiyesi','Beylikten Devlete Osmanlı Siyaseti ve Medeniyeti','Dünya Gücü Osmanlı','Değişim Çağında Avrupa ve Osmanlı','Uluslararası İlişkilerde Denge Stratejisi','XX. Yüzyıl Başlarında Osmanlı Devleti ve Dünya','Millî Mücadele','Atatürkçülük ve Türk İnkılabı'],
    cografya: ['Doğa ve İnsan',"Dünya'nın Şekli ve Hareketleri",'Coğrafi Konum','Harita Bilgisi','İklim Bilgisi',"Dünya'nın Tektonik Oluşumu",'İç ve Dış Kuvvetler','Su-Toprak-Bitki Varlığı','Nüfus-Göç-Yerleşme',"Türkiye'nin Nüfusu ve Yerleşmesi",'Ekonomik Faaliyetler','Bölgeler ve Ülkeler','Doğal Afetler'],
    felsefe: ['Felsefeyi Tanıma','Felsefeyle Düşünme','Varlık Felsefesi','Bilgi Felsefesi','Bilim Felsefesi','Ahlak Felsefesi','Din Felsefesi','Siyaset Felsefesi','Sanat Felsefesi','Felsefe Tarihi'],
    din: ['İnanç','İbadet','Ahlak ve Değerler','Din-Kültür ve Medeniyet','Hz. Muhammed','Vahiy ve Akıl','İslam Düşüncesinde Yorumlar'],
    ayt_matematik: ['Fonksiyonlarda Uygulamalar','İkinci Dereceden Fonksiyonlar ve Grafikleri','İkinci Dereceden İki Bilinmeyenli Denklem Sistemleri','İkinci Dereceden Eşitsizlikler ve Eşitsizlik Sistemleri','Karmaşık Sayılar','Logaritma','Diziler','Trigonometri','Limit ve Süreklilik','Türev','İntegral','Permütasyon-Kombinasyon-Binom-Olasılık'],
    ayt_geometri: ['Üçgenler (İleri Düzey)','Çokgenler ve Dörtgenler','Katı Cisimler','Çember ve Daire (İleri Düzey)','Doğrunun Analitik İncelenmesi','Çemberin Analitik İncelenmesi','Dönüşüm Geometrisi'],
    ayt_fizik: ['Vektörler','Bağıl Hareket',"Newton'un Hareket Yasaları",'Bir Boyutta Sabit İvmeli Hareket (Atışlar)','İki Boyutta Hareket','Enerji ve Hareket','İtme ve Çizgisel Momentum','Tork, Denge ve Kütle Merkezi','Basit Makineler','Elektriksel Kuvvet ve Elektrik Alan','Elektriksel Potansiyel','Düzgün Elektrik Alan ve Sığa','Manyetizma ve Elektromanyetik İndüklenme','Alternatif Akım','Transformatörler','Çembersel Hareket','Dönerek Öteleme Hareketi ve Açısal Momentum','Kütle Çekim Kuvveti ve Kepler Yasaları','Basit Harmonik Hareket','Dalga Mekaniği','Atom Fiziğine Giriş ve Radyoaktivite','Modern Fizik',"Modern Fiziğin Teknolojideki Uygulamaları"],
    ayt_kimya: ['Modern Atom Teorisi','Gazlar','Sıvı Çözeltiler ve Çözünürlük','Kimyasal Tepkimelerde Enerji','Kimyasal Tepkimelerde Hız','Kimyasal Tepkimelerde Denge','Asit-Baz Dengesi','Çözünürlük Dengesi','Kimya ve Elektrik','Karbon Kimyasına Giriş','Organik Kimya','Enerji Kaynakları ve Bilimsel Gelişmeler'],
    ayt_biyoloji: ['Sinir Sistemi','Endokrin Sistem','Duyu Organları','Destek ve Hareket Sistemi','Sindirim Sistemi','Dolaşım ve Lenf Sistemi','Bağışıklık Sistemi','Solunum Sistemi','Üriner Sistem','Üreme Sistemi ve Embriyonik Gelişim','Komünite ve Popülasyon Ekolojisi','Genden Proteine','Canlılarda Enerji Dönüşümleri','Bitki Biyolojisi','Canlılar ve Çevre'],
    diger: [],
};

function populateTopicDropdown(subjectId) {
    const topicSel = $('#sl-topic');
    if (!topicSel) return;
    const topics = SUBJECT_TOPICS[subjectId] || [];
    if (topics.length === 0) {
        topicSel.innerHTML = '<option value="">— Konu seçin —</option>';
    } else {
        topicSel.innerHTML = topics.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    }
}

// ── StudyLogger ──
function setupStudyLogger() {
    // StudyLogger web shortcut button
    const webBtn = $('#act-studylogger-web');
    if (webBtn) {
        webBtn.addEventListener('click', () => {
            window.api.openUrl('https://studyloggeryks.vercel.app/');
        });
    }

    // Populate topic dropdown when subject changes
    const subjectSel = $('#sl-subject');
    if (subjectSel) {
        subjectSel.addEventListener('change', () => populateTopicDropdown(subjectSel.value));
        populateTopicDropdown(subjectSel.value); // initial population
    }

    // Tab switching
    $$('[data-sl-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.slTab;
            $$('[data-sl-tab]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            $$('#panel-studylogger .tab-content').forEach(t => t.classList.remove('active'));
            const tab = $(`#${tabId}`);
            if (tab) tab.classList.add('active');
        });
    });

    // Connect button
    const connectBtn = $('#sl-connect-btn');
    if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
            const tokenInput = $('#sl-token-input');
            const token = tokenInput ? tokenInput.value.trim() : '';
            if (!token) { showToast('Token boş olamaz'); return; }
            connectBtn.disabled = true;
            connectBtn.textContent = 'Bağlanıyor...';
            try {
                const result = await window.api.studyLogger.signIn(token);
                if (result.ok) {
                    state.studyLogger.uid = result.uid;
                    state.studyLogger.connected = true;
                    updateStudyLoggerStatus(true);
                    if (tokenInput) tokenInput.value = '';
                    showToast('StudyLogger bağlantısı kuruldu');
                    // Switch to log tab
                    $$('[data-sl-tab]').forEach(b => b.classList.remove('active'));
                    const logTabBtn = $('[data-sl-tab="sl-log-tab"]');
                    if (logTabBtn) logTabBtn.classList.add('active');
                    $$('#panel-studylogger .tab-content').forEach(t => t.classList.remove('active'));
                    const logTab = $('#sl-log-tab');
                    if (logTab) logTab.classList.add('active');
                } else if (result.error === 'expired') {
                    showToast('Token geçersiz veya süresi dolmuş. Yeni token oluşturun.');
                } else {
                    showToast('Bağlantı hatası: ' + (result.error || 'Bilinmeyen hata'));
                }
            } catch (e) {
                showToast('Bağlantı kurulamadı');
            } finally {
                connectBtn.disabled = false;
                connectBtn.textContent = 'Bağlan';
            }
        });
    }

    // Disconnect button
    const disconnectBtn = $('#sl-disconnect-btn');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', async () => {
            await window.api.studyLogger.clearToken();
            state.studyLogger.uid = null;
            state.studyLogger.connected = false;
            updateStudyLoggerStatus(false);
            showToast('Bağlantı kesildi');
        });
    }

    // Submit log form
    const submitBtn = $('#sl-submit');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            if (!state.studyLogger.connected || !state.studyLogger.uid) {
                showToast('Önce StudyLogger\'a bağlanın (Bağlan sekmesi)');
                return;
            }
            const subject = $('#sl-subject') ? $('#sl-subject').value : '';
            const topic = $('#sl-topic') ? $('#sl-topic').value.trim() : '';
            const durationRaw = $('#sl-duration') ? parseInt($('#sl-duration').value) : 0;
            const questionsRaw = $('#sl-questions') ? parseInt($('#sl-questions').value) : 0;

            if (!topic) { showToast('Konu boş olamaz'); return; }
            if (!durationRaw || durationRaw < 1) { showToast('Geçerli bir süre girin'); return; }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Kaydediliyor...';
            try {
                const result = await window.api.studyLogger.logSession({
                    uid: state.studyLogger.uid,
                    subject,
                    topic,
                    durationMinutes: durationRaw,
                    questionCount: isNaN(questionsRaw) ? 0 : questionsRaw,
                });
                if (result.ok) {
                    showToast('Çalışma kaydedildi!');
                    // Reset duration/questions; keep subject+topic for quick re-entry
                    if ($('#sl-duration')) $('#sl-duration').value = '';
                    if ($('#sl-questions')) $('#sl-questions').value = '';
                } else if (result.error === 'expired') {
                    state.studyLogger.connected = false;
                    updateStudyLoggerStatus(false);
                    showToast('Bağlantı süresi doldu. Ayarlar → StudyLogger\'dan yeni token al.');
                } else if (result.error === 'no_token') {
                    showToast('Önce StudyLogger\'a bağlanın (Bağlan sekmesi)');
                } else {
                    showToast('Kayıt hatası: ' + (result.error || 'Bilinmeyen hata'));
                }
            } catch (e) {
                showToast('Kayıt gönderilemedi');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Kaydet';
            }
        });
    }
}

function updateStudyLoggerStatus(connected) {
    const bar = $('#sl-status-bar');
    const text = $('#sl-status-text');
    const connectBtn = $('#sl-connect-btn');
    const disconnectBtn = $('#sl-disconnect-btn');
    if (bar) bar.classList.toggle('sl-connected', connected);
    if (text) text.textContent = connected ? 'Bağlı' : 'Bağlantı yok';
    if (connectBtn) connectBtn.style.display = connected ? 'none' : '';
    if (disconnectBtn) disconnectBtn.style.display = connected ? '' : 'none';
}

async function loadStudyLoggerPanel() {
    try {
        const config = await window.api.studyLogger.getConfig();
        if (config && config.firebaseUid) {
            state.studyLogger.uid = config.firebaseUid;
            state.studyLogger.connected = true;
        }
    } catch {}
    updateStudyLoggerStatus(state.studyLogger.connected);
}

// ── Utilities ──
function formatTime(seconds) {
    if (!seconds || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

const _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const _escapeRe = /[&<>"']/g;
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(_escapeRe, c => _escapeMap[c]);
}

// ── Start ──
document.addEventListener('DOMContentLoaded', init);
