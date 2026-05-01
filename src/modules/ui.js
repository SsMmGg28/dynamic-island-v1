/* ── ui.js ── Island expand/collapse, drag, click-through, panel navigation ── */

// ── Click-Through ──
function setupClickThrough() {
    dom.island.addEventListener('mouseenter', () => window.api.setMouseIgnore(false));
    dom.island.addEventListener('mouseleave', () => {
        if (!state.gameModeActive) window.api.setMouseIgnore(true);
    });
    const sidebar = $('#gamemode-sidebar');
    if (sidebar) {
        sidebar.addEventListener('mouseenter', () => window.api.setMouseIgnore(false));
        sidebar.addEventListener('mouseleave', () => window.api.setMouseIgnore(true));
    }
}

// ── Clock ──
function updateClock() {
    const now = new Date();
    dom.clock.textContent = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

// ── Island Expand / Collapse with Idle Tracking ──
function setupIslandEvents() {
    dom.island.addEventListener('mouseenter', () => {
        if (state.isDragging) return;
        if (collapseTimeout) { clearTimeout(collapseTimeout); collapseTimeout = null; }
        exitIdleMode();
        expandIsland();
    });
    dom.island.addEventListener('mouseleave', () => {
        if (state.locked || state.isDragging) return;
        collapseTimeout = setTimeout(collapseIsland, 400);
        startIdleTimer();
    });
}

function startIdleTimer() {
    if (state.idleTimer) clearTimeout(state.idleTimer);
    if (state.gameModeActive) return;
    state.idleTimer = setTimeout(() => {
        if (!state.expanded && !state.locked && !state.gameModeActive) enterIdleMode();
    }, state.idleTimeout);
}

function enterIdleMode() {
    if (state.isIdle) return;
    state.isIdle = true;
    const hasActiveMedia = state.media && state.media.title && state.media.status === 'Playing';
    dom.island.classList.add('idle-notch');
    dom.island.classList.toggle('idle-clock-only', !hasActiveMedia);
    if (state.posInterval) { clearInterval(state.posInterval); state.posInterval = null; }
}

function exitIdleMode() {
    if (!state.isIdle) return;
    state.isIdle = false;
    if (state.idleTimer) { clearTimeout(state.idleTimer); state.idleTimer = null; }
    dom.island.classList.remove('idle-notch', 'idle-clock-only');
    if (state.media && state.media.status === 'Playing' && !state.posInterval) {
        state.posInterval = setInterval(interpolatePosition, 100);
    }
}

function expandIsland() {
    if (state.expanded) return;
    state.expanded = true;
    dom.island.classList.remove('collapsed');
    dom.island.classList.add('expanded');
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
            if (!state.isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) state.isDragging = true;
            if (state.isDragging) window.api.setWindowPosition(winX + dx, winY + dy);
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (state.isDragging) setTimeout(() => { state.isDragging = false; }, 100);
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
    if (panelId === 'weather')      loadWeather();
    if (panelId === 'monitor')      startMonitorPolling();
    if (panelId === 'notes')        loadNotesAndClipboard();
    if (panelId === 'settings')     loadSettingsPanel();
    if (panelId === 'studylogger')  loadStudyLoggerPanel();
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
