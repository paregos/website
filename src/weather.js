const SYDNEY_TIME_ZONE = 'Australia/Sydney';
const WEATHER_REFRESH_MS = 15 * 60 * 1000;
const WEATHER_CACHE_KEY = 'ben-mitchell-sydney-weather-v1';
const WEATHER_OVERRIDE_KEY = 'ben-mitchell-weather-override-v1';
const WEATHER_API = new URL('https://api.open-meteo.com/v1/forecast');

WEATHER_API.search = new URLSearchParams({
  latitude: '-33.8688',
  longitude: '151.2093',
  current: [
    'temperature_2m',
    'weather_code',
    'is_day',
    'precipitation',
    'cloud_cover',
    'wind_speed_10m',
    'wind_direction_10m',
  ].join(','),
  timezone: SYDNEY_TIME_ZONE,
}).toString();

const clock = document.querySelector('[data-sydney-clock]');
const conditions = document.querySelector('[data-conditions]');
const weatherIcon = document.querySelector('[data-weather-icon]');
const weatherCanvas = document.querySelector('[data-weather-canvas]');
const weatherSwitcher = document.querySelector('[data-weather-switcher]');
const weatherOptions = document.querySelector('[data-weather-options]');

const clockFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: SYDNEY_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const hourFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: SYDNEY_TIME_ZONE,
  hour: 'numeric',
  hourCycle: 'h23',
});

let currentWeather = null;
let liveWeather = null;
let activeOverride = null;

const WEATHER_PRESETS = [
  { id: 'live', key: '0', name: 'Live weather', weather: null },
  {
    id: 'clear-day',
    key: '1',
    name: 'Clear day',
    weather: {
      kind: 'clear', code: 0, label: 'Clear', temperature: 24, isDay: true,
      precipitation: 0, cloudCover: 0, windSpeed: 7, windDirection: 90,
    },
  },
  {
    id: 'clear-night',
    key: '2',
    name: 'Clear night',
    weather: {
      kind: 'clear', code: 0, label: 'Clear night', temperature: 16, isDay: false,
      precipitation: 0, cloudCover: 0, windSpeed: 4, windDirection: 120,
    },
  },
  {
    id: 'partly',
    key: '3',
    name: 'Partly cloudy',
    weather: {
      kind: 'partly', code: 2, label: 'Partly cloudy', temperature: 21, isDay: true,
      precipitation: 0, cloudCover: 55, windSpeed: 12, windDirection: 110,
    },
  },
  {
    id: 'overcast',
    key: '4',
    name: 'Overcast',
    weather: {
      kind: 'overcast', code: 3, label: 'Overcast', temperature: 17, isDay: true,
      precipitation: 0, cloudCover: 100, windSpeed: 8, windDirection: 170,
    },
  },
  {
    id: 'rain',
    key: '5',
    name: 'Rain',
    weather: {
      kind: 'rain', code: 61, label: 'Rain', temperature: 15, isDay: true,
      precipitation: 1.4, cloudCover: 95, windSpeed: 18, windDirection: 145,
    },
  },
  {
    id: 'storm',
    key: '6',
    name: 'Thunderstorm',
    weather: {
      kind: 'storm', code: 95, label: 'Thunderstorm', temperature: 22, isDay: true,
      precipitation: 4, cloudCover: 100, windSpeed: 32, windDirection: 215,
    },
  },
  {
    id: 'fog',
    key: '7',
    name: 'Fog',
    weather: {
      kind: 'fog', code: 45, label: 'Foggy', temperature: 12, isDay: false,
      precipitation: 0, cloudCover: 100, windSpeed: 2, windDirection: 40,
    },
  },
  {
    id: 'windy',
    key: '8',
    name: 'Windy',
    weather: {
      kind: 'windy', code: 1, label: 'Windy', temperature: 19, isDay: true,
      precipitation: 0, cloudCover: 30, windSpeed: 45, windDirection: 190,
    },
  },
  {
    id: 'hot',
    key: '9',
    name: 'Hot',
    weather: {
      kind: 'clear', code: 0, label: 'Hot and clear', temperature: 36, isDay: true,
      precipitation: 0, cloudCover: 0, windSpeed: 10, windDirection: 75,
    },
  },
  {
    id: 'snow',
    key: 's',
    name: 'Snow',
    weather: {
      kind: 'snow', code: 73, label: 'Snow', temperature: 1, isDay: false,
      precipitation: 0.6, cloudCover: 100, windSpeed: 10, windDirection: 250,
    },
  },
];

