// App launcher: scan Start Menu shortcuts, pick/launch apps, extract icons.
const { app, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const SYSTEM_APP_FILTER = new Set([
    'uninstall', 'kaldır', 'remove', 'repair', 'update', 'updater',
    'readme', 'release notes', 'changelog', 'documentation', 'help',
    'license', 'about', 'eula', 'terms', 'privacy',
    'debug', 'diagnostic', 'config', 'configuration',
    'migration', 'setup', 'installer', 'prerequisite',
    'runtime', 'redistributable', 'vcredist', 'dotnet',
    'telemetry', 'feedback', 'report', 'crash',
    'command prompt', 'powershell ise',
]);

function isSystemApp(name) {
    const lower = name.toLowerCase();
    for (const kw of SYSTEM_APP_FILTER) {
        if (lower.includes(kw)) return true;
    }
    return false;
}

async function extractAppIcon(lnkPath) {
    try {
        const icon = await app.getFileIcon(lnkPath, { size: 'large' });
        if (icon) {
            const png = icon.toPNG();
            if (png && png.length > 0) return 'data:image/png;base64,' + png.toString('base64');
        }
    } catch {}
    if (lnkPath.endsWith('.lnk')) {
        try {
            const shortcut = shell.readShortcutLink(lnkPath);
            if (shortcut && shortcut.target) {
                const icon = await app.getFileIcon(shortcut.target, { size: 'large' });
                if (icon) {
                    const png = icon.toPNG();
                    if (png && png.length > 0) return 'data:image/png;base64,' + png.toString('base64');
                }
            }
        } catch {}
    }
    return '';
}

function scanLnkDirSync(dir, results, seen, depth) {
    if (depth > 4) return;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scanLnkDirSync(fullPath, results, seen, depth + 1);
            } else if (entry.name.endsWith('.lnk') || entry.name.endsWith('.exe') || entry.name.endsWith('.url')) {
                const ext = path.extname(entry.name);
                const name = path.basename(entry.name, ext);
                const lower = name.toLowerCase();
                if (isSystemApp(name) || seen.has(lower)) continue;
                seen.add(lower);
                results.push({ name, path: fullPath });
            }
        }
    } catch {}
}

async function getInstalledApps(ctx) {
    if (ctx.cachedInstalledApps) return ctx.cachedInstalledApps;
    if (ctx.installedAppsLoading) {
        return new Promise((resolve) => {
            const check = setInterval(() => {
                if (ctx.cachedInstalledApps) { clearInterval(check); resolve(ctx.cachedInstalledApps); }
            }, 200);
        });
    }
    ctx.installedAppsLoading = true;

    const results = [];
    const dirs = [
        path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
        path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
        path.join(process.env.USERPROFILE || '', 'Desktop'),
        path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop'),
    ];

    const seen = new Set();
    for (const dir of dirs) {
        try { scanLnkDirSync(dir, results, seen, 0); } catch {}
    }
    results.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

    for (let i = 0; i < results.length; i += 20) {
        const batch = results.slice(i, i + 20);
        await Promise.all(batch.map(async (a) => { a.icon = await extractAppIcon(a.path); }));
    }

    ctx.cachedInstalledApps = results;
    ctx.installedAppsLoading = false;
    return results;
}

async function launchApp(appPath) {
    try {
        const error = await shell.openPath(appPath);
        return error ? { success: false, error } : { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function pickApp(ctx) {
    const result = await dialog.showOpenDialog(ctx.mainWindow, {
        title: 'Uygulama Seç',
        properties: ['openFile'],
        filters: [
            { name: 'Uygulamalar', extensions: ['exe', 'lnk', 'bat', 'cmd'] },
            { name: 'Tümü', extensions: ['*'] },
        ],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const name = path.basename(filePath, path.extname(filePath));
    return { path: filePath, name };
}

module.exports = { getInstalledApps, launchApp, pickApp, isSystemApp, scanLnkDirSync, extractAppIcon, SYSTEM_APP_FILTER };
