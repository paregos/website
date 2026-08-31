import { prepareThemeVisual, publishTheme } from './site-state.js';
import { findTheme, THEMES, THEME_PRESETS } from './themes.js';

const SYDNEY_TIME_ZONE = 'Australia/Sydney';
const THEME_OVERRIDE_KEY = 'ben-mitchell-theme-override-v1';
const DOUBLE_PRESS_MS = 420;

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SYDNEY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
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
    return findTheme(stored)?.id || null;
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

async function preloadThemeImage(theme) {
  const themeUrl = new URL(theme.image, window.location.href).href;
  if (flowerImage?.currentSrc === themeUrl) return;

  const preload = new Image();
  preload.src = theme.image;
  if (preload.decode) {
    await preload.decode();
  } else {
    await new Promise((resolve, reject) => {
      preload.addEventListener('load', resolve, { once: true });
      preload.addEventListener('error', reject, { once: true });
    });
  }
}

async function prepareTheme(theme, options) {
  try {
    const preparedByFlower = await prepareThemeVisual(theme, options);
    if (!preparedByFlower) await preloadThemeImage(theme);
  } catch (error) {
    console.warn(`[theme] Could not prepare ${theme.id} before switching.`, error);
    try {
      await preloadThemeImage(theme);
    } catch (fallbackError) {
      console.warn(`[theme] Could not preload ${theme.id}.`, fallbackError);
    }
  }
}

function applyTheme(theme, isOverride = false) {
  if (!theme || (currentTheme?.id === theme.id && currentTheme.isOverride === isOverride)) {
    return;
  }

  currentTheme = { ...theme, isOverride };
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

  updateThemeSelection();
  publishTheme(currentTheme);
}

function applyCurrentTheme() {
  const override = findTheme(activeOverride);
  applyTheme(override || getDailyTheme(), Boolean(override));
}

async function selectPreset(preset) {
  activeOverride = preset.theme?.id || null;
  writeOverride(activeOverride);
  closeSwitcher();

  const theme = preset.theme || getDailyTheme();
  await prepareTheme(theme);
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

  for (const preset of THEME_PRESETS) {
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
    button.addEventListener('click', () => void selectPreset(preset));
    if (preset.theme) {
      button.addEventListener('pointerenter', () => {
        void prepareTheme(preset.theme, { idle: true });
      });
      button.addEventListener('focus', () => {
        void prepareTheme(preset.theme, { idle: true });
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

    const preset = THEME_PRESETS.find((option) => option.key === event.key);
    if (preset) {
      event.preventDefault();
      void selectPreset(preset);
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
    prepareTheme(theme).then(() => applyTheme(theme, false));
  }
}, 60_000);
