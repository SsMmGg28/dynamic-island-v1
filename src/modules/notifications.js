/* ── notifications.js (renderer) ── Notification panel + toasts ── */

const NOTIF_TOAST_DURATION = 4000;
const TOAST_MAX_VISIBLE = 2;

let _toastQueue = [];
let _toastVisible = 0;

function _flushToastQueue() {
    while (_toastVisible < TOAST_MAX_VISIBLE && _toastQueue.length > 0) {
        // Collapse 3+ pending into a single summary toast
        if (_toastQueue.length >= 3) {
            const count = _toastQueue.length;
            _toastQueue = [];
            _renderToast({ _summary: true, count });
        } else {
            _renderToast(_toastQueue.shift());
        }
    }
}

function setupNotifications() {
    // Initialize state
    state.notifications = [];
    state.notifUnread = 0;
    state.notifSettings = { notifEnabled: true, notifBlockedApps: '', notifSocketPort: 8765, notifSourceFilter: 'all' };
    state.notifSocketStatus = { running: false, port: null, ip: null, clients: 0 };

    // Load initial data
    _loadNotifications();
    _loadNotifSettings();

    // Clear-all button
    const clearBtn = $('#notif-clear-all');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            // Update UI synchronously so the list clears immediately on click,
            // regardless of IPC round-trip timing or any incoming notification race.
            state.notifications = [];
            state.notifUnread = 0;
            _renderNotifications();
            _updateBadge();
            try {
                await window.api.notifications.clear();
            } catch (_) {}
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
        const filter = state.notifSettings.notifSourceFilter || 'all';
        if (filter === 'all' || notif.source === filter) _showNotificationToast(notif);
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

    const filter = state.notifSettings.notifSourceFilter || 'all';
    const filtered = state.notifications.filter(n => filter === 'all' || n.source === filter);

    if (!filtered.length) {
        list.innerHTML = '<p class="empty-text">Bu kaynaktan bildirim yok</p>';
        return;
    }

    list.innerHTML = filtered.map(n => {
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
    _toastQueue.push(notif);
    _flushToastQueue();
}

function _renderToast(notif) {
    const container = $('#toast-container');
    if (!container) return;

    _toastVisible++;

    const toast = document.createElement('div');
    toast.className = 'toast notif-toast';

    if (notif._summary) {
        toast.innerHTML = `<div class="notif-toast-title">🔔 ${notif.count} yeni bildirim</div>`;
    } else {
        const sourceLabel = notif.source === 'phone' ? '📱' : '🖥️';
        const iconHtml = notif.icon
            ? `<img class="notif-toast-icon" src="${notif.icon}" alt="">`
            : `<span class="notif-toast-icon-fallback">${_appEmoji(notif.app)}</span>`;
        toast.innerHTML = `
            <div class="notif-toast-header">
                ${iconHtml}
                <span class="notif-toast-app">${sourceLabel} ${_escape(notif.app)}</span>
            </div>
            ${notif.title ? `<div class="notif-toast-title">${_escape(notif.title)}</div>` : ''}
            ${notif.body  ? `<div class="notif-toast-body">${_escape(notif.body)}</div>`   : ''}
        `;
    }

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
            _toastVisible--;
            _flushToastQueue();
        }, 300);
    }, NOTIF_TOAST_DURATION);
}

function _renderSocketStatus() {
    const el = $('#notif-socket-status');
    if (el) {
        const s = state.notifSocketStatus;
        if (s.running) {
            el.textContent = `Bağlantı: ${s.ip}:${s.port} (${s.clients} cihaz)`;
            el.className = 'notif-socket-status connected';
        } else {
            el.textContent = 'WebSocket sunucusu kapalı';
            el.className = 'notif-socket-status disconnected';
        }
    }

    // Update connection banner in notifications panel
    const dot  = $('#ncb-dot');
    const addr = $('#ncb-addr');
    const copy = $('#ncb-copy');
    if (!dot || !addr) return;
    const st = state.notifSocketStatus;
    if (st.running && st.ip) {
        dot.className  = 'ncb-dot connected';
        addr.textContent = `${st.ip}:${st.port}`;
        if (copy) {
            copy.style.display = 'flex';
            copy.onclick = () => {
                navigator.clipboard.writeText(`${st.ip}:${st.port}`).catch(() => {});
                showToast('IP:Port kopyalandı');
            };
        }
    } else {
        dot.className  = 'ncb-dot disconnected';
        addr.textContent = st.clients > 0 ? `${st.clients} cihaz bağlı` : 'Bağlı değil';
        if (copy) copy.style.display = 'none';
    }
}

function _renderNotifSettingsUI() {
    const toggle = $('#notif-enabled-toggle');
    if (toggle) toggle.checked = state.notifSettings.notifEnabled !== false;

    const blocked = $('#notif-blocked-apps');
    if (blocked) blocked.value = state.notifSettings.notifBlockedApps || '';

    const port = $('#notif-socket-port');
    if (port) port.value = state.notifSettings.notifSocketPort || 8765;

    // Source filter (settings panel)
    const activeFilter = state.notifSettings.notifSourceFilter || 'all';
    document.querySelectorAll('[data-nsf]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.nsf === activeFilter);
    });
    // Source filter (notification panel tabs)
    document.querySelectorAll('[data-nfr]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.nfr === activeFilter);
    });
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

    // Source filter — settings panel (data-nsf) and notif panel tabs (data-nfr)
    function _applySourceFilter(value) {
        state.notifSettings.notifSourceFilter = value;
        window.api.notifications.saveSettings({ notifSourceFilter: value });
        document.querySelectorAll('[data-nsf]').forEach(b => {
            b.classList.toggle('active', b.dataset.nsf === value);
        });
        document.querySelectorAll('[data-nfr]').forEach(b => {
            b.classList.toggle('active', b.dataset.nfr === value);
        });
        _renderNotifications();
    }

    document.querySelectorAll('[data-nsf]').forEach(btn => {
        btn.addEventListener('click', () => _applySourceFilter(btn.dataset.nsf));
    });
    document.querySelectorAll('[data-nfr]').forEach(btn => {
        btn.addEventListener('click', () => _applySourceFilter(btn.dataset.nfr));
    });
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
