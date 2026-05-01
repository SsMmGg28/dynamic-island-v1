/* ── notifications.js (renderer) ── Notification panel + toasts ── */

const NOTIF_TOAST_DURATION = 4000;

function setupNotifications() {
    // Initialize state
    state.notifications = [];
    state.notifUnread = 0;
    state.notifSettings = { notifEnabled: true, notifBlockedApps: '', notifSocketPort: 8765 };
    state.notifSocketStatus = { running: false, port: null, ip: null, clients: 0 };

    // Load initial data
    _loadNotifications();
    _loadNotifSettings();

    // Clear-all button
    const clearBtn = $('#notif-clear-all');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            await window.api.notifications.clear();
            state.notifications = [];
            state.notifUnread = 0;
            _renderNotifications();
            _updateBadge();
        });
    }

    // Mark-read when panel opens (hooked from ui.js openPanel)
    const origOpen = typeof openPanel === 'function' ? openPanel : null;
    // Patch openPanel to mark notifications read when notifications panel opens
    if (origOpen) {
        window._origOpenPanel = origOpen;
        window.openPanel = function(panelId) {
            origOpen(panelId);
            if (panelId === 'notifications') {
                _markAllRead();
            }
        };
    }

    // Events from main process
    window.api.onNotificationNew((notif) => {
        state.notifications.unshift(notif);
        if (state.notifications.length > 50) state.notifications.pop();
        if (!notif.read) state.notifUnread++;
        _updateBadge();
        _renderNotifications();
        _showNotificationToast(notif);
    });

    window.api.onNotificationSocketStatus((status) => {
        state.notifSocketStatus = status;
        _renderSocketStatus();
    });
}

async function _loadNotifications() {
    try {
        const all = await window.api.notifications.getAll();
        state.notifications = all || [];
        state.notifUnread = state.notifications.filter(n => !n.read).length;
        _updateBadge();
        _renderNotifications();
    } catch {}
}

async function _loadNotifSettings() {
    try {
        const s = await window.api.notifications.getSettings();
        state.notifSettings = s || state.notifSettings;
        const status = await window.api.notifications.getSocketStatus();
        state.notifSocketStatus = status || state.notifSocketStatus;
        _renderNotifSettingsUI();
        _renderSocketStatus();
    } catch {}
}

function _markAllRead() {
    state.notifUnread = 0;
    state.notifications.forEach(n => { n.read = true; });
    _updateBadge();
    window.api.notifications.markRead().catch(() => {});
}

