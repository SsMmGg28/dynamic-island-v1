/* ── media.js ── Media player state updates and controls ── */

function handleMediaUpdate(info) {
    if (!info) return;
    if (state.media && info.title === state.media.title && info.duration === state.media.duration && info.status === 'Playing') {
        const diff = Math.abs(state.interpolatedPos - (info.position || 0));
        if (diff < 3) info = { ...info, position: state.interpolatedPos };
    }
    state.media = info;
    state.interpolatedPos = info.position || 0;
    state.lastMediaTime = Date.now();

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
    if (state.expanded && state.media.duration > 0) {
        const pct = (state.interpolatedPos / state.media.duration) * 100;
        dom.progressFill.style.width = pct + '%';
        dom.progressThumb.style.left = pct + '%';
        dom.timeCurrent.textContent = formatTime(state.interpolatedPos);
    }
    if (state.lyricsActive && state.lyricsData) updateLyricsDisplay(state.interpolatedPos);
}

function updateMediaUI() {
    const m = state.media;
    const timerActive = state.slTimer.status !== 'idle';

    if (!m || !m.title || m.status === 'None') {
        dom.statusDot.classList.remove('active');
        dom.mediaMini.classList.remove('active');
        dom.pulseRing.classList.remove('active');
        if (!timerActive) dom.clock.classList.remove('hidden');
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
    if (!timerActive) {
        dom.clock.classList.add('hidden');
        dom.mediaMini.classList.add('active');
    } else {
        dom.mediaMini.classList.remove('active');
    }
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
    if (state.lyricsActive && state.lyricsData) updateLyricsDisplay(m.position);
}

function updatePlayIcon(playing) {
    dom.playIcon.innerHTML = playing
        ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
        : '<polygon points="5,3 19,12 5,21"/>';
}

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
