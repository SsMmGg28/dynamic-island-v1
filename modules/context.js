// Shared mutable state for main-process modules.
// All modules import this singleton and read/write it directly.
module.exports = {
    mainWindow: null,
    tray: null,
    store: null,
    gameModeActive: false,
    mediaBridge: null,
    mediaBridgeReady: false,
    mediaBridgeCallbacks: [],
    mediaBridgeCrashCount: 0,
    mediaPollingInterval: null,
    clipboardInterval: null,
    lastClipboardText: '',
    clipboardHistory: [],
    cachedInstalledApps: null,
    installedAppsLoading: false,
    // Notification bridge
    notifBridge: null,
    notifBridgeCrashCount: 0,
    notifBridgeDisabled: false,
    notificationHistory: [],
    // Notification WebSocket
    notifSocketPort: null,
    notifSocketIP: null,
    notifSocketClients: 0,
    _fbAuth: null,
    _fbDb: null,
    _fbHelpers: null,
};
