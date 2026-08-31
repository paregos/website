import blueLily from '../assets/blue-spider-lily.png';
import emeraldLily from '../assets/emerald-spider-lily.png';
import goldLily from '../assets/gold-spider-lily.png';
import indigoLily from '../assets/indigo-spider-lily.png';
import redLily from '../assets/red-spider-lily.png';

const SYDNEY_TIME_ZONE = 'Australia/Sydney';
const THEME_OVERRIDE_KEY = 'ben-mitchell-theme-override-v1';
const DOUBLE_PRESS_MS = 420;

const THEMES = [
  {
    id: 'blue', key: '1', name: 'Cobalt', colorName: 'blue', image: blueLily,
    accent: '#1646cb', deep: [0.035, 0.12, 0.56], light: [0.16, 0.42, 0.96],
  },
  {
    id: 'red', key: '2', name: 'Vermilion', colorName: 'red', image: redLily,
    accent: '#b9232d', deep: [0.45, 0.03, 0.06], light: [0.96, 0.24, 0.22],
  },
  {
    id: 'gold', key: '3', name: 'Gold', colorName: 'gold', image: goldLily,
    accent: '#946200', deep: [0.42, 0.2, 0.015], light: [1.0, 0.67, 0.12],
  },
  {
    id: 'indigo', key: '4', name: 'Indigo', colorName: 'indigo', image: indigoLily,
    accent: '#5735a5', deep: [0.16, 0.06, 0.37], light: [0.54, 0.4, 0.93],
  },
  {
    id: 'emerald', key: '5', name: 'Emerald', colorName: 'emerald', image: emeraldLily,
    accent: '#087257', deep: [0.02, 0.26, 0.18], light: [0.1, 0.72, 0.48],
  },
];
window.siteThemes = THEMES;

const PRESETS = [
  { id: 'auto', key: '0', name: 'Daily rotation', theme: null },
  ...THEMES.map((theme) => ({
    id: theme.id,
    key: theme.key,
    name: theme.name,
    theme,
  })),
];

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SYDNEY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const preloadedThemeImages = new Map();

const switcher = document.querySelector('[data-theme-switcher]');
const options = document.querySelector('[data-theme-options]');
const flowerImage = document.querySelector('[data-lily] img');
const flowerCaption = document.querySelector('[data-lily] figcaption');
const favicon = document.querySelector('link[rel="icon"]');
let activeOverride = readOverride();
let currentTheme = null;
let currentDateKey = '';
let previousThemeKeyTime = 0;

function getSydneyDate() {
  const parts = Object.fromEntries(
    dateFormatter.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );
  return {
    key: `${parts.year}-${parts.month}-${parts.day}`,
    dayNumber: Math.floor(
      Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) /
        86_400_000,
    ),
  };
}

function getDailyTheme() {
  const date = getSydneyDate();
  currentDateKey = date.key;
  return THEMES[((date.dayNumber % THEMES.length) + THEMES.length) % THEMES.length];
}

function readOverride() {
  try {
    const stored = sessionStorage.getItem(THEME_OVERRIDE_KEY);
    return THEMES.some((theme) => theme.id === stored) ? stored : null;
  } catch {
    return null;
  }
}

function writeOverride(themeId) {
  try {
    if (themeId) sessionStorage.setItem(THEME_OVERRIDE_KEY, themeId);
    else sessionStorage.removeItem(THEME_OVERRIDE_KEY);
  } catch {
    // A session-only override is optional; the daily theme still works without it.
  }
}

async function preloadTheme(theme) {
  if (!theme || preloadedThemeImages.has(theme.id)) return;

  const themeUrl = theme ? new URL(theme.image, window.location.href).href : '';
  if (flowerImage?.currentSrc === themeUrl) {
    preloadedThemeImages.set(theme.id, flowerImage);
    return;
  }

  const preload = new Image();
  preload.src = theme.image;
  try {
    if (preload.decode) {
      await preload.decode();
    } else {
      await new Promise((resolve, reject) => {
        preload.addEventListener('load', resolve, { once: true });
        preload.addEventListener('error', reject, { once: true });
      });
    }
    preloadedThemeImages.set(theme.id, preload);
  } catch {
    // The visible image still has its normal browser loading fallback.
  }
}

