/* ── timer.js ── Pomodoro-style countdown timer ── */

function setupTimer() {
    $$('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (state.timerRunning) return;
            $$('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mins = parseInt(btn.dataset.minutes);
            state.timerTotal = mins * 60;
            state.timerRemaining = mins * 60;
            updateTimerDisplay();
        });
    });

    dom.timerStartBtn.addEventListener('click', () => {
        if (state.timerRunning) stopTimer();
        else startTimer();
    });

    updateTimerDisplay();
    setupGameMode();
}

function startTimer() {
    state.timerRunning = true;
    dom.timerStartBtn.textContent = 'Durdur';
    dom.timerStartBtn.classList.add('running');

    state.timerInterval = setInterval(() => {
        state.timerRemaining--;
        if (state.timerRemaining <= 0) {
            stopTimer();
            state.timerRemaining = state.timerTotal;
            new Notification('Dynamic Island', { body: 'Zamanlayıcı tamamlandı! ⏰', silent: false });
        }
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    state.timerRunning = false;
    clearInterval(state.timerInterval);
    dom.timerStartBtn.textContent = 'Başlat';
    dom.timerStartBtn.classList.remove('running');
}

function updateTimerDisplay() {
    const mins = Math.floor(state.timerRemaining / 60);
    const secs = state.timerRemaining % 60;
    dom.timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const circumference = 2 * Math.PI * 52;
    const progress = state.timerTotal > 0 ? state.timerRemaining / state.timerTotal : 1;
    const offset = circumference * (1 - progress);
    dom.timerRingFill.style.strokeDashoffset = offset;
}
