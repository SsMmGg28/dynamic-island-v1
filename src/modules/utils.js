/* ── utils.js ── Shared utilities, SVG icons, toast ── */

// ── HTML escape ──
const _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const _escapeRe = /[&<>"']/g;
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(_escapeRe, c => _escapeMap[c]);
}

// ── Time formatting ──
function formatTime(seconds) {
    if (!seconds || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

function formatRelativeTime(timestamp) {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Az önce';
    if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
    return new Date(timestamp).toLocaleDateString('tr-TR');
}

// ── Toast notifications ──
function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ── SVG icon library ──
const SVG_ICONS = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="weather-svg"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    partcloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="weather-svg"><path d="M12 2v2m6.36.64l-1.41 1.41M20 12h2M17.66 17.66l1.41 1.41"/><circle cx="12" cy="10" r="4"/><path d="M8 16a5 5 0 0 1 8.54-3.54A4 4 0 1 1 19 20H7a3 3 0 1 1 1-5.83"/></svg>',
    fog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="weather-svg"><path d="M3 15h18M3 19h18M8 11a4 4 0 1 1 8 0"/></svg>',
    drizzle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="weather-svg"><path d="M8 19v2m4-2v2m4-2v2"/><path d="M4 13a5 5 0 0 1 9.9-1A3.5 3.5 0 1 1 18 16H5a4 4 0 0 1-1-3z"/></svg>',
    rain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="weather-svg"><path d="M7 19l-1 3m5-3l-1 3m5-3l-1 3m5-3l-1 3"/><path d="M4 13a5 5 0 0 1 9.9-1A3.5 3.5 0 1 1 18 16H5a4 4 0 0 1-1-3z"/></svg>',
    snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="weather-svg"><path d="M4 13a5 5 0 0 1 9.9-1A3.5 3.5 0 1 1 18 16H5a4 4 0 0 1-1-3z"/><circle cx="8" cy="20" r="1" fill="currentColor"/><circle cx="12" cy="22" r="1" fill="currentColor"/><circle cx="16" cy="20" r="1" fill="currentColor"/></svg>',
    thunder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="weather-svg"><path d="M4 13a5 5 0 0 1 9.9-1A3.5 3.5 0 1 1 18 16H5a4 4 0 0 1-1-3z"/><path d="M13 16l-2 4h3l-2 4"/></svg>',
    variable: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="weather-svg"><circle cx="12" cy="10" r="4"/><path d="M4 13a5 5 0 0 1 9.9-1A3.5 3.5 0 1 1 18 16H5a4 4 0 0 1-1-3z"/></svg>',
    humidity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14" style="vertical-align:-2px"><path d="M12 2C8 7 4 11 4 15a8 8 0 0 0 16 0c0-4-4-8-8-13z"/></svg>',
    wind: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14" style="vertical-align:-2px"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:-2px"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
};
