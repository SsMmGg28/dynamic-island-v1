# Codebase Index
> Auto-generated complete reference of all files, features, functions, and their locations.
> Last generated: 2026-04-23

## Table of Contents
- [Features Overview](#features-overview)
- [File-by-File Reference](#file-by-file-reference)
- [Function/Symbol Index](#functionsymbol-index)

## Features Overview
| Feature | Key Files | Description |
|---------|-----------|-------------|
| Electron app bootstrap | main.js, preload.js, package.json | Starts the desktop app, creates transparent always-on-top window, registers IPC, and exposes renderer-safe API. |
| Dynamic Island UI | src/index.html, src/renderer.js, src/styles.css | Implements collapsed/expanded island UI, media controls, sub-panels, and animations. |
| Windows media bridge | scripts/get-media.ps1, main.js | PowerShell bridge polls Windows GlobalSystemMediaTransportControls and executes media commands. |
| System controls and monitoring | main.js, src/renderer.js | Volume/brightness control, CPU/RAM polling, display switching, and shortcuts. |
| Productivity utilities | src/renderer.js, main.js | Timer, notes, clipboard history, screenshot capture, and app launcher workflows. |
| Game mode and sidebar | main.js, src/renderer.js, src/styles.css | Reduces polling/background work and shows compact sidebar controls/stats. |
| Study logging integration | main.js, preload.js, src/index.html, src/renderer.js | Firebase auth/logging endpoints exposed to renderer for study session tracking. |
| Packaging and build config | package.json | Electron run/build scripts, dependency declarations, and electron-builder packaging rules. |

## File-by-File Reference

### `main.js`
**Purpose**: Electron main-process entrypoint; manages lifecycle, window/tray, PowerShell media bridge, IPC handlers, platform integrations, and Firebase-backed StudyLogger operations.
**Depends on**: preload.js, src/index.html, scripts/get-media.ps1

| Line | Symbol | Type | Description |
|------|--------|------|-------------|
| L14 | `getLoudness()` | function | Lazy-loads `loudness`; returns module or null. Params: none. Returns: object \| null. |
| L24 | `getSI()` | function | Lazy-loads `systeminformation`; returns module or null. Params: none. Returns: object \| null. |
| L34 | `FIREBASE_CONFIG` | const | Firebase client configuration object used by dynamic imports in StudyLogger flow. |
| L47 | `initFirebase()` | function | Dynamically imports Firebase SDK pieces, initializes app/auth/firestore, and caches helpers. Params: none. Returns: Promise<boolean>. |
| L77 | `DEFAULT_SETTINGS` | const | Default persisted settings including shortcuts, appearance, launcher apps, notes, and idle timeout. |
| L103 | `initStore()` | function | Initializes `electron-store` with defaults or an in-memory fallback store. Params: none. Returns: void. |
| L116 | `createWindow()` | function | Creates transparent frameless BrowserWindow, restores/saves position, loads renderer HTML, and applies auto-start setting. Params: none. Returns: void. |
| L188 | `createTray()` | function | Creates tray icon (with fallback generated icon) and initializes tray menu. Params: none. Returns: void. |
| L215 | `updateTrayMenu()` | function | Rebuilds tray context menu actions for media, panels, game mode, and quit. Params: none. Returns: void. |
| L249 | `startMediaBridge()` | function | Spawns PowerShell media bridge process, parses stdout protocol, and auto-restarts on crash with backoff. Params: none. Returns: void. |
| L300 | `sendMediaCommand(cmd)` | function | Sends command over bridge stdin and resolves with parsed response. Params: cmd:string. Returns: Promise<any>. |
| L310 | `startMediaPolling()` | function | Starts 2s polling loop to fetch media info and push updates to renderer. Params: none. Returns: void. |
| L322 | `httpGet(url)` | function | Lightweight HTTP/HTTPS GET helper with JSON parse fallback. Params: url:string. Returns: Promise<any>. |
| L337 | `getVolume()` | function | Reads system volume through `loudness` or PowerShell fallback. Params: none. Returns: Promise<number>. |
| L350 | `setVolume(val)` | function | Sets system volume (clamped) using `loudness` or fallback key simulation. Params: val:number. Returns: Promise<void>. |
| L360 | `getBrightness()` | function | Reads monitor brightness via WMI. Params: none. Returns: Promise<number>. |
| L369 | `setBrightness(val)` | function | Sets monitor brightness via WMI methods. Params: val:number. Returns: Promise<void>. |
| L380 | `getSystemInfo()` | function | Returns CPU and memory usage stats via `systeminformation`. Params: none. Returns: Promise<object>. |
| L400 | `getWeatherLocation()` | function | Resolves approximate location via `ip-api.com`. Params: none. Returns: Promise<object\|null>. |
| L407 | `getWeather(lat, lon)` | function | Fetches current weather from Open-Meteo by coordinates. Params: lat:number, lon:number. Returns: Promise<object\|null>. |
| L415 | `lyricsCache` | const | In-memory LRU cache map for lyrics responses. |
| L416 | `lyricsCacheKeys` | const | Ordered cache keys for LRU eviction. |
| L417 | `LYRICS_CACHE_MAX` | const | Maximum lyrics cache entries (15). |
| L419 | `getLyrics(title, artist, duration)` | function | Fetches lyrics from LRCLIB with caching and optional duration. Params: title:string, artist:string, duration:number. Returns: Promise<object\|null>. |
| L442 | `setGameMode(enabled)` | function | Toggles game mode behavior (power plan, notifications, polling suppression, renderer notification). Params: enabled:boolean. Returns: boolean. |
| L469 | `applyAutoStart(enabled)` | function | Adds/removes registry Run entry for auto-start (dev and packaged handling). Params: enabled:boolean. Returns: void. |
| L488 | `startClipboardMonitor()` | function | Polls clipboard every second, stores capped history, and emits new clipboard event to renderer. Params: none. Returns: void. |
| L507 | `takeScreenshot()` | function | Captures primary display screenshot, saves to desktop, copies to clipboard, and returns status payload. Params: none. Returns: Promise<object>. |
| L543 | `registerShortcuts()` | function | Registers global shortcuts from settings and wires actions to IPC/media/game mode. Params: none. Returns: void. |
| L576 | `launchApp(appPath)` | function | Launches app path via shell and reports success/error. Params: appPath:string. Returns: Promise<object>. |
| L588 | `pickApp()` | function | Opens file picker for executable/shortcut and returns selected app metadata. Params: none. Returns: Promise<object\|null>. |
| L604 | `SYSTEM_APP_FILTER` | const | Keyword set used to filter utility/system entries from launcher candidates. |
| L615 | `isSystemApp(name)` | function | Checks whether launcher candidate name matches filtered keywords. Params: name:string. Returns: boolean. |
| L624 | `extractAppIcon(lnkPath)` | function | Resolves icon as base64 PNG from shortcut or shortcut target. Params: lnkPath:string. Returns: Promise<string>. |
| L654 | `getInstalledApps()` | function | Scans Start Menu/Desktop shortcuts recursively, deduplicates, sorts, and batches icon extraction. Params: none. Returns: Promise<Array<object>>. |
| L698 | `scanLnkDirSync(dir, results, seen, depth)` | function | Recursive helper for collecting `.lnk/.exe/.url` entries with depth limit. Params: dir:string, results:Array, seen:Set, depth:number. Returns: void. |
| L719 | `getDisplays()` | function | Returns normalized display metadata list for renderer selector. Params: none. Returns: Array<object>. |
| L728 | `moveToDisplay(displayId)` | function | Repositions island window to selected display according to saved position preference. Params: displayId:number. Returns: void. |
| L742 | `registerIPC()` | function | Registers all ipcMain handlers/events (media/system/settings/weather/lyrics/game mode/notes/launcher/display/window/theme/studylogger). Params: none. Returns: void. |
| L961 | `THEME_PRESETS` | const | Built-in theme preset definitions exposed to renderer. |
| L971 | `app.whenReady().then(...)` | lifecycle | Initializes store/window/tray/IPC/bridge/shortcuts/clipboard and preloads installed app cache. |
| L983 | `app.on('window-all-closed', ...)` | lifecycle | Cleans resources and quits app. |
| L994 | `app.on('before-quit', ...)` | lifecycle | Unregisters shortcuts and shuts down media bridge on quit. |

### `preload.js`
**Purpose**: Secure context bridge exposing a renderer-safe `window.api` contract for all main-process IPC actions and event subscriptions.
**Depends on**: None (project-local imports); runtime IPC contract with main.js

| Line | Symbol | Type | Description |
|------|--------|------|-------------|
| L3 | `api` | exported object | `contextBridge.exposeInMainWorld('api', ...)` surface consumed by renderer. |
| L5 | `api.getMediaInfo()` | function | Invokes `media:info`. Params: none. Returns: Promise<object>. |
| L6 | `api.mediaPlay()` | function | Invokes `media:play`. Params: none. Returns: Promise<any>. |
| L7 | `api.mediaPause()` | function | Invokes `media:pause`. Params: none. Returns: Promise<any>. |
| L8 | `api.mediaToggle()` | function | Invokes `media:toggle`. Params: none. Returns: Promise<any>. |
| L9 | `api.mediaNext()` | function | Invokes `media:next`. Params: none. Returns: Promise<any>. |
| L10 | `api.mediaPrev()` | function | Invokes `media:prev`. Params: none. Returns: Promise<any>. |
| L13 | `api.getVolume()` | function | Invokes `system:getVolume`. Returns: Promise<number>. |
| L14 | `api.setVolume(val)` | function | Invokes `system:setVolume`. Params: val:number. Returns: Promise<void>. |
| L15 | `api.getBrightness()` | function | Invokes `system:getBrightness`. Returns: Promise<number>. |
| L16 | `api.setBrightness(val)` | function | Invokes `system:setBrightness`. Params: val:number. Returns: Promise<void>. |
| L17 | `api.getSystemInfo()` | function | Invokes `system:info`. Returns: Promise<object>. |
| L20 | `api.getGameMode()` | function | Invokes `gamemode:get`. Returns: Promise<boolean>. |
| L21 | `api.setGameMode(enabled)` | function | Invokes `gamemode:set`. Params: enabled:boolean. Returns: Promise<boolean>. |
| L24 | `api.getSettings()` | function | Invokes `settings:get`. Returns: Promise<object>. |
| L25 | `api.setSetting(key, value)` | function | Invokes `settings:set`. Params: key:string, value:any. Returns: Promise<object>. |
| L26 | `api.resetSettings()` | function | Invokes `settings:reset`. Returns: Promise<object>. |
| L29 | `api.getWeather(lat, lon)` | function | Invokes `weather:get`. Params: lat:number, lon:number. Returns: Promise<object>. |
| L30 | `api.getLocation()` | function | Invokes `weather:location`. Returns: Promise<object>. |
| L31 | `api.getLyrics(title, artist, duration)` | function | Invokes `lyrics:get`. Returns: Promise<object\|null>. |
| L34 | `api.getClipboardHistory()` | function | Invokes `clipboard:getHistory`. Returns: Promise<Array<object>>. |
| L35 | `api.copyToClipboard(text)` | function | Invokes `clipboard:copy`. Params: text:string. Returns: Promise<boolean>. |
| L36 | `api.getNotes()` | function | Invokes `notes:get`. Returns: Promise<Array<object>>. |
| L37 | `api.saveNotes(notes)` | function | Invokes `notes:save`. Params: notes:Array<object>. Returns: Promise<Array<object>>. |
| L40 | `api.takeScreenshot()` | function | Invokes `screenshot:take`. Returns: Promise<object>. |
| L43 | `api.pickApp()` | function | Invokes `launcher:pick`. Returns: Promise<object\|null>. |
| L44 | `api.launchApp(path)` | function | Invokes `launcher:launch`. Params: path:string. Returns: Promise<object>. |
| L45 | `api.getInstalledApps()` | function | Invokes `launcher:getInstalled`. Returns: Promise<Array<object>>. |
| L46 | `api.refreshInstalledApps()` | function | Invokes `launcher:refreshInstalled`. Returns: Promise<Array<object>>. |
| L47 | `api.getLauncherApps()` | function | Invokes `launcher:getApps`. Returns: Promise<Array<object>>. |
| L48 | `api.saveLauncherApps(apps)` | function | Invokes `launcher:saveApps`. Params: apps:Array<object>. Returns: Promise<Array<object>>. |
| L51 | `api.getDisplays()` | function | Invokes `displays:get`. Returns: Promise<Array<object>>. |
| L52 | `api.moveToDisplay(id)` | function | Invokes `displays:moveTo`. Params: id:number. Returns: Promise<boolean>. |
| L55 | `api.setWindowPosition(x, y)` | function | Invokes `window:setPosition`. Params: x:number, y:number. Returns: Promise<void>. |
| L56 | `api.getWindowPosition()` | function | Invokes `window:getPosition`. Returns: Promise<[number, number]>. |
| L59 | `api.setMouseIgnore(ignore)` | function | Sends `mouse:setIgnore` channel event. Params: ignore:boolean. Returns: void. |
| L62 | `api.setGameModeWindow(enabled)` | function | Invokes `window:gameMode`. Params: enabled:boolean. Returns: Promise<void>. |
| L65 | `api.getThemePresets()` | function | Invokes `theme:getPresets`. Returns: Promise<Array<object>>. |
| L68 | `api.quit()` | function | Invokes `app:quit`. Returns: Promise<void>. |
| L71 | `api.studyLogger` | exported object | StudyLogger IPC wrapper group for auth/session log persistence. |
| L72 | `api.studyLogger.getConfig()` | function | Invokes `studylogger:getConfig`. Returns: Promise<object>. |
| L73 | `api.studyLogger.signIn(token)` | function | Invokes `studylogger:signIn`. Params: token:string. Returns: Promise<object>. |
| L74 | `api.studyLogger.logSession(payload)` | function | Invokes `studylogger:logSession`. Params: payload:object. Returns: Promise<object>. |
| L75 | `api.studyLogger.clearToken()` | function | Invokes `studylogger:clearToken`. Returns: Promise<boolean>. |
| L79 | `api.onMediaUpdate(cb)` | function | Subscribes to `media:update` event. Params: cb:function. Returns: void. |
| L80 | `api.onGameModeUpdated(cb)` | function | Subscribes to `gamemode:updated` event. Params: cb:function. Returns: void. |
| L81 | `api.onClipboardNew(cb)` | function | Subscribes to `clipboard:new` event. Params: cb:function. Returns: void. |
| L82 | `api.onShortcutToggleIsland(cb)` | function | Subscribes to `shortcut:toggleIsland` event. Params: cb:function. Returns: void. |
| L83 | `api.onShortcutTimerToggle(cb)` | function | Subscribes to `shortcut:timerToggle` event. Params: cb:function. Returns: void. |
| L84 | `api.onOpenPanel(cb)` | function | Subscribes to `open:panel` event. Params: cb:function. Returns: void. |

### `scripts/get-media.ps1`
**Purpose**: Long-running PowerShell process that bridges Electron main process commands to Windows Runtime media session APIs.
**Depends on**: None (project-local imports)

| Line | Symbol | Type | Description |
|------|--------|------|-------------|
| L17 | `WaitAsync($WinRtTask, $ResultType)` | function | Converts WinRT async operations to synchronous task results. Params: WinRtTask, ResultType. Returns: object. |
| L26 | `$manager` | variable | Global media transport controls session manager instance requested from WinRT. |
| L39 | `switch ($cmd)` | command router | Handles `info/play/pause/toggle/next/prev/exit` protocol commands and writes stdout responses. |

### `src/renderer.js`
**Purpose**: Main renderer controller; drives UI state transitions, media/timer/weather/system panels, game mode sidebar, settings, notes/clipboard, and launcher behavior.
**Depends on**: preload.js (`window.api`), src/index.html (DOM IDs/classes), src/styles.css (CSS variables/classes)

| Line | Symbol | Type | Description |
|------|--------|------|-------------|
| L6 | `state` | const | Renderer application state object (media, panels, timers, settings, launcher, idle/game mode state). |
| L45 | `$` | const function | DOM query shortcut for single element. Params: sel:string. Returns: Element\|null. |
| L46 | `$$` | const function | DOM query shortcut for node list. Params: sel:string. Returns: NodeList. |
| L48 | `dom` | const | Cached references to frequently used DOM nodes. |
| L94 | `init()` | function | Bootstraps UI/event wiring, loads settings/data, and registers IPC-driven callbacks. Returns: Promise<void>. |
| L160 | `SVG_ICONS` | const | Inline SVG icon map used across weather/notes/clipboard UI. |
| L177 | `showToast(message, duration=3000)` | function | Shows transient in-app toast message. Returns: void. |
| L190 | `setupClickThrough()` | function | Toggles click-through behavior based on island/sidebar mouse hover. Returns: void. |
| L218 | `updateClock()` | function | Updates collapsed clock text. Returns: void. |
| L226 | `setupIslandEvents()` | function | Wires hover expand/collapse with idle tracking integration. Returns: void. |
| L243 | `startIdleTimer()` | function | Starts delayed idle-notch entry timer. Returns: void. |
| L253 | `enterIdleMode()` | function | Enters compact idle-notch presentation and lowers update overhead. Returns: void. |
| L268 | `exitIdleMode()` | function | Leaves idle-notch state and restores active behavior. Returns: void. |
| L279 | `expandIsland()` | function | Expands island into full panel view. Returns: void. |
| L288 | `collapseIsland()` | function | Collapses island and closes sub-panels/monitor polling. Returns: void. |
| L299 | `setupDragEvents()` | function | Enables drag-to-reposition behavior in collapsed mode. Returns: void. |
| L335 | `openPanel(panelId)` | function | Opens selected sub-panel and triggers panel-specific loading. Returns: void. |
| L349 | `closePanel()` | function | Closes active sub-panel and unlocks island collapse behavior. Returns: void. |
| L357 | `setupActions()` | function | Binds action buttons and back navigation handlers. Returns: void. |
| L367 | `handleMediaUpdate(info)` | function | Applies media updates, mini/full UI refresh logic, and interpolation timers. Returns: void. |
| L415 | `interpolatePosition()` | function | Smoothly advances playback position between bridge polls. Returns: void. |
| L431 | `updateMediaUI()` | function | Renders media metadata/progress/artwork in collapsed and expanded views. Returns: void. |
| L480 | `updatePlayIcon(playing)` | function | Swaps play/pause SVG icon. Returns: void. |
| L488 | `updateAlbumArt(thumbnail)` | function | Updates album art in main player and sidebar. Returns: void. |
| L503 | `setupMediaControls()` | function | Binds media control buttons to API methods. Returns: void. |
| L510 | `fetchLyrics(title, artist, duration)` | function | Requests lyrics and renders synced/plain fallback output. Returns: Promise<void>. |
| L533 | `parseLRC(lrc)` | function | Parses LRC timestamps into line-time pairs. Returns: Array<object>. |
| L546 | `renderLyrics()` | function | Renders parsed lyrics lines into lyrics container. Returns: void. |
| L553 | `updateLyricsDisplay(position)` | function | Highlights active lyric line and auto-scrolls lyric viewport. Returns: void. |
| L574 | `setupLyricsToggle()` | function | Toggles lyrics panel and triggers fetch on demand. Returns: void. |
| L601 | `setupSliders()` | function | Binds volume/brightness sliders and slider fill updates. Returns: void. |
| L620 | `setupSliderFill(slider)` | function | Applies gradient fill visualization to range inputs. Returns: void. |
| L632 | `loadInitialData()` | function | Parallel-loads initial volume/brightness/game mode state from API. Returns: Promise<void>. |
| L669 | `updateGameModeUI()` | function | Reflects game mode state in buttons/cards/island classes. Returns: void. |
| L679 | `handleGameModeSwitch(active)` | function | Handles full game mode transition (window mode, polling, overlay, timers). Returns: void. |
| L723 | `showGameModeSidebar()` | function | Shows sidebar, starts periodic content/stat refresh, syncs controls. Returns: void. |
| L749 | `hideGameModeSidebar()` | function | Hides sidebar and stops game mode refresh interval. Returns: void. |
| L758 | `setupGameModeSidebar()` | function | Binds sidebar media/exit/volume interactions. Returns: void. |
| L790 | `updateSidebarContent()` | function | Updates sidebar now-playing, timer state, and uptime displays. Returns: void. |
| L836 | `updateSidebarStats()` | function | Polls and renders CPU/RAM and temp metrics in sidebar. Returns: void. |
| L863 | `setupGameMode()` | function | Wires game mode toggle action from panel button. Returns: void. |
| L872 | `setupTimer()` | function | Binds timer presets/start-stop and initializes timer UI. Returns: void. |
| L894 | `startTimer()` | function | Starts countdown interval and completion notification flow. Returns: void. |
| L910 | `stopTimer()` | function | Stops countdown and resets button state. Returns: void. |
| L917 | `updateTimerDisplay()` | function | Updates MM:SS text and circular progress ring offset. Returns: void. |
| L928 | `loadWeather()` | function | Loads location/weather payload and handles error states. Returns: Promise<void>. |
| L950 | `renderWeather()` | function | Renders weather card with condition, humidity, and wind data. Returns: void. |
| L980 | `getWeatherIcon(code)` | function | Maps weather code to icon SVG. Returns: string. |
| L992 | `getWeatherCondition(code)` | function | Maps weather code to localized condition string. Returns: string. |
| L1005 | `startMonitorPolling()` | function | Starts periodic system monitor refresh loop. Returns: void. |
| L1010 | `stopMonitorPolling()` | function | Stops monitor refresh loop. Returns: void. |
| L1017 | `refreshMonitor()` | function | Fetches and renders CPU/RAM gauge values and thresholds. Returns: Promise<void>. |
| L1038 | `setupNotesPanel()` | function | Binds notes/clipboard tab behavior and add-note controls. Returns: void. |
| L1059 | `loadNotesAndClipboard()` | function | Loads notes and clipboard histories from API and renders them. Returns: Promise<void>. |
| L1066 | `addNote()` | function | Adds note to state (capped), renders, and persists. Returns: void. |
| L1077 | `renderNotes()` | function | Renders notes list with pin/edit/copy/delete actions. Returns: void. |
| L1100 | `setupNotesEventDelegation()` | function | Delegates note action clicks and double-click edits. Returns: void. |
| L1128 | `startNoteEdit(item, idx)` | function | In-place note edit workflow with save/cancel handling. Returns: void. |
| L1154 | `renderClipboardHistory()` | function | Renders clipboard history list and copy actions. Returns: void. |
| L1172 | `setupClipboardEventDelegation()` | function | Delegates clipboard item copy interactions. Returns: void. |
| L1188 | `formatRelativeTime(timestamp)` | function | Formats elapsed time labels for clipboard entries. Returns: string. |
| L1197 | `setupLauncherPanel()` | function | Wires launcher grid actions and search behavior. Returns: void. |
| L1241 | `loadLauncherApps()` | function | Loads saved launcher apps and available installed app dataset. Returns: Promise<void>. |
| L1256 | `renderLauncherApps()` | function | Renders launcher grid from saved quick-launch entries. Returns: void. |
| L1274 | `renderInstalledApps(searchQuery='')` | function | Renders searchable installed-app results and add actions. Returns: void. |
| L1340 | `setupScreenshotButton()` | function | Binds screenshot action from more-menu entry. Returns: void. |
| L1358 | `setupMoreMenu()` | function | Binds more-menu open/close, timer entry, outside-click close. Returns: void. |
| L1385 | `closeMoreMenu()` | function | Closes more-menu dropdown. Returns: void. |
| L1391 | `loadSettingsPanel()` | function | Loads theme presets/displays/position UI for settings panel. Returns: Promise<void>. |
| L1418 | `renderThemePresets()` | function | Renders selectable theme preset buttons and binds selection persistence. Returns: void. |
| L1442 | `applyTheme(theme)` | function | Applies theme vars (`--bg`, `--text`, etc.) to document root. Returns: void. |
| L1455 | `loadSettings()` | function | Retrieves stored settings and applies them. Returns: Promise<void>. |
| L1465 | `applySettings(s)` | function | Applies persisted accent/opacity/lyrics/theme/position/idle/autostart values to UI. Returns: void. |
| L1502 | `setupSettings()` | function | Wires settings controls, updates UI vars, and persists changes. Returns: void. |
| L1566 | `formatTime(seconds)` | function | Converts seconds to `m:ss`. Returns: string. |
| L1573 | `_escapeMap` | const | Character replacement map for HTML escaping. |
| L1574 | `_escapeRe` | const | Regex for escapable HTML characters. |
| L1575 | `escapeHtml(str)` | function | Escapes unsafe HTML chars in text output. Returns: string. |
| L1581 | `DOMContentLoaded -> init` | event binding | Renderer start hook invoking `init`. |

### `src/renderer.js.bak`
**Purpose**: Previous/backup renderer implementation retained in repository as fallback reference.
**Depends on**: preload.js (`window.api`), src/index.html, src/styles.css

| Line | Symbol | Type | Description |
|------|--------|------|-------------|
| L6 | `state` | const | Backup renderer state container. |
| L32 | `$` | const function | Single-selector helper. Returns: Element\|null. |
| L33 | `$$` | const function | Multi-selector helper. Returns: NodeList. |
| L35 | `dom` | const | Cached DOM references in backup implementation. |
| L80 | `init()` | function | Backup renderer bootstrap. Returns: Promise<void>. |
| L95 | `updateClock()` | function | Updates clock text. |
| L103 | `setupIslandEvents()` | function | Hover expand/collapse handlers. |
| L115 | `expandIsland()` | function | Expands island. |
| L123 | `collapseIsland()` | function | Collapses island and hides panels. |
| L135 | `openPanel(panelId)` | function | Opens a sub-panel by ID. |
| L147 | `closePanel()` | function | Closes active sub-panel. |
| L155 | `setupActions()` | function | Binds action/back buttons. |
| L165 | `handleMediaUpdate(info)` | function | Applies media updates to UI. |
| L181 | `interpolatePosition()` | function | Playback progress interpolation. |
| L196 | `updateMediaUI()` | function | Media metadata/progress render. |
| L251 | `updatePlayIcon(playing)` | function | Play/pause icon switch. |
| L257 | `setupMediaControls()` | function | Media button bindings. |
| L264 | `fetchLyrics(title, artist, duration)` | function | Fetches and renders lyrics. |
| L288 | `parseLRC(lrc)` | function | Parses LRC format lines. |
| L300 | `renderLyrics()` | function | Renders parsed lyrics. |
| L307 | `updateLyricsDisplay(position)` | function | Highlights lyric by position. |
| L329 | `setupLyricsToggle()` | function | Toggles lyrics display. |
| L354 | `setupSliders()` | function | Slider bindings for system controls. |
| L374 | `setupSliderFill(slider)` | function | Slider gradient fill updater. |
| L386 | `loadInitialData()` | function | Initial volume/brightness/game mode load. |
| L420 | `updateGameModeUI()` | function | Game mode UI state reflection. |
| L429 | `setupGameMode()` | function | Game mode toggle binding. |
| L438 | `setupTimer()` | function | Timer presets and controls setup. |
| L463 | `startTimer()` | function | Starts timer countdown. |
| L480 | `stopTimer()` | function | Stops timer countdown. |
| L487 | `updateTimerDisplay()` | function | Updates timer text/ring. |
| L500 | `loadWeather()` | function | Loads weather payload. |
| L525 | `renderWeather()` | function | Renders weather panel values. |
| L547 | `getWeatherIcon(code)` | function | Maps weather code to icon. |
| L559 | `getWeatherCondition(code)` | function | Maps weather code to string. |
| L572 | `startMonitorPolling()` | function | Starts monitor interval. |
| L577 | `stopMonitorPolling()` | function | Stops monitor interval. |
| L584 | `refreshMonitor()` | function | Refreshes CPU/RAM UI metrics. |
| L611 | `loadSettings()` | function | Loads saved settings. |
| L621 | `applySettings(s)` | function | Applies saved settings to UI. |
| L640 | `setupSettings()` | function | Binds settings interactions. |
| L675 | `formatTime(seconds)` | function | Converts seconds to `m:ss`. |
| L682 | `escapeHtml(str)` | function | Escapes HTML text. |
| L690 | `DOMContentLoaded -> init` | event binding | Backup renderer startup hook. |

### `src/styles.css`
**Purpose**: Complete styling system for island UI, animations, sub-panels, game mode sidebar, launcher, notes/clipboard, and responsive behavior.
**Depends on**: src/index.html class/id structure

| Line | Symbol | Type | Description |
|------|--------|------|-------------|
| L5 | `:root custom properties` | style tokens | Defines global CSS variables for accent, typography, spacing, and motion. |
| L103 | `@keyframes pulse-dot` | keyframes | Status-dot pulse animation. |
| L152 | `@keyframes eq-bar` | keyframes | Mini equalizer bar animation. |
| L188 | `@keyframes ring-pulse` | keyframes | Pulse-ring animation for active playback. |
| L487 | `@keyframes menu-in` | keyframes | More-menu entrance animation. |
| L528 | `@keyframes panel-in` | keyframes | Sub-panel reveal animation. |
| L884 | `@keyframes shimmer` | keyframes | Collapsed island border shimmer effect. |
| L1505 | `@keyframes marquee` | keyframes | Idle-notch mini text marquee animation. |

### `src/index.html`
**Purpose**: Main renderer HTML layout containing collapsed/expanded island views, panel contents, and script/style mounts.
**Depends on**: src/styles.css, src/renderer.js

| Line | Symbol | Type | Description |
|------|--------|------|-------------|
| L6 | `CSP meta` | config | Content Security Policy allowing self scripts/styles and specific weather/lyrics/location endpoints. |
| L7 | `styles.css link` | resource | Loads renderer stylesheet. |
| L11 | `#island-wrapper / #island` | container | Root island containers for collapsed and expanded modes. |
| L82 | `#lyrics-container` | panel section | Lyrics subcomponent mount used by renderer lyric logic. |
| L135 | `.actions-section` | panel section | Quick action buttons that open feature panels. |
| L245 | `#panel-settings` | sub-panel | Settings panel with theme/accent/opacity/position/autostart/idle/display controls. |
| L330 | `#panel-notes` | sub-panel | Notes and clipboard tabbed panel. |
| L363 | `#panel-launcher` | sub-panel | Quick launcher panel and search UI. |
| L385 | `#toast-container` | utility mount | Toast notification container for renderer. |
| L388 | `#gamemode-sidebar` | utility mount | Compact game mode sidebar UI. |
| L517 | `renderer.js script` | resource | Loads renderer controller script. |

### `package.json`
**Purpose**: Project manifest for Electron runtime/build scripts, dependency graph, and packaging directives.
**Depends on**: main.js, preload.js, src/**, scripts/** (via build file lists)

| Line | Symbol | Type | Description |
|------|--------|------|-------------|
| L2 | `name` | config | Package name `dynamic-island`. |
| L5 | `main` | config | Main process entry set to `main.js`. |
| L6 | `scripts.start` | script | Runs app with `electron .`. |
| L7 | `scripts.dev` | script | Runs app in dev mode with `--dev`. |
| L8 | `scripts.build` | script | Builds portable Windows artifact via electron-builder. |
| L10 | `dependencies` | config | Runtime dependencies (`electron-store`, `firebase`, `loudness`, `systeminformation`). |
| L16 | `devDependencies` | config | Development/build dependencies (`electron`, `electron-builder`, `png-to-ico`). |
| L21 | `build` | config | Electron-builder metadata, files inclusion, and extraResources copy for scripts folder. |

## Function/Symbol Index
Alphabetical cross-reference of every symbol with its file location.

| Symbol | Type | File | Line |
|--------|------|------|------|
| `$` | function | `src/renderer.js` | L45 |
| `$` | function | `src/renderer.js.bak` | L32 |
| `$$` | function | `src/renderer.js` | L46 |
| `$$` | function | `src/renderer.js.bak` | L33 |
| `_escapeMap` | const | `src/renderer.js` | L1573 |
| `_escapeRe` | const | `src/renderer.js` | L1574 |
| `addNote` | function | `src/renderer.js` | L1066 |
| `api` | exported object | `preload.js` | L3 |
| `api.copyToClipboard` | function | `preload.js` | L35 |
| `api.getBrightness` | function | `preload.js` | L15 |
| `api.getClipboardHistory` | function | `preload.js` | L34 |
| `api.getDisplays` | function | `preload.js` | L51 |
| `api.getGameMode` | function | `preload.js` | L20 |
| `api.getInstalledApps` | function | `preload.js` | L45 |
| `api.getLauncherApps` | function | `preload.js` | L47 |
| `api.getLocation` | function | `preload.js` | L30 |
| `api.getLyrics` | function | `preload.js` | L31 |
| `api.getMediaInfo` | function | `preload.js` | L5 |
| `api.getNotes` | function | `preload.js` | L36 |
| `api.getSettings` | function | `preload.js` | L24 |
| `api.getSystemInfo` | function | `preload.js` | L17 |
| `api.getThemePresets` | function | `preload.js` | L65 |
| `api.getVolume` | function | `preload.js` | L13 |
| `api.getWeather` | function | `preload.js` | L29 |
| `api.getWindowPosition` | function | `preload.js` | L56 |
| `api.launchApp` | function | `preload.js` | L44 |
| `api.mediaNext` | function | `preload.js` | L9 |
| `api.mediaPause` | function | `preload.js` | L7 |
| `api.mediaPlay` | function | `preload.js` | L6 |
| `api.mediaPrev` | function | `preload.js` | L10 |
| `api.mediaToggle` | function | `preload.js` | L8 |
| `api.moveToDisplay` | function | `preload.js` | L52 |
| `api.onClipboardNew` | function | `preload.js` | L81 |
| `api.onGameModeUpdated` | function | `preload.js` | L80 |
| `api.onMediaUpdate` | function | `preload.js` | L79 |
| `api.onOpenPanel` | function | `preload.js` | L84 |
| `api.onShortcutTimerToggle` | function | `preload.js` | L83 |
| `api.onShortcutToggleIsland` | function | `preload.js` | L82 |
| `api.pickApp` | function | `preload.js` | L43 |
| `api.quit` | function | `preload.js` | L68 |
| `api.refreshInstalledApps` | function | `preload.js` | L46 |
| `api.resetSettings` | function | `preload.js` | L26 |
| `api.saveLauncherApps` | function | `preload.js` | L48 |
| `api.saveNotes` | function | `preload.js` | L37 |
| `api.setBrightness` | function | `preload.js` | L16 |
| `api.setGameMode` | function | `preload.js` | L21 |
| `api.setGameModeWindow` | function | `preload.js` | L62 |
| `api.setMouseIgnore` | function | `preload.js` | L59 |
| `api.setSetting` | function | `preload.js` | L25 |
| `api.setVolume` | function | `preload.js` | L14 |
| `api.setWindowPosition` | function | `preload.js` | L55 |
| `api.studyLogger` | exported object | `preload.js` | L71 |
| `api.studyLogger.clearToken` | function | `preload.js` | L75 |
| `api.studyLogger.getConfig` | function | `preload.js` | L72 |
| `api.studyLogger.logSession` | function | `preload.js` | L74 |
| `api.studyLogger.signIn` | function | `preload.js` | L73 |
| `api.takeScreenshot` | function | `preload.js` | L40 |
| `applyAutoStart` | function | `main.js` | L469 |
| `applySettings` | function | `src/renderer.js` | L1465 |
| `applySettings` | function | `src/renderer.js.bak` | L621 |
| `applyTheme` | function | `src/renderer.js` | L1442 |
| `closeMoreMenu` | function | `src/renderer.js` | L1385 |
| `closePanel` | function | `src/renderer.js` | L349 |
| `closePanel` | function | `src/renderer.js.bak` | L147 |
| `collapseIsland` | function | `src/renderer.js` | L288 |
| `collapseIsland` | function | `src/renderer.js.bak` | L123 |
| `DEFAULT_SETTINGS` | const | `main.js` | L77 |
| `dom` | const | `src/renderer.js` | L48 |
| `dom` | const | `src/renderer.js.bak` | L35 |
| `enterIdleMode` | function | `src/renderer.js` | L253 |
| `escapeHtml` | function | `src/renderer.js` | L1575 |
| `escapeHtml` | function | `src/renderer.js.bak` | L682 |
| `extractAppIcon` | function | `main.js` | L624 |
| `FIREBASE_CONFIG` | const | `main.js` | L34 |
| `fetchLyrics` | function | `src/renderer.js` | L510 |
| `fetchLyrics` | function | `src/renderer.js.bak` | L264 |
| `formatRelativeTime` | function | `src/renderer.js` | L1188 |
| `formatTime` | function | `src/renderer.js` | L1566 |
| `formatTime` | function | `src/renderer.js.bak` | L675 |
| `getBrightness` | function | `main.js` | L360 |
| `getDisplays` | function | `main.js` | L719 |
| `getInstalledApps` | function | `main.js` | L654 |
| `getLoudness` | function | `main.js` | L14 |
| `getLyrics` | function | `main.js` | L419 |
| `getSI` | function | `main.js` | L24 |
| `getSystemInfo` | function | `main.js` | L380 |
| `getVolume` | function | `main.js` | L337 |
| `getWeather` | function | `main.js` | L407 |
| `getWeatherCondition` | function | `src/renderer.js` | L992 |
| `getWeatherCondition` | function | `src/renderer.js.bak` | L559 |
| `getWeatherIcon` | function | `src/renderer.js` | L980 |
| `getWeatherIcon` | function | `src/renderer.js.bak` | L547 |
| `getWeatherLocation` | function | `main.js` | L400 |
| `handleGameModeSwitch` | function | `src/renderer.js` | L679 |
| `handleMediaUpdate` | function | `src/renderer.js` | L367 |
| `handleMediaUpdate` | function | `src/renderer.js.bak` | L165 |
| `hideGameModeSidebar` | function | `src/renderer.js` | L749 |
| `httpGet` | function | `main.js` | L322 |
| `init` | function | `src/renderer.js` | L94 |
| `init` | function | `src/renderer.js.bak` | L80 |
| `initFirebase` | function | `main.js` | L47 |
| `initStore` | function | `main.js` | L103 |
| `interpolatePosition` | function | `src/renderer.js` | L415 |
| `interpolatePosition` | function | `src/renderer.js.bak` | L181 |
| `isSystemApp` | function | `main.js` | L615 |
| `launchApp` | function | `main.js` | L576 |
| `loadInitialData` | function | `src/renderer.js` | L632 |
| `loadInitialData` | function | `src/renderer.js.bak` | L386 |
| `loadLauncherApps` | function | `src/renderer.js` | L1241 |
| `loadNotesAndClipboard` | function | `src/renderer.js` | L1059 |
| `loadSettings` | function | `src/renderer.js` | L1455 |
| `loadSettings` | function | `src/renderer.js.bak` | L611 |
| `loadSettingsPanel` | function | `src/renderer.js` | L1391 |
| `loadWeather` | function | `src/renderer.js` | L928 |
| `loadWeather` | function | `src/renderer.js.bak` | L500 |
| `LYRICS_CACHE_MAX` | const | `main.js` | L417 |
| `lyricsCache` | const | `main.js` | L415 |
| `lyricsCacheKeys` | const | `main.js` | L416 |
| `moveToDisplay` | function | `main.js` | L728 |
| `openPanel` | function | `src/renderer.js` | L335 |
| `openPanel` | function | `src/renderer.js.bak` | L135 |
| `parseLRC` | function | `src/renderer.js` | L533 |
| `parseLRC` | function | `src/renderer.js.bak` | L288 |
| `pickApp` | function | `main.js` | L588 |
| `refreshMonitor` | function | `src/renderer.js` | L1017 |
| `refreshMonitor` | function | `src/renderer.js.bak` | L584 |
| `registerIPC` | function | `main.js` | L742 |
| `registerShortcuts` | function | `main.js` | L543 |
| `renderClipboardHistory` | function | `src/renderer.js` | L1154 |
| `renderInstalledApps` | function | `src/renderer.js` | L1274 |
| `renderLauncherApps` | function | `src/renderer.js` | L1256 |
| `renderLyrics` | function | `src/renderer.js` | L546 |
| `renderLyrics` | function | `src/renderer.js.bak` | L300 |
| `renderNotes` | function | `src/renderer.js` | L1077 |
| `renderThemePresets` | function | `src/renderer.js` | L1418 |
| `renderWeather` | function | `src/renderer.js` | L950 |
| `renderWeather` | function | `src/renderer.js.bak` | L525 |
| `scanLnkDirSync` | function | `main.js` | L698 |
| `sendMediaCommand` | function | `main.js` | L300 |
| `setBrightness` | function | `main.js` | L369 |
| `setGameMode` | function | `main.js` | L442 |
| `setVolume` | function | `main.js` | L350 |
| `setupActions` | function | `src/renderer.js` | L357 |
| `setupActions` | function | `src/renderer.js.bak` | L155 |
| `setupClickThrough` | function | `src/renderer.js` | L190 |
| `setupClipboardEventDelegation` | function | `src/renderer.js` | L1172 |
| `setupDragEvents` | function | `src/renderer.js` | L299 |
| `setupGameMode` | function | `src/renderer.js` | L863 |
| `setupGameMode` | function | `src/renderer.js.bak` | L429 |
| `setupGameModeSidebar` | function | `src/renderer.js` | L758 |
| `setupIslandEvents` | function | `src/renderer.js` | L226 |
| `setupIslandEvents` | function | `src/renderer.js.bak` | L103 |
| `setupLauncherPanel` | function | `src/renderer.js` | L1197 |
| `setupLyricsToggle` | function | `src/renderer.js` | L574 |
| `setupLyricsToggle` | function | `src/renderer.js.bak` | L329 |
| `setupMediaControls` | function | `src/renderer.js` | L503 |
| `setupMediaControls` | function | `src/renderer.js.bak` | L257 |
| `setupMoreMenu` | function | `src/renderer.js` | L1358 |
| `setupNotesEventDelegation` | function | `src/renderer.js` | L1100 |
| `setupNotesPanel` | function | `src/renderer.js` | L1038 |
| `setupScreenshotButton` | function | `src/renderer.js` | L1340 |
| `setupSettings` | function | `src/renderer.js` | L1502 |
| `setupSettings` | function | `src/renderer.js.bak` | L640 |
| `setupSliderFill` | function | `src/renderer.js` | L620 |
| `setupSliderFill` | function | `src/renderer.js.bak` | L374 |
| `setupSliders` | function | `src/renderer.js` | L601 |
| `setupSliders` | function | `src/renderer.js.bak` | L354 |
| `setupTimer` | function | `src/renderer.js` | L872 |
| `setupTimer` | function | `src/renderer.js.bak` | L438 |
| `showGameModeSidebar` | function | `src/renderer.js` | L723 |
| `showToast` | function | `src/renderer.js` | L177 |
| `startClipboardMonitor` | function | `main.js` | L488 |
| `startIdleTimer` | function | `src/renderer.js` | L243 |
| `startMediaBridge` | function | `main.js` | L249 |
| `startMediaPolling` | function | `main.js` | L310 |
| `startMonitorPolling` | function | `src/renderer.js` | L1005 |
| `startMonitorPolling` | function | `src/renderer.js.bak` | L572 |
| `startNoteEdit` | function | `src/renderer.js` | L1128 |
| `startTimer` | function | `src/renderer.js` | L894 |
| `startTimer` | function | `src/renderer.js.bak` | L463 |
| `state` | const | `src/renderer.js` | L6 |
| `state` | const | `src/renderer.js.bak` | L6 |
| `SVG_ICONS` | const | `src/renderer.js` | L160 |
| `SYSTEM_APP_FILTER` | const | `main.js` | L604 |
| `takeScreenshot` | function | `main.js` | L507 |
| `THEME_PRESETS` | const | `main.js` | L961 |
| `updateAlbumArt` | function | `src/renderer.js` | L488 |
| `updateClock` | function | `src/renderer.js` | L218 |
| `updateClock` | function | `src/renderer.js.bak` | L95 |
| `updateGameModeUI` | function | `src/renderer.js` | L669 |
| `updateGameModeUI` | function | `src/renderer.js.bak` | L420 |
| `updateLyricsDisplay` | function | `src/renderer.js` | L553 |
| `updateLyricsDisplay` | function | `src/renderer.js.bak` | L307 |
| `updateMediaUI` | function | `src/renderer.js` | L431 |
| `updateMediaUI` | function | `src/renderer.js.bak` | L196 |
| `updatePlayIcon` | function | `src/renderer.js` | L480 |
| `updatePlayIcon` | function | `src/renderer.js.bak` | L251 |
| `updateSidebarContent` | function | `src/renderer.js` | L790 |
| `updateSidebarStats` | function | `src/renderer.js` | L836 |
| `updateTimerDisplay` | function | `src/renderer.js` | L917 |
| `updateTimerDisplay` | function | `src/renderer.js.bak` | L487 |
| `WaitAsync` | function | `scripts/get-media.ps1` | L17 |