function _updateBadge() {
    const badge = $('#notif-badge');
    if (!badge) return;
    if (state.notifUnread > 0) {
        badge.textContent = state.notifUnread > 99 ? '99+' : String(state.notifUnread);
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function _renderNotifications() {
    const list = $('#notif-list');
    if (!list) return;

    if (!state.notifications.length) {
        list.innerHTML = '<p class="empty-text">Bildirim yok</p>';
        return;
    }

    list.innerHTML = state.notifications.map(n => {
        const time = _relativeTime(n.timestamp);
        const sourceClass = n.source === 'phone' ? 'notif-source-phone' : 'notif-source-pc';
        const sourceLabel = n.source === 'phone' ? '📱' : '🖥️';
        const iconHtml = n.icon
            ? `<img class="notif-app-icon" src="${n.icon}" alt="">`
            : `<span class="notif-app-icon-fallback">${_appEmoji(n.app)}</span>`;
        return `
        <div class="notif-item ${n.read ? '' : 'notif-unread'}">
            <div class="notif-icon-col">${iconHtml}</div>
            <div class="notif-content">
                <div class="notif-row-top">
                    <span class="notif-app ${sourceClass}">${sourceLabel} ${_escape(n.app)}</span>
                    <span class="notif-time">${time}</span>
                </div>
                ${n.title ? `<div class="notif-title">${_escape(n.title)}</div>` : ''}
                ${n.body  ? `<div class="notif-body">${_escape(n.body)}</div>`   : ''}
            </div>
        </div>`;
    }).join('');
}

function _showNotificationToast(notif) {
    const container = $('#toast-container');
    if (!container) return;

    const sourceLabel = notif.source === 'phone' ? '📱' : '🖥️';
    const iconHtml = notif.icon
        ? `<img class="notif-toast-icon" src="${notif.icon}" alt="">`
        : `<span class="notif-toast-icon-fallback">${_appEmoji(notif.app)}</span>`;

    const toast = document.createElement('div');
    toast.className = 'toast notif-toast';
    toast.innerHTML = `
        <div class="notif-toast-header">
            ${iconHtml}
            <span class="notif-toast-app">${sourceLabel} ${_escape(notif.app)}</span>
        </div>
        ${notif.title ? `<div class="notif-toast-title">${_escape(notif.title)}</div>` : ''}
        ${notif.body  ? `<div class="notif-toast-body">${_escape(notif.body)}</div>`   : ''}
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, NOTIF_TOAST_DURATION);
}

function _renderSocketStatus() {
    const el = $('#notif-socket-status');
    if (!el) return;
    const s = state.notifSocketStatus;
    if (s.running) {
        el.textContent = `Bağlantı: ${s.ip}:${s.port} (${s.clients} cihaz)`;
        el.className = 'notif-socket-status connected';
    } else {
        el.textContent = 'WebSocket sunucusu kapalı';
        el.className = 'notif-socket-status disconnected';
    }
}

function _renderNotifSettingsUI() {
    const toggle = $('#notif-enabled-toggle');
    if (toggle) toggle.checked = state.notifSettings.notifEnabled !== false;

    const blocked = $('#notif-blocked-apps');
    if (blocked) blocked.value = state.notifSettings.notifBlockedApps || '';

    const port = $('#notif-socket-port');
    if (port) port.value = state.notifSettings.notifSocketPort || 8765;
}

function setupNotifSettingsHandlers() {
    const toggle = $('#notif-enabled-toggle');
    if (toggle) {
        toggle.addEventListener('change', () => {
            state.notifSettings.notifEnabled = toggle.checked;
            window.api.notifications.saveSettings({ notifEnabled: toggle.checked });
        });
    }

    const blocked = $('#notif-blocked-apps');
    let blockedTimer;
    if (blocked) {
        blocked.addEventListener('input', () => {
            clearTimeout(blockedTimer);
            blockedTimer = setTimeout(() => {
                state.notifSettings.notifBlockedApps = blocked.value;
                window.api.notifications.saveSettings({ notifBlockedApps: blocked.value });
            }, 800);
        });
    }

    const portInput = $('#notif-socket-port');
    const portApply = $('#notif-socket-port-apply');
    if (portInput && portApply) {
        portApply.addEventListener('click', () => {
            const p = parseInt(portInput.value, 10);
            if (isNaN(p) || p < 1024 || p > 65535) return;
            state.notifSettings.notifSocketPort = p;
            window.api.notifications.saveSettings({ notifSocketPort: p });
            showToast('Port güncellendi, yeniden bağlanılıyor...');
        });
    }
}

// ── Helpers ──
function _relativeTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000)   return 'şimdi';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'dk önce';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'sa önce';
    return Math.floor(diff / 86400000) + 'g önce';
}

function _escape(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _appEmoji(app) {
    const lower = String(app || '').toLowerCase();
    if (lower.includes('whatsapp')) return '💬';
    if (lower.includes('telegram')) return '✈️';
    if (lower.includes('discord'))  return '🎮';
    if (lower.includes('gmail') || lower.includes('mail') || lower.includes('outlook')) return '📧';
    if (lower.includes('spotify') || lower.includes('music')) return '🎵';
    if (lower.includes('chrome') || lower.includes('firefox') || lower.includes('edge')) return '🌐';
    return '🔔';
}
