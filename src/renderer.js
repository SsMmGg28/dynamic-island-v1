/* ── renderer.js ── Entry point: calls all module setup functions ── */

async function init() {
    // Force initial paint of collapsed state
    dom.island.classList.add('collapsed');
    dom.island.offsetHeight; // Force reflow

    updateClock();
    setInterval(updateClock, 30000);
    setupClickThrough();
    setupIslandEvents();
    setupDragEvents();
    setupMediaControls();
    setupSliders();
    setupActions();
    setupTimer();
    setupSettings();
    setupNotesPanel();
    setupScreenshotButton();
    setupMoreMenu();
    setupStudyLogger();

    // Load theme presets BEFORE settings so saved theme can be applied
    try {
        state.themePresets = await window.api.getThemePresets() || [];
    } catch {}
    await loadSettings();
    await loadInitialData();

    // Auto-connect StudyLogger if a config was saved from a previous session
    try {
        const slCfg = await window.api.studyLogger.getApiConfig();
        const fbCfg = await window.api.studyLogger.getConfig();
        if (slCfg && slCfg.baseUrl && fbCfg && fbCfg.customToken) {
            state.slApi.connected = true;
            startSlPolling();
            slFetchStats();
        }
    } catch {}

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
            const sidebar = $('#gamemode-sidebar');
            if (sidebar && sidebar.classList.contains('visible')) hideGameModeSidebar();
            else showGameModeSidebar();
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

document.addEventListener('DOMContentLoaded', init);
