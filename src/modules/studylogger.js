/* ── studylogger.js ── StudyLogger UI, branch data, timer, polling ── */

// ── Branch Metadata ──
const BRANCH_META = {
    turkce:        { label: 'TYT Türkçe',    examType: 'tyt', ideal: 2700, warn: 2100 },
    tyt_matematik: { label: 'TYT Matematik',  examType: 'tyt', ideal: 4500, warn: 3300 },
    tyt_geometri:  { label: 'TYT Geometri',   examType: 'tyt', ideal: 1200, warn:  900 },
    tyt_fizik:     { label: 'TYT Fizik',      examType: 'tyt', ideal:  420, warn:  300 },
    tyt_kimya:     { label: 'TYT Kimya',      examType: 'tyt', ideal:  300, warn:  240 },
    tyt_biyoloji:  { label: 'TYT Biyoloji',   examType: 'tyt', ideal:  240, warn:  180 },
    tarih:         { label: 'TYT Tarih',      examType: 'tyt', ideal:  600, warn:  480 },
    cografya:      { label: 'TYT Coğrafya',   examType: 'tyt', ideal:  600, warn:  480 },
    felsefe:       { label: 'TYT Felsefe',    examType: 'tyt', ideal:  300, warn:  240 },
    din:           { label: 'TYT Din',        examType: 'tyt', ideal:  300, warn:  240 },
    ayt_matematik: { label: 'AYT Matematik',  examType: 'ayt', ideal: 5400, warn: 4200 },
    ayt_geometri:  { label: 'AYT Geometri',   examType: 'ayt', ideal: 1800, warn: 1200 },
    ayt_fizik:     { label: 'AYT Fizik',      examType: 'ayt', ideal: 1200, warn:  900 },
    ayt_kimya:     { label: 'AYT Kimya',      examType: 'ayt', ideal: 1200, warn:  900 },
    ayt_biyoloji:  { label: 'AYT Biyoloji',   examType: 'ayt', ideal:  900, warn:  660 },
};

