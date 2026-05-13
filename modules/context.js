// Shared mutable state for main-process modules.
// All modules import this singleton and read/write it directly.

/**
 * @typedef {Object} AppContext
 * @property {import('electron').BrowserWindow | null} mainWindow
 * @property {import('electron').Tray | null} tray
 * @property {import('electron-store') | {get: Function, set: Function} | null} store
 * @property {boolean} gameModeActive
 * @property {import('child_process').ChildProcess | null} mediaBridge
 * @property {boolean} mediaBridgeReady
 * @property {Array<{resolve: Function}>} mediaBridgeCallbacks
 * @property {number} mediaBridgeCrashCount
 * @property {ReturnType<typeof setInterval> | null} mediaPollingInterval
 * @property {ReturnType<typeof setInterval> | null} clipboardInterval
 * @property {string} lastClipboardText
 * @property {string[]} clipboardHistory
 * @property {Array | null} cachedInstalledApps
 * @property {boolean} installedAppsLoading
 * @property {import('child_process').ChildProcess | null} notifBridge
 * @property {number} notifBridgeCrashCount
 * @property {boolean} notifBridgeDisabled
 * @property {Array<{id: string, source: string, app: string, title: string, body: string, icon: string|null, timestamp: number, read: boolean}>} notificationHistory
 * @property {number | null} notifSocketPort
 * @property {string | null} notifSocketIP
 * @property {number} notifSocketClients
 * @property {any} _fbAuth
 * @property {any} _fbDb
 * @property {any} _fbHelpers
 */

/** @type {AppContext} */
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
