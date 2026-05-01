const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Media
    getMediaInfo: () => ipcRenderer.invoke('media:info'),
    mediaPlay: () => ipcRenderer.invoke('media:play'),
    mediaPause: () => ipcRenderer.invoke('media:pause'),
    mediaToggle: () => ipcRenderer.invoke('media:toggle'),
    mediaNext: () => ipcRenderer.invoke('media:next'),
    mediaPrev: () => ipcRenderer.invoke('media:prev'),

    // System
    getVolume: () => ipcRenderer.invoke('system:getVolume'),
    setVolume: (val) => ipcRenderer.invoke('system:setVolume', val),
    getBrightness: () => ipcRenderer.invoke('system:getBrightness'),
    setBrightness: (val) => ipcRenderer.invoke('system:setBrightness', val),
    getSystemInfo: () => ipcRenderer.invoke('system:info'),

    // Game Mode
    getGameMode: () => ipcRenderer.invoke('gamemode:get'),
    setGameMode: (enabled) => ipcRenderer.invoke('gamemode:set', enabled),

    // Settings
    getSettings: () => ipcRenderer.invoke('settings:get'),
    setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    resetSettings: () => ipcRenderer.invoke('settings:reset'),

    // Weather & Lyrics
    getWeather: (lat, lon) => ipcRenderer.invoke('weather:get', lat, lon),
    getLocation: () => ipcRenderer.invoke('weather:location'),
    getLyrics: (title, artist, duration) => ipcRenderer.invoke('lyrics:get', title, artist, duration),

    // Clipboard & Notes
    getClipboardHistory: () => ipcRenderer.invoke('clipboard:getHistory'),
    copyToClipboard: (text) => ipcRenderer.invoke('clipboard:copy', text),
    getNotes: () => ipcRenderer.invoke('notes:get'),
    saveNotes: (notes) => ipcRenderer.invoke('notes:save', notes),

    // Screenshot
    takeScreenshot: () => ipcRenderer.invoke('screenshot:take'),

    // App Launcher
    pickApp: () => ipcRenderer.invoke('launcher:pick'),
    launchApp: (path) => ipcRenderer.invoke('launcher:launch', path),
    getInstalledApps: () => ipcRenderer.invoke('launcher:getInstalled'),
    refreshInstalledApps: () => ipcRenderer.invoke('launcher:refreshInstalled'),
    getLauncherApps: () => ipcRenderer.invoke('launcher:getApps'),
    saveLauncherApps: (apps) => ipcRenderer.invoke('launcher:saveApps', apps),

    // Multi-Monitor
    getDisplays: () => ipcRenderer.invoke('displays:get'),
    moveToDisplay: (id) => ipcRenderer.invoke('displays:moveTo', id),

    // Window
    setWindowPosition: (x, y) => ipcRenderer.invoke('window:setPosition', x, y),
    getWindowPosition: () => ipcRenderer.invoke('window:getPosition'),

    // Click-through
    setMouseIgnore: (ignore) => ipcRenderer.send('mouse:setIgnore', ignore),

    // Game mode window
    setGameModeWindow: (enabled) => ipcRenderer.invoke('window:gameMode', enabled),

    // Themes
    getThemePresets: () => ipcRenderer.invoke('theme:getPresets'),

    // Quit
    quit: () => ipcRenderer.invoke('app:quit'),

    // Open external URL
    openUrl: (url) => ipcRenderer.invoke('shell:openExternal', url),

    // Notifications
    notifications: {
        getAll:          ()        => ipcRenderer.invoke('notifications:getAll'),
        clear:           ()        => ipcRenderer.invoke('notifications:clear'),
        markRead:        ()        => ipcRenderer.invoke('notifications:markRead'),
        getSettings:     ()        => ipcRenderer.invoke('notifications:getSettings'),
        saveSettings:    (patch)   => ipcRenderer.invoke('notifications:saveSettings', patch),
        getSocketStatus: ()        => ipcRenderer.invoke('notifications:getSocketStatus'),
    },

    // StudyLogger
    studyLogger: {
        getConfig: () => ipcRenderer.invoke('studylogger:getConfig'),
        signIn: (token) => ipcRenderer.invoke('studylogger:signIn', token),
        logSession: (payload) => ipcRenderer.invoke('studylogger:logSession', payload),
        clearToken: () => ipcRenderer.invoke('studylogger:clearToken'),
        // REST API methods
        saveApiConfig: (cfg) => ipcRenderer.invoke('studylogger:saveApiConfig', cfg),
        getApiConfig: () => ipcRenderer.invoke('studylogger:getApiConfig'),
        pollTimer: () => ipcRenderer.invoke('studylogger:pollTimer'),
        controlTimer: (action) => ipcRenderer.invoke('studylogger:controlTimer', action),
        getStats: () => ipcRenderer.invoke('studylogger:getStats'),
        logSessionApi: (payload) => ipcRenderer.invoke('studylogger:logSessionApi', payload),
        logExamApi: (payload) => ipcRenderer.invoke('studylogger:logExamApi', payload),
    },

    // Events
    onNotificationNew:    (cb) => ipcRenderer.on('notification:new',          (_, data)   => cb(data)),
    onNotificationSocketStatus: (cb) => ipcRenderer.on('notification:socketStatus', (_, data) => cb(data)),

    onMediaUpdate: (cb) => ipcRenderer.on('media:update', (_, data) => cb(data)),
    onGameModeUpdated: (cb) => ipcRenderer.on('gamemode:updated', (_, active) => cb(active)),
    onClipboardNew: (cb) => ipcRenderer.on('clipboard:new', (_, data) => cb(data)),
    onShortcutToggleIsland: (cb) => ipcRenderer.on('shortcut:toggleIsland', () => cb()),
    onShortcutTimerToggle: (cb) => ipcRenderer.on('shortcut:timerToggle', () => cb()),
    onOpenPanel: (cb) => ipcRenderer.on('open:panel', (_, panel) => cb(panel)),
});