function updateSydneyClock() {
  const now = new Date();
  const time = clockFormatter.format(now);
  const hour = Number(hourFormatter.format(now));

  if (clock) {
    clock.textContent = time;
    clock.dateTime = now.toISOString();
  }

  document.body.dataset.time = getTimePhase(hour);
  updateConditionsLabel(time);
}

function getTimePhase(hour) {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

function classifyWeather(code) {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain';
  if (code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'clear';
}

function describeWeather(kind, code) {
  if (kind === 'clear') return 'Clear';
  if (kind === 'partly') return 'Partly cloudy';
  if (kind === 'overcast') return 'Overcast';
  if (kind === 'fog') return 'Foggy';
  if (kind === 'snow') return code >= 85 ? 'Snow showers' : 'Snow';
  if (kind === 'storm') return code >= 96 ? 'Thunderstorm with hail' : 'Thunderstorm';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 80 && code <= 82) return 'Rain showers';
  return 'Rain';
}

function getWeatherIcon(kind, isDay) {
  if (kind === 'clear') return isDay ? '○' : '☾';
  if (kind === 'partly') return isDay ? '◒' : '◐';
  if (kind === 'overcast') return '●';
  if (kind === 'fog') return '≋';
  if (kind === 'rain') return '╱';
  if (kind === 'storm') return 'ϟ';
  if (kind === 'snow') return '✣';
  if (kind === 'windy') return '⌁';
  return '·';
}

function updateConditionsLabel(time = clock?.textContent || '--:--') {
  if (!conditions) return;

  if (!currentWeather) {
    conditions.title = 'Sydney weather unavailable';
    conditions.setAttribute('aria-label', `${time} in Sydney. Weather unavailable.`);
    return;
  }

  const temperature = Math.round(currentWeather.temperature);
  const overrideNote = currentWeather.isOverride ? ' · override' : '';
  const detail = `${currentWeather.label} · ${temperature}°C · Sydney${overrideNote}`;
  conditions.title = detail;
  conditions.setAttribute(
    'aria-label',
    `${time} in Sydney. ${currentWeather.label}, ${temperature} degrees Celsius.${
      currentWeather.isOverride ? ' Weather override active.' : ''
    }`,
  );
}

function normaliseWeather(data) {
  const current = data?.current;
  if (!current || !Number.isFinite(current.weather_code)) {
    throw new Error('Weather response did not include current conditions');
  }

  const kind = classifyWeather(current.weather_code);

  return {
    kind,
    code: current.weather_code,
    label: describeWeather(kind, current.weather_code),
    temperature: Number(current.temperature_2m) || 0,
    isDay: current.is_day === 1,
    precipitation: Number(current.precipitation) || 0,
    cloudCover: Number(current.cloud_cover) || 0,
    windSpeed: Number(current.wind_speed_10m) || 0,
    windDirection: Number(current.wind_direction_10m) || 0,
  };
}

function applyWeather(weather) {
  const completeWeather = {
    ...weather,
    label: weather.label || describeWeather(weather.kind, weather.code),
  };

  currentWeather = completeWeather;
  window.siteWeather = completeWeather;
  document.body.dataset.weather = completeWeather.kind;

  if (weatherIcon) {
    weatherIcon.textContent = getWeatherIcon(
      completeWeather.kind,
      completeWeather.isDay,
    );
  }

  updateConditionsLabel();
  ambientWeather?.setWeather(completeWeather);
  window.dispatchEvent(
    new CustomEvent('siteweatherchange', { detail: completeWeather }),
  );
}

function readCachedWeather() {
  try {
    const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY));
    if (!cached?.weather || !Number.isFinite(cached.savedAt)) return null;
    return cached;
  } catch {
    return null;
  }
}

