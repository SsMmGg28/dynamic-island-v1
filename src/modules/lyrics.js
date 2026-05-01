/* ── lyrics.js ── Lyrics fetch, parse, render, and scroll ── */

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
