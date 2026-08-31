let currentTheme = null;
let currentWeather = null;
let themePreparer = null;

const themeSubscribers = new Set();
const weatherSubscribers = new Set();

export function getCurrentTheme() {
  return currentTheme;
}

export function publishTheme(theme) {
  currentTheme = theme;
  for (const subscriber of themeSubscribers) subscriber(theme);
}

export function subscribeTheme(subscriber, { immediate = true } = {}) {
  themeSubscribers.add(subscriber);
  if (immediate && currentTheme) subscriber(currentTheme);
  return () => themeSubscribers.delete(subscriber);
}

export function registerThemePreparer(preparer) {
  themePreparer = preparer;
  return () => {
    if (themePreparer === preparer) themePreparer = null;
  };
}

export async function prepareThemeVisual(theme, options) {
  if (!themePreparer) return false;
  await themePreparer(theme, options);
  return true;
}

export function getCurrentWeather() {
  return currentWeather;
}

export function publishWeather(weather) {
  currentWeather = weather;
  for (const subscriber of weatherSubscribers) subscriber(weather);
}

export function subscribeWeather(subscriber, { immediate = true } = {}) {
  weatherSubscribers.add(subscriber);
  if (immediate && currentWeather) subscriber(currentWeather);
  return () => weatherSubscribers.delete(subscriber);
}
