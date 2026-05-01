// Auto-start via Windows registry Run key.
const { exec } = require('child_process');
const { app } = require('electron');

function applyAutoStart(enabled) {
    if (enabled) {
        let regValue;
        if (app.isPackaged) {
            regValue = `"${process.execPath}"`;
        } else {
            regValue = `"\\\"${process.execPath}\\\" \\\"${app.getAppPath()}\\\""`;
        }
        exec(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v DynamicIsland /t REG_SZ /d ${regValue} /f`, (err) => {
            if (err && process.argv.includes('--dev')) console.error('AutoStart reg error:', err);
        });
    } else {
        exec('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v DynamicIsland /f', () => {});
    }
}

module.exports = { applyAutoStart };
