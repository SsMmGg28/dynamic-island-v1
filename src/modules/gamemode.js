/* ── gamemode.js ── Game mode toggle and sidebar management ── */

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
        collapseIsland();
        dom.island.classList.add('gamemode-hidden');
        if (state.posInterval) { clearInterval(state.posInterval); state.posInterval = null; }
        if (state.idleTimer) { clearTimeout(state.idleTimer); state.idleTimer = null; }
        if (state.isIdle) exitIdleMode();
        stopMonitorPolling();
        state.lyricsData = null;
        state.lastLyricsQuery = '';
        dom.lyricsScroll.innerHTML = '';
        dom.weatherBody.innerHTML = '';
        state.gameModeStartTime = Date.now();
        showGameModeSidebar();
        window.api.setGameModeWindow(true);
        showToast('Oyun Modu aktif');
    } else {
        hideGameModeSidebar();
        window.api.setGameModeWindow(false);
        dom.island.classList.remove('gamemode-hidden');
        if (state.isIdle) exitIdleMode();
        state.gameModeStartTime = null;
        if (state.gameModeUptimeInterval) { clearInterval(state.gameModeUptimeInterval); state.gameModeUptimeInterval = null; }
        if (state.media && state.media.status === 'Playing' && !state.posInterval) {
            state.posInterval = setInterval(interpolatePosition, 100);
        }
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
    if (state.gameModeUptimeInterval) clearInterval(state.gameModeUptimeInterval);
    state.gameModeUptimeInterval = setInterval(() => {
        updateSidebarContent();
        updateSidebarStats();
    }, 2000);
    window.api.getMediaInfo().then(info => {
        if (info) handleMediaUpdate(info);
    }).catch(() => {});
    const volSlider = $('#gm-volume-slider');
    if (volSlider) {
        volSlider.value = state.volume;
        const volVal = $('#gm-volume-val');
        if (volVal) volVal.textContent = state.volume;
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
        const circumference = 251.33;
        if (cpuVal) cpuVal.textContent = info.cpu + '%';
        if (ramVal) ramVal.textContent = info.mem + '%';
        if (cpuArc) cpuArc.setAttribute('stroke-dashoffset', circumference - (circumference * info.cpu / 100));
        if (ramArc) ramArc.setAttribute('stroke-dashoffset', circumference - (circumference * info.mem / 100));
        if (gpuVal && info.gpuTemp != null) gpuVal.textContent = info.gpuTemp + '°C';
        if (tempVal) tempVal.textContent = info.cpuTemp != null ? info.cpuTemp + '°C' : '—';
    }).catch(() => {});
}

function setupGameModeSidebar() {
    const sidebar = $('#gamemode-sidebar');
    if (!sidebar) return;
    const gmToggle = sidebar.querySelector('.gm-s-toggle');
    const gmPrev = sidebar.querySelector('.gm-s-prev');
    const gmNext = sidebar.querySelector('.gm-s-next');
    const gmExit = $('#gm-sidebar-exit');
    if (gmToggle) gmToggle.addEventListener('click', () => window.api.mediaToggle());
    if (gmPrev) gmPrev.addEventListener('click', () => window.api.mediaPrev());
    if (gmNext) gmNext.addEventListener('click', () => window.api.mediaNext());
    if (gmExit) gmExit.addEventListener('click', async () => { await window.api.setGameMode(false); });
    const volSlider = $('#gm-volume-slider');
    if (volSlider) {
        volSlider.addEventListener('input', async (e) => {
            const val = parseInt(e.target.value);
            state.volume = val;
            const volVal = $('#gm-volume-val');
            if (volVal) volVal.textContent = val;
            dom.volumeSlider.value = val;
            dom.volumeVal.textContent = val;
            await window.api.setVolume(val);
        });
    }
}

function setupGameMode() {
    dom.gamemodeBtn.addEventListener('click', async () => {
        const newState = !state.gameModeActive;
        await window.api.setGameMode(newState);
    });
}
