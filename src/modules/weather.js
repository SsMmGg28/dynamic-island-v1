/* ── weather.js ── Weather fetching and rendering ── */

async function loadWeather() {
    dom.weatherBody.innerHTML = '<div class="weather-loading">Hava durumu yükleniyor...</div>';
    try {
        if (!state.weatherLocation) {
            state.weatherLocation = await window.api.getLocation();
        }
        if (!state.weatherLocation || !state.weatherLocation.lat) {
            dom.weatherBody.innerHTML = '<div class="weather-loading">Konum belirlenemedi</div>';
            return;
        }
        const data = await window.api.getWeather(state.weatherLocation.lat, state.weatherLocation.lon);
        if (data && data.current) {
            state.weather = data.current;
            renderWeather();
        } else {
            dom.weatherBody.innerHTML = '<div class="weather-loading">Veri alınamadı</div>';
        }
    } catch {
        dom.weatherBody.innerHTML = '<div class="weather-loading">Hava durumu yüklenemedi</div>';
    }
}

function renderWeather() {
    const w = state.weather;
    const loc = state.weatherLocation;
    const icon = getWeatherIcon(w.weather_code);
    const condition = getWeatherCondition(w.weather_code);
    dom.weatherBody.innerHTML = `
        <div class="weather-main">
            <span class="weather-icon">${icon}</span>
            <div>
                <div class="weather-temp">${Math.round(w.temperature_2m)}°</div>
                <div class="weather-condition">${condition}</div>
            </div>
        </div>
        <div class="weather-details">
            <span class="weather-extra">${SVG_ICONS.humidity} Nem: ${w.relative_humidity_2m || '—'}%</span>
            <span class="weather-extra">${SVG_ICONS.wind} Rüzgar: ${w.wind_speed_10m || '—'} km/s</span>
        </div>
        <div class="weather-city">${escapeHtml(loc.city || '')}, ${escapeHtml(loc.country || '')}</div>
        <button class="weather-refresh" id="weather-refresh">${SVG_ICONS.refresh} Yenile</button>
    `;
    const refreshBtn = $('#weather-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            state.weatherLocation = null;
            loadWeather();
        });
    }
}

function getWeatherIcon(code) {
    if (code === 0) return SVG_ICONS.sun;
    if (code <= 3) return SVG_ICONS.partcloud;
    if (code <= 48) return SVG_ICONS.fog;
    if (code <= 55) return SVG_ICONS.drizzle;
    if (code <= 65) return SVG_ICONS.rain;
    if (code <= 77) return SVG_ICONS.snow;
    if (code <= 82) return SVG_ICONS.rain;
    if (code <= 99) return SVG_ICONS.thunder;
    return SVG_ICONS.variable;
}

function getWeatherCondition(code) {
    if (code === 0) return 'Açık';
    if (code <= 3) return 'Parçalı Bulutlu';
    if (code <= 48) return 'Sisli';
    if (code <= 55) return 'Çisenti';
    if (code <= 65) return 'Yağmurlu';
    if (code <= 77) return 'Karlı';
    if (code <= 82) return 'Sağanak';
    if (code <= 99) return 'Gök Gürültülü';
    return 'Değişken';
}