function applyTheme(theme, isOverride = false) {
  if (!theme || (currentTheme?.id === theme.id && currentTheme.isOverride === isOverride)) {
    return;
  }

  currentTheme = {
    ...theme,
    isOverride,
    imageElement: preloadedThemeImages.get(theme.id),
  };
  document.documentElement.dataset.theme = theme.id;

  if (flowerImage) {
    flowerImage.src = theme.image;
    flowerImage.alt = `A ${theme.colorName} watercolor spider lily`;
  }
  if (flowerCaption) {
    flowerCaption.textContent = theme.id === 'red'
      ? 'Lycoris radiata'
      : `Lycoris radiata, reimagined in ${theme.colorName}`;
  }
  if (favicon) favicon.href = theme.image;

  window.siteTheme = currentTheme;
  updateThemeSelection();
  window.dispatchEvent(new CustomEvent('sitethemechange', { detail: currentTheme }));
}

function applyCurrentTheme() {
  const override = THEMES.find((theme) => theme.id === activeOverride);
  applyTheme(override || getDailyTheme(), Boolean(override));
}

async function selectPreset(preset) {
  activeOverride = preset.theme?.id || null;
  writeOverride(activeOverride);
  closeSwitcher();

  const theme = preset.theme || getDailyTheme();
  if (window.prepareLilyTheme) await window.prepareLilyTheme(theme);
  else await preloadTheme(theme);
  applyTheme(theme, Boolean(preset.theme));
}

function updateThemeSelection() {
  if (!options) return;
  const selectedId = activeOverride || 'auto';
  for (const button of options.querySelectorAll('button')) {
    button.setAttribute('aria-selected', String(button.dataset.themePreset === selectedId));
  }
}

function openSwitcher() {
  if (!switcher || switcher.open) return;

  const weatherSwitcher = document.querySelector('[data-weather-switcher]');
  const hotkeysCard = document.querySelector('[data-hotkeys-card]');
  const hotkeysTrigger = document.querySelector('[data-hotkeys-trigger]');
  if (weatherSwitcher?.open) weatherSwitcher.close();
  if (hotkeysCard?.open) hotkeysCard.close();
  hotkeysTrigger?.setAttribute('aria-expanded', 'false');

  switcher.show();
  updateThemeSelection();
  const selected = options?.querySelector('[aria-selected="true"]');
  const first = options?.querySelector('button');
  requestAnimationFrame(() => (selected || first)?.focus());
}

function closeSwitcher() {
  if (switcher?.open) switcher.close();
}

function setupSwitcher() {
  if (!switcher || !options) return;

  options.setAttribute('role', 'listbox');
  options.setAttribute('aria-label', 'Color theme override');

  for (const preset of PRESETS) {
    const button = document.createElement('button');
    const icon = document.createElement('span');
    const name = document.createElement('span');
    const key = document.createElement('span');

    button.type = 'button';
    button.setAttribute('role', 'option');
    button.dataset.themePreset = preset.id;
    icon.className = preset.theme ? 'theme-option-swatch' : 'weather-option-icon';
    name.className = 'weather-option-name';
    key.className = 'weather-option-key';

    if (preset.theme) icon.style.setProperty('--swatch', preset.theme.accent);
    else icon.textContent = '◌';
    name.textContent = preset.name;
    key.textContent = preset.key;

    button.append(icon, name, key);
    button.addEventListener('click', () => selectPreset(preset));
    if (preset.theme) {
      button.addEventListener('pointerenter', () => {
        window.prepareLilyTheme?.(preset.theme).catch(() => {});
      });
      button.addEventListener('focus', () => {
        window.prepareLilyTheme?.(preset.theme).catch(() => {});
      });
    }
    options.append(button);
  }

  switcher.addEventListener('keydown', (event) => {
    const buttons = [...options.querySelectorAll('button')];
    const currentIndex = buttons.indexOf(document.activeElement);

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (currentIndex + direction + buttons.length) % buttons.length;
      buttons[nextIndex].focus();
      return;
    }

    const preset = PRESETS.find((option) => option.key === event.key);
    if (preset) {
      event.preventDefault();
      selectPreset(preset);
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
      event.key.toLowerCase() === 't'
    ) {
      const now = performance.now();
      const isDoublePress = now - previousThemeKeyTime <= DOUBLE_PRESS_MS;
      previousThemeKeyTime = now;

      if (isDoublePress) {
        event.preventDefault();
        previousThemeKeyTime = 0;
        if (switcher.open) closeSwitcher();
        else openSwitcher();
      }
      return;
    }

    if (event.key === 'Escape') closeSwitcher();
  });

  document.addEventListener('pointerdown', (event) => {
    if (switcher.open && !switcher.contains(event.target)) closeSwitcher();
  });
}

setupSwitcher();
applyCurrentTheme();

setInterval(() => {
  if (activeOverride) return;
  const date = getSydneyDate();
  if (date.key !== currentDateKey) {
    const theme = getDailyTheme();
    preloadTheme(theme).then(() => applyTheme(theme, false));
  }
}, 60_000);
