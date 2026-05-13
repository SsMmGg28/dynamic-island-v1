/* ── controls.js ── Volume/brightness sliders and system info initial load ── */

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
    const [volResult, brResult, gmResult] = await Promise.allSettled([
        window.api.getVolume(),
        window.api.getBrightness(),
        window.api.getGameMode(),
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

// ── System Monitor (CPU / RAM polling) ──
function startMonitorPolling() {
    refreshMonitor();
    state.monitorInterval = setInterval(refreshMonitor, 10000);
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