function cacheWeather(weather) {
  try {
    localStorage.setItem(
      WEATHER_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), weather }),
    );
  } catch {
    // Weather caching is optional; the live result still works without it.
  }
}

async function fetchWeather() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(WEATHER_API, { signal: controller.signal });
    if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);

    const weather = normaliseWeather(await response.json());
    liveWeather = weather;
    cacheWeather(weather);
    if (!activeOverride) applyWeather(weather);
  } catch {
    if (!currentWeather && weatherIcon) weatherIcon.textContent = '·';
    updateConditionsLabel();
  } finally {
    clearTimeout(timeout);
  }
}

function readWeatherOverride() {
  try {
    const override = localStorage.getItem(WEATHER_OVERRIDE_KEY);
    return WEATHER_PRESETS.some((preset) => preset.id === override && preset.weather)
      ? override
      : null;
  } catch {
    return null;
  }
}

function saveWeatherOverride(override) {
  try {
    if (override) localStorage.setItem(WEATHER_OVERRIDE_KEY, override);
    else localStorage.removeItem(WEATHER_OVERRIDE_KEY);
  } catch {
    // The override still works for this page view when storage is unavailable.
  }
}

function selectWeatherOverride(preset) {
  if (!preset || preset.id === 'live') {
    activeOverride = null;
    saveWeatherOverride(null);
    if (liveWeather) applyWeather(liveWeather);
    else fetchWeather();
  } else {
    activeOverride = preset.id;
    saveWeatherOverride(activeOverride);
    applyWeather({ ...preset.weather, isOverride: true });
  }

  syncWeatherOptions();
  closeWeatherSwitcher();
}

function syncWeatherOptions() {
  if (!weatherOptions) return;
  const selectedId = activeOverride || 'live';

  for (const button of weatherOptions.querySelectorAll('button')) {
    button.setAttribute(
      'aria-selected',
      String(button.dataset.weatherPreset === selectedId),
    );
  }
}

function openWeatherSwitcher() {
  if (!weatherSwitcher || weatherSwitcher.open) return;
  const hotkeysCard = document.querySelector('[data-hotkeys-card]');
  const hotkeysTrigger = document.querySelector('[data-hotkeys-trigger]');
  const themeSwitcher = document.querySelector('[data-theme-switcher]');
  if (hotkeysCard?.open) hotkeysCard.close();
  if (themeSwitcher?.open) themeSwitcher.close();
  hotkeysTrigger?.setAttribute('aria-expanded', 'false');
  weatherSwitcher.show();
  syncWeatherOptions();

  const selected = weatherOptions?.querySelector('[aria-selected="true"]');
  const first = weatherOptions?.querySelector('button');
  (selected || first)?.focus();
}

function closeWeatherSwitcher() {
  if (weatherSwitcher?.open) weatherSwitcher.close();
}

