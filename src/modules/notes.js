/* ── notes.js ── Notes panel and clipboard history ── */

function setupNotesPanel() {
    // Tab switching
    $$('#panel-notes .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('#panel-notes .tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            $$('#panel-notes .tab-content').forEach(t => t.classList.remove('active'));
            $(`#tab-${btn.dataset.tab}`).classList.add('active');
        });
    });

    // Note input
    const noteInput = $('#note-input');
    const addNoteBtn = $('#add-note-btn');
    if (addNoteBtn) addNoteBtn.addEventListener('click', () => addNote(noteInput));
    if (noteInput) noteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(noteInput); }
    });

    setupNotesEventDelegation();
    setupClipboardEventDelegation();
}

function loadNotesAndClipboard() {
    window.api.getNotes().then(notes => {
        state.notes = notes || [];
        renderNotes();
    }).catch(() => { state.notes = []; renderNotes(); });
    window.api.getClipboardHistory().then(history => {
        state.clipboardHistory = history || [];
        renderClipboardHistory();
    }).catch(() => { state.clipboardHistory = []; renderClipboardHistory(); });
}

async function addNote(input) {
    const text = input ? input.value.trim() : '';
    if (!text) return;
    const note = { id: Date.now(), text, timestamp: Date.now(), pinned: false };
    state.notes.unshift(note);
    await window.api.saveNotes(state.notes);
    input.value = '';
    renderNotes();
}

function renderNotes() {
    const list = $('#notes-list');
    if (!list) return;
    if (!state.notes.length) {
        list.innerHTML = '<p class="placeholder">Henüz not yok</p>';
        return;
    }
    const sorted = [...state.notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.timestamp - a.timestamp);
    list.innerHTML = sorted.map((n, idx) => `
      <div class="note-item ${n.pinned ? 'pinned' : ''}" data-id="${n.id}" data-idx="${idx}">
        <div class="note-text">${escapeHtml(n.text)}</div>
        <div class="note-time">${formatRelativeTime(n.timestamp)}</div>
        <div class="note-actions">
          <button class="note-btn pin-btn" data-action="pin" data-id="${n.id}" title="${n.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}">${SVG_ICONS.pin}</button>
          <button class="note-btn copy-btn" data-action="copy" data-id="${n.id}" title="Kopyala">${SVG_ICONS.copy}</button>
          <button class="note-btn edit-btn" data-action="edit" data-id="${n.id}" title="Düzenle">${SVG_ICONS.edit}</button>
          <button class="note-btn del-btn" data-action="delete" data-id="${n.id}" title="Sil">${SVG_ICONS.trash}</button>
        </div>
      </div>`).join('');
}

function setupNotesEventDelegation() {
    const list = $('#notes-list');
    if (!list) return;
    list.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = parseInt(btn.dataset.id);
        const idx = state.notes.findIndex(n => n.id === id);
        if (idx === -1) return;
        const action = btn.dataset.action;
        if (action === 'pin') {
            state.notes[idx].pinned = !state.notes[idx].pinned;
            await window.api.saveNotes(state.notes);
            renderNotes();
        } else if (action === 'copy') {
            navigator.clipboard.writeText(state.notes[idx].text);
            showToast('Not kopyalandı');
        } else if (action === 'delete') {
            state.notes.splice(idx, 1);
            await window.api.saveNotes(state.notes);
            renderNotes();
        } else if (action === 'edit') {
            const item = btn.closest('.note-item');
            startNoteEdit(item, idx);
        }
    });
}

function startNoteEdit(item, idx) {
    const textEl = item.querySelector('.note-text');
    const original = state.notes[idx].text;
    const editInput = document.createElement('textarea');
    editInput.className = 'note-edit-input';
    editInput.value = original;
    textEl.replaceWith(editInput);
    editInput.focus();

    const done = async () => {
        const newText = editInput.value.trim();
        if (newText && newText !== original) {
            state.notes[idx].text = newText;
            state.notes[idx].timestamp = Date.now();
            await window.api.saveNotes(state.notes);
        }
        renderNotes();
    };
    editInput.addEventListener('blur', done);
    editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); done(); }
        if (e.key === 'Escape') { editInput.removeEventListener('blur', done); renderNotes(); }
    });
}

function renderClipboardHistory() {
    const list = $('#clipboard-list');
    if (!list) return;
    if (!state.clipboardHistory.length) {
        list.innerHTML = '<p class="placeholder">Pano geçmişi boş</p>';
        return;
    }
    list.innerHTML = state.clipboardHistory.map((item, i) => `
      <div class="clipboard-item" data-idx="${i}">
        <div class="clipboard-text">${escapeHtml(item.text.substring(0, 150))}${item.text.length > 150 ? '…' : ''}</div>
        <div class="clipboard-time">${formatRelativeTime(item.timestamp)}</div>
        <div class="note-actions">
          <button class="note-btn copy-btn" data-action="clip-copy" data-idx="${i}" title="Kopyala">${SVG_ICONS.copy}</button>
          <button class="note-btn del-btn" data-action="clip-delete" data-idx="${i}" title="Sil">${SVG_ICONS.trash}</button>
        </div>
      </div>`).join('');
}

function setupClipboardEventDelegation() {
    const list = $('#clipboard-list');
    if (!list) return;
    list.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const idx = parseInt(btn.dataset.idx);
        const action = btn.dataset.action;
        if (action === 'clip-copy') {
            if (state.clipboardHistory[idx]) {
                navigator.clipboard.writeText(state.clipboardHistory[idx].text);
                showToast('Panoya kopyalandı');
            }
        } else if (action === 'clip-delete') {
            state.clipboardHistory.splice(idx, 1);
            renderClipboardHistory();
        }
    });
}
