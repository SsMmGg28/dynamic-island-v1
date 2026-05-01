/* ── settings.js ── Theme presets, settings load/apply, screenshot, more menu ── */

async function loadSettingsPanel() {
    try {
        state.themePresets = await window.api.getThemePresets() || [];
        renderThemePresets();
    } catch {}

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
    const idleSlider = $('#idle-timeout-slider');
    const idleVal = $('#idle-timeout-val');
    if (idleSlider && s.idleTimeout != null) {
        idleSlider.value = s.idleTimeout;
        if (idleVal) idleVal.textContent = s.idleTimeout + 'sn';
        state.idleTimeout = s.idleTimeout * 1000;
    }
    if (s.theme && state.themePresets.length > 0) {
        const theme = state.themePresets.find(t => t.id === s.theme);
        if (theme) applyTheme(theme);
    }
    const autoStartCb = $('#autostart-setting');
    if (autoStartCb) autoStartCb.checked = !!s.autoStart;
    $$('.pos-btn').forEach(b => b.classList.toggle('active', b.dataset.pos === (s.position || 'center')));
}

function setupSettings() {
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

    dom.opacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.documentElement.style.setProperty('--bg', `rgba(15, 15, 15, ${val / 100})`);
        window.api.setSetting('opacity', val);
    });

    dom.lyricsSetting.addEventListener('change', () => {
        window.api.setSetting('showLyrics', dom.lyricsSetting.checked);
    });

    const autoStartCb = $('#autostart-setting');
    if (autoStartCb) {
        autoStartCb.addEventListener('change', () => {
            window.api.setSetting('autoStart', autoStartCb.checked);
        });
    }

    $$('.pos-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.pos-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            window.api.setSetting('position', btn.dataset.pos);
        });
    });

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

    $('#reset-settings').addEventListener('click', async () => {
        const s = await window.api.resetSettings();
        if (s) applySettings(s);
        showToast('Ayarlar sıfırlandı');
    });
}

// ── Screenshot ──
function setupScreenshotButton() {
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

    const timerItem = $('#more-timer');
    if (timerItem) {
        timerItem.addEventListener('click', () => {
            closeMoreMenu();
            openPanel('timer');
        });
    }

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
