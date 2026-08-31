import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCurrentTheme,
  getCurrentWeather,
  prepareThemeVisual,
  publishTheme,
  publishWeather,
  registerThemePreparer,
  subscribeTheme,
  subscribeWeather,
} from '../src/site-state.js';

test('theme state publishes, subscribes, and prepares visuals', async () => {
  const theme = { id: 'test-theme' };
  const observed = [];
  const unsubscribe = subscribeTheme((value) => observed.push(value));
  const unregister = registerThemePreparer(async (value, options) => {
    assert.equal(value, theme);
    assert.deepEqual(options, { idle: true });
  });

  publishTheme(theme);

  assert.equal(getCurrentTheme(), theme);
  assert.deepEqual(observed, [theme]);
  assert.equal(await prepareThemeVisual(theme, { idle: true }), true);

  unsubscribe();
  unregister();
  assert.equal(await prepareThemeVisual(theme), false);
});

test('weather state publishes and immediately hydrates new subscribers', () => {
  const weather = { kind: 'clear', temperature: 24 };
  publishWeather(weather);

  let observed = null;
  const unsubscribe = subscribeWeather((value) => {
    observed = value;
  });

  assert.equal(getCurrentWeather(), weather);
  assert.equal(observed, weather);
  unsubscribe();
});