function setupWeatherSwitcher() {
  if (!weatherSwitcher || !weatherOptions) return;

  let previousWeatherKeyTime = 0;

  weatherOptions.setAttribute('role', 'listbox');
  weatherOptions.setAttribute('aria-label', 'Weather override');

  for (const preset of WEATHER_PRESETS) {
    const button = document.createElement('button');
    const icon = document.createElement('span');
    const name = document.createElement('span');
    const key = document.createElement('span');

    button.type = 'button';
    button.dataset.weatherPreset = preset.id;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', 'false');
    icon.className = 'weather-option-icon';
    name.className = 'weather-option-name';
    key.className = 'weather-option-key';

    icon.textContent = preset.weather
      ? getWeatherIcon(preset.weather.kind, preset.weather.isDay)
      : '·';
    name.textContent = preset.name;
    key.textContent = preset.key.toUpperCase();

    button.append(icon, name, key);
    button.addEventListener('click', () => selectWeatherOverride(preset));
    weatherOptions.append(button);
  }

  weatherSwitcher.addEventListener('keydown', (event) => {
    const buttons = [...weatherOptions.querySelectorAll('button')];
    const currentIndex = buttons.indexOf(document.activeElement);

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (currentIndex + direction + buttons.length) % buttons.length;
      buttons[nextIndex].focus();
      return;
    }

    const preset = WEATHER_PRESETS.find(
      (option) => option.key === event.key.toLowerCase(),
    );
    if (preset) {
      event.preventDefault();
      selectWeatherOverride(preset);
    }
  });

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const isTyping =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable;

    const hasModifier = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
    if (
      !isTyping &&
      !hasModifier &&
      !event.repeat &&
      event.key.toLowerCase() === 'w'
    ) {
      const now = performance.now();
      const isDoublePress = now - previousWeatherKeyTime <= 420;
      previousWeatherKeyTime = now;

      if (isDoublePress) {
        event.preventDefault();
        previousWeatherKeyTime = 0;
        if (weatherSwitcher.open) closeWeatherSwitcher();
        else openWeatherSwitcher();
      }
      return;
    }

    if (event.key === 'Escape') closeWeatherSwitcher();
  });

  document.addEventListener('pointerdown', (event) => {
    if (weatherSwitcher.open && !weatherSwitcher.contains(event.target)) {
      closeWeatherSwitcher();
    }
  });
}

class AmbientWeather {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.weather = null;
    this.drops = [];
    this.flakes = [];
    this.stars = Array.from({ length: 5 }, () => ({
      x: Math.random(),
      y: Math.random(),
      phase: Math.random() * Math.PI * 2,
    }));
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.frameId = 0;
    this.lastPaint = 0;