// ── Subject Topics ──
const SUBJECT_TOPICS = {
    turkce:        ['Sözcükte Anlam','Cümlede Anlam','Paragrafta Anlam','Ses Bilgisi','Yazım Kuralları','Noktalama İşaretleri','Sözcük Türleri','Fiiller','Fiilimsiler','Sözcükte Yapı ve Ekler','Cümlenin Ögeleri','Cümle Türleri','Anlatım Bozuklukları'],
    tyt_matematik: ['Temel Kavramlar','Sayı Basamakları','Bölme ve Bölünebilme Kuralları','EBOB - EKOK','Rasyonel Sayılar','Basit Eşitsizlikler','Mutlak Değer','Üslü Sayılar','Köklü Sayılar','Çarpanlara Ayırma','Oran ve Orantı','Denklem Çözme','Problemler','Kümeler','Kartezyen Çarpım','Mantık','Fonksiyonlar','Polinomlar','İkinci Dereceden Denklemler','Permütasyon, Kombinasyon, Olasılık','Veri ve İstatistik'],
    tyt_geometri:  ['Doğruda Açılar','Üçgende Açılar','Dik ve Özel Üçgenler','Dik Üçgende Trigonometrik Bağıntılar','İkizkenar ve Eşkenar Üçgen','Üçgende Açıortay ve Kenarortay','Üçgende Eşlik ve Benzerlik','Üçgende Alan','Üçgende Açı - Kenar Bağıntıları','Çokgenler','Dörtgenler ve Özel Dörtgenler','Çemberde Açı ve Uzunluk','Dairede Çevre ve Alan','Katı Cisimler','Analitik Geometri'],
    tyt_fizik:     ['Fizik Bilimine Giriş','Madde ve Özellikleri','Hareket ve Kuvvet','İş, Güç ve Enerji','Isı, Sıcaklık ve Genleşme','Elektrostatik','Elektrik Akımı ve Devreler','Manyetizma','Basınç','Kaldırma Kuvveti','Dalgalar','Optik'],
    tyt_kimya:     ['Kimya Bilimi','Atom ve Periyodik Sistem','Kimyasal Türler Arası Etkileşimler','Maddenin Hâlleri','Doğa ve Kimya','Kimyanın Temel Kanunları ve Kimyasal Hesaplamalar','Karışımlar','Asitler, Bazlar ve Tuzlar','Kimya Her Yerde'],
    tyt_biyoloji:  ['Yaşam Bilimi Biyoloji','Hücre ve Organelleri','Canlıların Dünyası','Hücre Bölünmeleri','Kalıtımın Genel İlkeleri','Ekosistem Ekolojisi ve Güncel Çevre Sorunları'],
    tarih:         ['Tarih ve Zaman','İnsanlığın İlk Dönemleri','Orta Çağ\'da Dünya','İlk ve Orta Çağlarda Türk Dünyası','İslam Medeniyetinin Doğuşu','Türklerin İslamiyet\'i Kabulü ve İlk Türk İslam Devletleri','Yerleşme ve Devletleşme Sürecinde Selçuklu Türkiyesi','Beylikten Devlete Osmanlı Siyaseti ve Medeniyeti','Dünya Gücü Osmanlı','Değişim Çağında Avrupa ve Osmanlı','Uluslararası İlişkilerde Denge Stratejisi','XX. Yüzyıl Başlarında Osmanlı Devleti ve Dünya','Millî Mücadele','Atatürkçülük ve Türk İnkılabı'],
    cografya:      ['Doğa ve İnsan','Dünya\'nın Şekli ve Hareketleri','Coğrafi Konum','Harita Bilgisi','İklim Bilgisi','Dünya\'nın Tektonik Oluşumu, İç ve Dış Kuvvetler','Su, Toprak ve Bitki Varlığı','Nüfus, Göç ve Yerleşme','Türkiye\'nin Nüfusu ve Yerleşmesi','Ekonomik Faaliyetler','Bölgeler ve Ülkeler','Doğal Afetler'],
    felsefe:       ['Felsefeyi Tanıma','Felsefeyle Düşünme','Varlık Felsefesi','Bilgi Felsefesi','Bilim Felsefesi','Ahlak Felsefesi','Din Felsefesi','Siyaset Felsefesi','Sanat Felsefesi','Felsefe Tarihi'],
    din:           ['İnanç','İbadet','Ahlak ve Değerler','Din, Kültür ve Medeniyet','Hz. Muhammed','Vahiy ve Akıl','İslam Düşüncesinde Yorumlar'],
    ayt_matematik: ['Fonksiyonlarda Uygulamalar','İkinci Dereceden Fonksiyonlar ve Grafikleri','İkinci Dereceden İki Bilinmeyenli Denklem Sistemleri','İkinci Dereceden Eşitsizlikler ve Eşitsizlik Sistemleri','Karmaşık Sayılar','Logaritma','Diziler','Trigonometri','Limit ve Süreklilik','Türev','İntegral','Permütasyon, Kombinasyon, Binom, Olasılık'],
    ayt_geometri:  ['Üçgenler (İleri Düzey)','Çokgenler ve Dörtgenler','Katı Cisimler','Çember ve Daire (İleri Düzey)','Doğrunun Analitik İncelenmesi','Çemberin Analitik İncelenmesi','Dönüşüm Geometrisi'],
    ayt_fizik:     ['Vektörler','Bağıl Hareket','Newton\'un Hareket Yasaları','Bir Boyutta Sabit İvmeli Hareket (Atışlar)','İki Boyutta Hareket','Enerji ve Hareket','İtme ve Çizgisel Momentum','Tork','Denge ve Kütle Merkezi','Basit Makineler','Elektriksel Kuvvet ve Elektrik Alan','Elektriksel Potansiyel','Düzgün Elektrik Alan ve Sığa','Manyetizma ve Elektromanyetik İndüklenme','Alternatif Akım','Transformatörler','Çembersel Hareket','Dönerek Öteleme Hareketi ve Açısal Momentum','Kütle Çekim Kuvveti ve Kepler Yasaları','Basit Harmonik Hareket','Dalga Mekaniği','Atom Fiziğine Giriş ve Radyoaktivite','Modern Fizik','Modern Fiziğin Teknolojideki Uygulamaları'],
    ayt_kimya:     ['Modern Atom Teorisi','Gazlar','Sıvı Çözeltiler ve Çözünürlük','Kimyasal Tepkimelerde Enerji','Kimyasal Tepkimelerde Hız','Kimyasal Tepkimelerde Denge','Asit-Baz Dengesi','Çözünürlük Dengesi','Kimya ve Elektrik','Karbon Kimyasına Giriş','Organik Kimya','Enerji Kaynakları ve Bilimsel Gelişmeler'],
    ayt_biyoloji:  ['Sinir Sistemi','Endokrin Sistem','Duyu Organları','Destek ve Hareket Sistemi','Sindirim Sistemi','Dolaşım ve Lenf Sistemi','Bağışıklık Sistemi','Solunum Sistemi','Üriner Sistem','Üreme Sistemi ve Embriyonik Gelişim','Komünite ve Popülasyon Ekolojisi','Genden Proteine','Canlılarda Enerji Dönüşümleri','Bitki Biyolojisi','Canlılar ve Çevre'],
};

