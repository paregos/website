import { pickActivity } from './currently-activities.js';
import { getCurrentWeather } from './site-state.js';

const DISPLAY_MS = 15_000;
const DELETE_MS = 28;
const TYPE_MS = 48;
const BETWEEN_WORDS_MS = 240;
const RECENT_COUNT = 4;
const SYDNEY_TIME_ZONE = 'Australia/Sydney';

const value = document.querySelector('[data-currently]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const dateFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: SYDNEY_TIME_ZONE,
  month: 'numeric',
  weekday: 'short',
  hour: 'numeric',
  hourCycle: 'h23',
});

if (value) startCurrently();

function getContext() {
  const parts = Object.fromEntries(
    dateFormatter.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );

  return {
    month: Number(parts.month),
    weekday: parts.weekday,
    hour: Number(parts.hour),
    weather: getCurrentWeather(),
  };
}

function startCurrently() {
  const lifecycle = new AbortController();
  const recent = [];
  let timer = 0;
  let animationId = 0;
  let cancelWait = () => {};

  const remember = (activity) => {
    recent.push(activity);
    if (recent.length > RECENT_COUNT) recent.shift();
  };

  const choose = () => pickActivity(getContext(), recent);
  const initial = choose();
  value.textContent = initial;
  remember(initial);

  const wait = (duration, id) => new Promise((resolve) => {
    cancelWait = () => resolve(false);
    timer = window.setTimeout(() => {
      cancelWait = () => {};
      resolve(id === animationId);
    }, duration);
  });

  const cancelAnimation = () => {
    clearTimeout(timer);
    cancelWait();
    cancelWait = () => {};
    animationId += 1;
    value.classList.remove('is-typing');
  };

  const animateText = async (next, id) => {
    value.classList.add('is-typing');

    while (value.textContent && id === animationId) {
      value.textContent = value.textContent.slice(0, -1);
      if (!await wait(DELETE_MS * (0.75 + Math.random() * 0.5), id)) return;
    }

    if (!await wait(BETWEEN_WORDS_MS, id)) return;

    for (const character of next) {
      if (id !== animationId) return;
      value.textContent += character;
      if (!await wait(TYPE_MS * (0.72 + Math.random() * 0.56), id)) return;
    }

    value.classList.remove('is-typing');
  };

  const schedule = () => {
    clearTimeout(timer);
    timer = window.setTimeout(cycle, DISPLAY_MS);
  };

  const cycle = async () => {
    if (document.hidden) return;

    const next = choose();
    remember(next);
    const id = ++animationId;

    if (reduceMotion.matches) {
      value.textContent = next;
    } else {
      await animateText(next, id);
    }

    if (id === animationId) schedule();
  };

  document.addEventListener('visibilitychange', () => {
    cancelAnimation();
    if (!document.hidden) schedule();
  }, { signal: lifecycle.signal });

  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    cancelAnimation();
    lifecycle.abort();
  }, { signal: lifecycle.signal });

  schedule();
}