    this.resize = this.resize.bind(this);
    this.draw = this.draw.bind(this);

    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop();
      else this.start();
    });
    this.motionPreference.addEventListener('change', () => this.start());
    this.resize();
  }

  setWeather(weather) {
    this.weather = weather;
    this.createParticles();
    this.start();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.createParticles();
    this.paint(performance.now(), 0);
  }

  createParticles() {
    if (!this.weather) return;

    const rainCount = this.weather.kind === 'storm'
      ? 14
      : Math.round(Math.min(12, 5 + this.weather.precipitation * 3));
    const snowCount = 26;

    this.drops = Array.from({ length: rainCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      length: 7 + Math.random() * 10,
      speed: 45 + Math.random() * 55,
    }));

    this.flakes = Array.from({ length: snowCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: 1 + Math.round(Math.random()),
      speed: 7 + Math.random() * 10,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  getFlowerRect() {
    const image = document.querySelector('[data-lily] img');
    if (!image) return null;

    const rect = image.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1 || rect.bottom < 0 || rect.top > this.height) {
      return null;
    }

    return rect;
  }

  clipToFlower(context, rect) {
    context.beginPath();
    context.rect(rect.left, rect.top, rect.width, rect.height);
    context.clip();
  }

  needsAnimation() {
    if (!this.weather) return false;
    const animatedKinds = ['partly', 'overcast', 'rain', 'storm', 'fog', 'snow'];
    return (
      animatedKinds.includes(this.weather.kind) ||
      (!this.weather.isDay && this.weather.kind === 'clear')
    );
  }

  start() {
    this.stop();
    this.paint(performance.now(), 0);

    if (
      !document.hidden &&
      !this.motionPreference.matches &&
      this.needsAnimation()
    ) {
      this.frameId = requestAnimationFrame(this.draw);
    }
  }

  stop() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.lastPaint = 0;
  }

  draw(time) {
    if (time - this.lastPaint < 40) {
      this.frameId = requestAnimationFrame(this.draw);
      return;
    }

    const delta = this.lastPaint
      ? Math.min((time - this.lastPaint) / 1000, 0.12)
      : 0;
    this.lastPaint = time;
    this.paint(time, delta);
    this.frameId = requestAnimationFrame(this.draw);
  }

  paint(time, delta) {
    const context = this.context;
    context.clearRect(0, 0, this.width, this.height);
    if (!this.weather) return;

    if (
      this.weather.kind === 'partly' ||
      this.weather.kind === 'overcast' ||
      this.weather.kind === 'storm'
    ) {
      this.drawClouds(time);
    }
    if (this.weather.kind === 'rain' || this.weather.kind === 'storm') {
      this.drawRain(delta, this.weather.kind === 'storm');
    }
    if (this.weather.kind === 'fog') this.drawFog(time);
    if (this.weather.kind === 'snow') this.drawSnow(time, delta);
    if (!this.weather.isDay && this.weather.kind === 'clear') this.drawStars(time);
    if (this.weather.kind === 'storm') this.drawStormPulse(time);
  }

  drawClouds(time) {
    const context = this.context;
    const rect = this.getFlowerRect();
    if (!rect) return;

    const isStorm = this.weather.kind === 'storm';
    const isOvercast = this.weather.kind === 'overcast';
    const cloudCount = isOvercast ? 3 : 2;
    const baseOpacity = isStorm ? 0.38 : isOvercast ? 0.28 : 0.18;
    const speed = isStorm ? 0.000014 : 0.00001;
    const puffs = [
      [-0.36, 0.12, 0.2, 0.45, 0],
      [-0.23, -0.06, 0.22, 0.58, 1],
      [-0.08, -0.25, 0.24, 0.78, 0],
      [0.1, -0.3, 0.27, 0.86, 1],
      [0.27, -0.08, 0.23, 0.62, 0],
      [0.39, 0.13, 0.18, 0.44, 1],
      [0.02, 0.13, 0.4, 0.38, 2],
    ];
    const tones = isStorm
      ? [
          'rgba(44, 51, 70, 0.9)',
          'rgba(105, 114, 135, 0.72)',
          'rgba(15, 20, 33, 0.94)',
        ]
      : [
          'rgba(91, 112, 148, 0.72)',
          'rgba(193, 204, 220, 0.82)',
          'rgba(56, 78, 119, 0.68)',
        ];

    context.save();
    this.clipToFlower(context, rect);

    for (let index = 0; index < cloudCount; index += 1) {
      const cycle = (time * speed + index / cloudCount + index * 0.13) % 1;
      const cloudWidth = rect.width * (0.32 + index * 0.025);
      const cloudHeight = rect.height * (0.068 + index * 0.002);
      const x = rect.left - cloudWidth + cycle * (rect.width + cloudWidth * 2);
      const y = rect.top + rect.height * (0.05 + index * 0.028);
      const edgeDistance = Math.min(x - rect.left, rect.right - x);
      const cloudRadius = cloudWidth * 0.6 + 3;
      const edgeFade = Math.max(
        0,
        Math.min(1, (edgeDistance - cloudRadius) / (rect.width * 0.12)),
      );
      const softFade = edgeFade * edgeFade * (3 - 2 * edgeFade);

      context.save();
      context.globalAlpha = baseOpacity * softFade;
      context.translate(x, y);
      context.filter = 'blur(0.65px)';

      for (const [offsetX, offsetY, radiusX, radiusY, tone] of puffs) {
        context.save();
        context.translate(offsetX * cloudWidth, offsetY * cloudHeight);
        context.scale(radiusX * cloudWidth, radiusY * cloudHeight);
        const wash = context.createRadialGradient(0, 0, 0, 0, 0, 1);
        wash.addColorStop(0, tones[tone]);
        wash.addColorStop(0.55, tones[tone]);
        wash.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = wash;
        context.fillRect(-1, -1, 2, 2);
        context.restore();
      }

      context.restore();
    }

    context.restore();
  }

  drawRain(delta, storm) {
    const context = this.context;
    const rect = this.getFlowerRect();
    if (!rect) return;

    context.save();
    this.clipToFlower(context, rect);
    context.strokeStyle = storm
      ? 'rgba(22, 70, 203, 0.34)'
      : 'rgba(22, 70, 203, 0.24)';
    context.lineWidth = 0.85;
    context.beginPath();

    for (const drop of this.drops) {
      drop.y += (drop.speed * delta) / rect.height;
      if (drop.y > 1.05) {
        drop.y = -0.05;
        drop.x = Math.random();
      }
      const x = rect.left + rect.width * (0.04 + drop.x * 0.92);
      const y = rect.top + drop.y * rect.height;
      context.moveTo(x, y);
      context.lineTo(x - 2.5, y + drop.length);
    }

    context.stroke();
    context.restore();
  }

  drawFog(time) {
    const context = this.context;
    const rect = this.getFlowerRect();
    if (!rect) return;

    context.save();
    this.clipToFlower(context, rect);
    for (let index = 0; index < 2; index += 1) {
      const y = rect.top + rect.height * (0.3 + index * 0.28) +
        Math.sin(time * 0.00012 + index * 2) * 24;
      const gradient = context.createLinearGradient(0, y - 70, 0, y + 70);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.24)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      context.fillStyle = gradient;
      context.fillRect(rect.left, y - 70, rect.width, 140);
    }
    context.restore();
  }

  drawSnow(time, delta) {
    const context = this.context;
    const rect = this.getFlowerRect();
    if (!rect) return;

    context.save();
    this.clipToFlower(context, rect);
    context.fillStyle = 'rgba(22, 70, 203, 0.32)';

    for (const flake of this.flakes) {
      flake.y += (flake.speed * delta) / rect.height;
      if (flake.y > 1.03) {
        flake.y = -0.03;
        flake.x = Math.random();
      }
      const drift = Math.sin(time * 0.0008 + flake.phase) * 3;
      const x = rect.left + rect.width * (0.04 + flake.x * 0.92);
      const y = rect.top + flake.y * rect.height;
      context.fillRect(x + drift, y, flake.size, flake.size);
    }

    context.restore();
  }

  drawStars(time) {
    const rect = this.getFlowerRect();
    if (!rect) return;

    const context = this.context;
    context.save();
    this.clipToFlower(context, rect);
    context.fillStyle = '#1646cb';

    for (const star of this.stars) {
      const opacity = 0.14 + (Math.sin(time * 0.0005 + star.phase) + 1) * 0.065;
      context.globalAlpha = opacity;
      const x = rect.left + rect.width * (0.08 + star.x * 0.84);
      const y = rect.top + rect.height * (0.05 + star.y * 0.66);
      context.fillRect(Math.round(x), Math.round(y), 1.2, 1.2);
    }

    context.restore();
  }

  drawStormPulse(time) {
    const cycle = (time * 0.001) % 38;
    if (cycle > 1.8) return;

    const rect = this.getFlowerRect();
    if (!rect) return;
    const x = rect.left + rect.width * 0.5;
    const y = rect.top + rect.height * 0.42;
    const opacity = Math.sin((cycle / 1.8) * Math.PI) * 0.06;
    const radius = Math.max(rect.width * 0.75, 260);
    const gradient = this.context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(22, 70, 203, ${opacity})`);
    gradient.addColorStop(1, 'rgba(22, 70, 203, 0)');
    this.context.save();
    this.clipToFlower(this.context, rect);
    this.context.fillStyle = gradient;
    this.context.fillRect(rect.left, rect.top, rect.width, rect.height);
    this.context.restore();
  }

}

const ambientWeather = weatherCanvas ? new AmbientWeather(weatherCanvas) : null;

updateSydneyClock();
setInterval(updateSydneyClock, 1000);
setupWeatherSwitcher();

const cached = readCachedWeather();
if (cached) liveWeather = cached.weather;

activeOverride = readWeatherOverride();
const overridePreset = WEATHER_PRESETS.find(
  (preset) => preset.id === activeOverride,
);

if (overridePreset?.weather) {
  applyWeather({ ...overridePreset.weather, isOverride: true });
} else if (liveWeather) {
  applyWeather(liveWeather);
}

if (!cached || Date.now() - cached.savedAt >= WEATHER_REFRESH_MS) {
  fetchWeather();
}

setInterval(fetchWeather, WEATHER_REFRESH_MS);