// ── Helpers ──
function populateTopicSelect(subjectId) {
    const topicSel = $('#sl-topic');
    if (!topicSel) return;
    const topics = SUBJECT_TOPICS[subjectId] || [];
    topicSel.innerHTML = topics.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
}

function slFormatClock(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function slGetElapsed() {
    const t = state.slTimer;
    if (t.status === 'running' && t.lastPollAt !== null) {
        return t.lastPollElapsed + Math.floor((Date.now() - t.lastPollAt) / 1000);
    }
    return t.lastPollElapsed || 0;
}

function slGetColor(elapsed, branchKey) {
    const meta = BRANCH_META[branchKey];
    if (!meta) return '#14b8a6';
    if (elapsed < meta.warn) return '#14b8a6';
    if (elapsed < meta.ideal) return '#f59e0b';
    return '#ef4444';
}

// ── Polling ──
function startSlPolling() {
    stopSlPolling();
    slPollCycle();
}

function stopSlPolling() {
    if (state.slPollTimer) { clearTimeout(state.slPollTimer); state.slPollTimer = null; }
    if (state.slSmoothInterval) { clearInterval(state.slSmoothInterval); state.slSmoothInterval = null; }
}

async function slPollCycle() {
    if (!state.slApi.connected) return;
    try {
        const res = await window.api.studyLogger.pollTimer();
        if (res.ok && res.data) {
            const d = res.data;
            state.slTimer.status = d.status || 'idle';
            state.slTimer.branchKey = d.branchKey || null;
            state.slTimer.lastPollElapsed = d.elapsed || 0;
            state.slTimer.lastPollAt = Date.now();
            updateSlTimerPanel();
            updateSlCollapsedPill();
            if (d.status === 'running') {
                if (!state.slSmoothInterval) {
                    state.slSmoothInterval = setInterval(() => {
                        updateSlTimerPanel();
                        updateSlCollapsedPill();
                    }, 250);
                }
            } else {
                if (state.slSmoothInterval) { clearInterval(state.slSmoothInterval); state.slSmoothInterval = null; }
            }
        } else if (res.error === '401') {
            state.slApi.connected = false;
            updateSlApiStatus(false, 'Token hatalı – Bağlan sekmesini kontrol edin');
            stopSlPolling();
            return;
        }
    } catch {}

    const delay = state.slTimer.status === 'running' ? 3000
               : state.slTimer.status === 'paused'   ? 6000
               : 12000;
    state.slPollTimer = setTimeout(slPollCycle, delay);
}

// ── Stats ──
async function slFetchStats() {
    if (!state.slApi.connected) return;
    try {
        const res = await window.api.studyLogger.getStats();
        if (res.ok && res.data) {
            state.slStats = res.data;
            updateSlStatsBar();
        }
    } catch {}
}

// ── Timer Panel UI ──
function updateSlTimerPanel() {
    const container = $('#sl-live-timer');
    if (!container) return;
    const t = state.slTimer;
    const elapsed = slGetElapsed();
    const color = slGetColor(elapsed, t.branchKey);
    const meta = BRANCH_META[t.branchKey] || {};
    const label = meta.label || (t.branchKey || '');

    if (t.status === 'idle') {
        container.className = 'sl-live-timer sl-state-idle';
        if (state.slApi.connected) {
            const svgPlayStart = '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" style="vertical-align:-1px"><polygon points="5,3 19,12 5,21"/></svg>';
            const branchOpts = Object.entries(BRANCH_META)
                .map(([k, v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`)
                .join('');
            container.innerHTML = `
                <div class="sl-start-form">
                    <select class="sl-select sl-branch-sel" id="sl-start-branch">${branchOpts}</select>
                    <button class="sl-act-btn sl-act-start" id="sl-act-start">${svgPlayStart} Başlat</button>
                </div>`;
            const startBtn = $('#sl-act-start');
            if (startBtn) {
                startBtn.addEventListener('click', async () => {
                    startBtn.disabled = true;
                    const branchEl = $('#sl-start-branch');
                    const branchKey = branchEl ? branchEl.value : 'turkce';
                    const res = await window.api.studyLogger.controlTimer({ action: 'start', branchKey, accumulatedSeconds: 0 });
                    if (res.ok) {
                        state.slTimer.status = 'running';
                        state.slTimer.branchKey = branchKey;
                        state.slTimer.lastPollElapsed = 0;
                        state.slTimer.lastPollAt = Date.now();
                        updateSlTimerPanel();
                        updateSlCollapsedPill();
                        if (!state.slSmoothInterval) {
                            state.slSmoothInterval = setInterval(() => {
                                updateSlTimerPanel();
                                updateSlCollapsedPill();
                            }, 250);
                        }
                    } else {
                        showToast('Timer başlatılamadı: ' + (res.error || 'hata'));
                        startBtn.disabled = false;
                    }
                });
            }
        } else {
            container.innerHTML = `
                <div class="sl-idle-hint">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    <span>Timer bekleniyor</span>
                </div>`;
        }
        return;
    }

    const svgPlay  = '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" style="vertical-align:-1px"><polygon points="5,3 19,12 5,21"/></svg>';
    const svgPause = '<svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" style="vertical-align:-1px"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    const svgSave  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13" style="vertical-align:-1px"><path d="M20 6L9 17l-5-5"/></svg>';
    const svgClose = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13" style="vertical-align:-1px"><path d="M18 6L6 18M6 6l12 12"/></svg>';
    const statusIcon = t.status === 'running' ? svgPlay : svgPause;
    const pulse = t.status === 'running' ? 'sl-timer-running' : 'sl-timer-paused';

    container.className = `sl-live-timer ${pulse}`;
    container.innerHTML = `
        <div class="sl-timer-clock" style="color:${color}">${statusIcon} ${slFormatClock(elapsed)}</div>
        <div class="sl-timer-branch">${escapeHtml(label)}</div>
        <div class="sl-timer-actions">
            ${t.status === 'running'
                ? `<button class="sl-act-btn sl-act-pause" id="sl-act-pause">${svgPause} Duraklat</button>`
                : `<button class="sl-act-btn sl-act-resume" id="sl-act-resume">${svgPlay} Devam</button>
                   <button class="sl-act-btn sl-act-save" id="sl-act-save">${svgSave} Deneme Kaydet</button>`}
            <button class="sl-act-btn sl-act-reset" id="sl-act-reset">${svgClose} Sıfırla</button>
        </div>`;

    const pauseBtn = $('#sl-act-pause');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', async () => {
            pauseBtn.disabled = true;
            const res = await window.api.studyLogger.controlTimer('pause');
            if (res.ok) {
                state.slTimer.lastPollElapsed = slGetElapsed();
                state.slTimer.lastPollAt = null;
                state.slTimer.status = 'paused';
                if (state.slSmoothInterval) { clearInterval(state.slSmoothInterval); state.slSmoothInterval = null; }
                updateSlTimerPanel();
                updateSlCollapsedPill();
            } else { showToast('Duraklat başarısız'); }
        });
    }
    const resumeBtn = $('#sl-act-resume');
    if (resumeBtn) {
        resumeBtn.addEventListener('click', async () => {
            resumeBtn.disabled = true;
            const res = await window.api.studyLogger.controlTimer('resume');
            if (res.ok) {
                state.slTimer.lastPollElapsed = slGetElapsed();
                state.slTimer.lastPollAt = Date.now();
                state.slTimer.status = 'running';
                if (!state.slSmoothInterval) {
                    state.slSmoothInterval = setInterval(() => {
                        updateSlTimerPanel();
                        updateSlCollapsedPill();
                    }, 250);
                }
                updateSlTimerPanel();
                updateSlCollapsedPill();
            } else { showToast('Devam ettirilemedi'); resumeBtn.disabled = false; }
        });
    }
    const saveBtn = $('#sl-act-save');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const elapsed2 = slGetElapsed();
            const mins = Math.max(1, Math.round(elapsed2 / 60));
            const meta2 = BRANCH_META[t.branchKey] || {};
            const examType2 = meta2.examType || 'tyt';
            const svgSave2  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13" style="vertical-align:-1px"><path d="M20 6L9 17l-5-5"/></svg>';
            const svgClose2 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13" style="vertical-align:-1px"><path d="M18 6L6 18M6 6l12 12"/></svg>';
            const actionsDiv = container.querySelector('.sl-timer-actions');
            if (!actionsDiv) return;
            actionsDiv.innerHTML = `
                <div class="sl-deneme-form">
                    <label class="sl-label" style="font-size:0.78rem;margin-bottom:4px;display:block">Net (${escapeHtml(meta2.label || '')})</label>
                    <input type="number" class="sl-input" id="sl-deneme-net"
                           placeholder="ör. 14.25" step="0.25" min="-999" max="999"
                           style="width:100%;margin-bottom:6px">
                    <div class="sl-timer-actions" style="margin-top:0">
                        <button class="sl-act-btn sl-act-confirm-exam" id="sl-confirm-exam">${svgSave2} Kaydet</button>
                        <button class="sl-act-btn sl-act-cancel-exam" id="sl-cancel-exam">${svgClose2} İptal</button>
                    </div>
                </div>`;
            const netInput = $('#sl-deneme-net');
            if (netInput) setTimeout(() => netInput.focus(), 50);
            const cancelExam = $('#sl-cancel-exam');
            if (cancelExam) cancelExam.addEventListener('click', () => updateSlTimerPanel());
            const confirmExam = $('#sl-confirm-exam');
            if (confirmExam) {
                confirmExam.addEventListener('click', async () => {
                    const ni = $('#sl-deneme-net');
                    const netVal = ni ? parseFloat(ni.value) : NaN;
                    if (isNaN(netVal)) { showToast('Geçerli bir net girin'); return; }
                    confirmExam.disabled = true;
                    const today = new Date().toISOString().split('T')[0];
                    const result = await window.api.studyLogger.logExamApi({
                        examType: examType2,
                        examCategory: 'brans',
                        subject: t.branchKey,
                        net: netVal,
                        durationMinutes: mins,
                        date: today,
                    });
                    if (result.ok) {
                        await window.api.studyLogger.controlTimer('reset');
                        stopSlPolling();
                        state.slTimer = { status: 'idle', branchKey: null, lastPollElapsed: 0, lastPollAt: null };
                        updateSlTimerPanel();
                        updateSlCollapsedPill();
                        slFetchStats();
                        startSlPolling();
                        showToast('Deneme kaydedildi!');
                    } else {
                        showToast('Kayıt hatası: ' + (result.error || 'bilinmeyen'));
                        confirmExam.disabled = false;
                    }
                });
            }
        });
    }
    const resetBtn = $('#sl-act-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            resetBtn.disabled = true;
            const res = await window.api.studyLogger.controlTimer('reset');
            if (res.ok) {
                stopSlPolling();
                state.slTimer = { status: 'idle', branchKey: null, lastPollElapsed: 0, lastPollAt: null };
                updateSlTimerPanel();
                updateSlCollapsedPill();
                slFetchStats();
                startSlPolling();
            } else {
                showToast(res.error === '404' ? 'Aktif oturum yok' : 'Sıfırlama başarısız');
            }
        });
    }
}

// ── Collapsed Pill ──
function updateSlCollapsedPill() {
    const pill = $('#sl-mini');
    if (!pill) return;
    const t = state.slTimer;
    const clock = dom.clock;
    const mediaMini = dom.mediaMini;

    if (t.status === 'idle') {
        pill.style.display = 'none';
        if (clock) clock.classList.remove('hidden');
        if (mediaMini && !mediaMini.classList.contains('active')) mediaMini.style.display = '';
        return;
    }

    const elapsed = slGetElapsed();
    const color = slGetColor(elapsed, t.branchKey);
    const meta = BRANCH_META[t.branchKey] || {};
    const short = (meta.label || '').replace('TYT ', '').replace('AYT ', 'A.');

    if (clock) clock.classList.add('hidden');
    if (mediaMini) mediaMini.style.display = 'none';

    pill.style.display = 'flex';
    const iconEl = $('#sl-mini-icon');
    const timeEl = $('#sl-mini-time');
    const branchEl = $('#sl-mini-branch');
    if (iconEl) {
        iconEl.innerHTML = t.status === 'running'
            ? '<svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><polygon points="5,3 19,12 5,21"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
        iconEl.style.color = color;
    }
    if (timeEl) { timeEl.textContent = slFormatClock(elapsed); timeEl.style.color = color; }
    if (branchEl) branchEl.textContent = short ? `· ${short}` : '';
}

// ── Stats Bar ──
function updateSlStatsBar() {
    const el = $('#sl-stats-inline');
    if (!el || !state.slStats) return;
    const { todayMinutes, todayQuestions, displayName } = state.slStats;
    const name = displayName ? `${escapeHtml(displayName)} · ` : '';
    el.textContent = `${name}📚 ${todayMinutes ?? 0}dk · ${todayQuestions ?? 0} soru`;
}

// ── API Status ──
function updateSlApiStatus(connected, label) {
    const bar = $('#sl-status-bar');
    const text = $('#sl-status-text');
    const connectBtn = $('#sl-connect-btn');
    const disconnectBtn = $('#sl-disconnect-btn');
    if (bar) bar.classList.toggle('sl-connected', connected);
    if (text) text.textContent = label || (connected ? 'Bağlı' : 'Bağlantı yok');
    if (connectBtn) connectBtn.style.display = connected ? 'none' : '';
    if (disconnectBtn) disconnectBtn.style.display = connected ? '' : 'none';
}

// ── Setup ──
function setupStudyLogger() {
    const webBtn = $('#act-studylogger-web');
    if (webBtn) webBtn.addEventListener('click', () => window.api.openUrl('https://studyloggeryks.vercel.app/'));

    $$('[data-sl-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.slTab;
            $$('[data-sl-tab]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            $$('#panel-studylogger .tab-content').forEach(t => t.classList.remove('active'));
            const tab = $(`#${tabId}`);
            if (tab) tab.classList.add('active');
        });
    });

    const subjectSel = $('#sl-subject');
    if (subjectSel) {
        populateTopicSelect(subjectSel.value);
        subjectSel.addEventListener('change', () => populateTopicSelect(subjectSel.value));
    }

    const connectBtn = $('#sl-connect-btn');
    if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
            const baseUrl = 'https://studyloggeryks.vercel.app';
            const token = ($('#sl-token-input') || {}).value?.trim() || '';
            if (!token) { showToast('Token alanını doldurun'); return; }
            connectBtn.disabled = true;
            connectBtn.textContent = 'Bağlanıyor...';
            try {
                const signInResult = await window.api.studyLogger.signIn(token);
                if (!signInResult.ok) {
                    showToast(signInResult.error === 'expired'
                        ? 'Token süresi dolmuş. Ayarlar sayfasından yeni token oluşturun.'
                        : 'Giriş yapılamadı: ' + (signInResult.error || 'Bilinmeyen hata'));
                    return;
                }
                const uid = signInResult.uid;
                const uidEl = $('#sl-uid-input');
                if (uidEl) uidEl.value = uid;
                const saved = await window.api.studyLogger.saveApiConfig({ baseUrl });
                if (!saved.ok) { showToast('Yapılandırma kaydedilemedi'); return; }
                const test = await window.api.studyLogger.pollTimer();
                if (test.error === '401') { showToast('Bağlantı doğrulanamadı (401). Yeniden deneyin.'); return; }
                state.slApi.connected = true;
                updateSlApiStatus(true);
                showToast('StudyLogger bağlantısı kuruldu');
                $$('[data-sl-tab]').forEach(b => b.classList.remove('active'));
                const timerBtn = $('[data-sl-tab="sl-timer-tab"]');
                if (timerBtn) timerBtn.classList.add('active');
                $$('#panel-studylogger .tab-content').forEach(t => t.classList.remove('active'));
                const timerTab = $('#sl-timer-tab');
                if (timerTab) timerTab.classList.add('active');
                startSlPolling();
                slFetchStats();
            } catch {
                showToast('Bağlantı kurulamadı');
            } finally {
                connectBtn.disabled = false;
                connectBtn.textContent = 'Bağlan';
            }
        });
    }

    const disconnectBtn = $('#sl-disconnect-btn');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', async () => {
            await window.api.studyLogger.saveApiConfig({ baseUrl: '' });
            await window.api.studyLogger.clearToken();
            state.slApi.connected = false;
            stopSlPolling();
            state.slTimer = { status: 'idle', branchKey: null, lastPollElapsed: 0, lastPollAt: null };
            state.slStats = null;
            updateSlApiStatus(false);
            updateSlTimerPanel();
            updateSlCollapsedPill();
            updateSlStatsBar();
            showToast('Bağlantı kesildi');
        });
    }

    const submitBtn = $('#sl-submit');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            if (!state.slApi.connected) { showToast('Önce StudyLogger\'a bağlanın (Bağlan sekmesi)'); return; }
            const subject     = ($('#sl-subject')   || {}).value || '';
            const topic       = ($('#sl-topic')     || {}).value || '';
            const durationRaw  = parseInt(($('#sl-duration')  || {}).value || '0');
            const questionsRaw = parseInt(($('#sl-questions') || {}).value || '0');
            if (!topic)                       { showToast('Konu seçin'); return; }
            if (!durationRaw || durationRaw < 1) { showToast('Geçerli bir süre girin'); return; }
            submitBtn.disabled = true;
            submitBtn.textContent = 'Kaydediliyor...';
            try {
                const result = await window.api.studyLogger.logSessionApi({
                    subject, topic, durationMinutes: durationRaw,
                    questionCount: isNaN(questionsRaw) ? 0 : questionsRaw,
                });
                if (result.ok) {
                    showToast('Çalışma kaydedildi!');
                    if ($('#sl-duration'))  $('#sl-duration').value  = '';
                    if ($('#sl-questions')) $('#sl-questions').value = '';
                    slFetchStats();
                } else if (result.error === '401') {
                    state.slApi.connected = false;
                    updateSlApiStatus(false, 'Token hatalı – yeniden bağlanın');
                    showToast('Yetki hatası (401). Bağlan sekmesinden yeniden bağlanın.');
                } else {
                    showToast('Kayıt hatası: ' + (result.error || 'Bilinmeyen hata'));
                }
            } catch {
                showToast('Kayıt gönderilemedi');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Kaydet';
            }
        });
    }
}

function updateStudyLoggerStatus(connected) {
    updateSlApiStatus(connected);
}

async function loadStudyLoggerPanel() {
    try {
        const cfg = await window.api.studyLogger.getApiConfig();
        const fbCfg = await window.api.studyLogger.getConfig();
        if (cfg && cfg.baseUrl && fbCfg && fbCfg.customToken) {
            state.slApi.connected = true;
            updateSlApiStatus(true);
            startSlPolling();
            slFetchStats();
            const uidEl = $('#sl-uid-input');
            if (uidEl) uidEl.value = fbCfg.firebaseUid || '';
        } else {
            updateSlApiStatus(false);
        }
    } catch {
        updateSlApiStatus(false);
    }
    updateSlTimerPanel();
}
