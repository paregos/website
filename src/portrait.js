import { subscribeTheme } from './site-state.js';

const GLYPHS = ' .,:;irsXA253hMHGS#9B&@';
const DESKTOP_COLUMNS = 108;
const MOBILE_COLUMNS = 86;
const PORTRAIT_RATIO = 5 / 4;
const SIGNAL_MIN_MS = 8_000;
const SIGNAL_VARIANCE_MS = 5_000;
const SIGNAL_DURATION_MS = 1_150;

const portraits = [
  {
    src: new URL('../assets/portraits/portrait-clean.webp', import.meta.url).href,
    alt: 'Ben wearing a dark jacket',
    focusX: 0.5,
    focusY: 0.4,
  },
  {
    src: new URL('../assets/portraits/mirror-sunglasses.webp', import.meta.url).href,
    alt: 'Ben trying on mirrored sunglasses',
    focusX: 0.52,
    focusY: 0.4,
  },
  {
    src: new URL('../assets/portraits/sydney-harbour.webp', import.meta.url).href,
    alt: 'Ben beside Sydney Harbour at sunset',
    focusX: 0.7,
    focusY: 0.46,
  },
  {
    src: new URL('../assets/portraits/stonehenge.webp', import.meta.url).href,
    alt: 'Ben taking a selfie at Stonehenge',
    focusX: 0.5,
    focusY: 0.53,
  },
  {
    src: new URL('../assets/portraits/dark-jacket.webp', import.meta.url).href,
    alt: 'Ben wearing a dark jacket and shoulder bag',
    focusX: 0.5,
    focusY: 0.4,
  },
];

const root = document.querySelector('[data-ascii-portrait]');
const frame = root?.querySelector('[data-ascii-portrait-next]');
const canvas = root?.querySelector('[data-ascii-portrait-canvas]');
const fallback = root?.querySelector('[data-ascii-portrait-fallback]');
const name = root?.querySelector('[data-ascii-portrait-name]');
const count = root?.querySelector('[data-ascii-portrait-count]');

if (root && frame && canvas && fallback && name && count) startPortrait();

function startPortrait() {
  const context = canvas.getContext('2d');
  const sampler = document.createElement('canvas');
  const sampleContext = sampler.getContext('2d', { willReadFrequently: true });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const imageCache = new Map();
  const sampleCache = new Map();
  let currentIndex = 0;
  let currentSamples = null;
  let columns = getColumnCount();
  let rows = getRowCount(columns);
  let animationFrame = 0;
  let signalTimer = 0;
  let transitionId = 0;
  let transitioning = false;
  let stopped = false;

  function getColumnCount() {
    return window.innerWidth <= 760 ? MOBILE_COLUMNS : DESKTOP_COLUMNS;
  }

  function getRowCount(columnCount) {
    return Math.round(columnCount / PORTRAIT_RATIO * 0.53);
  }

  function hash(value) {
    const sine = Math.sin(value * 91.3458) * 47453.5453;
    return sine - Math.floor(sine);
  }

  function loadImage(index) {
    if (imageCache.has(index)) return imageCache.get(index);

    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = portraits[index].src;
      image.addEventListener('load', () => resolve(image), { once: true });
      image.addEventListener('error', reject, { once: true });
    });
    imageCache.set(index, promise);
    return promise;
  }

  function drawCover(image, portrait) {
    const targetRatio = PORTRAIT_RATIO;
    const imageRatio = image.naturalWidth / image.naturalHeight;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;

    if (imageRatio > targetRatio) sourceWidth = sourceHeight * targetRatio;
    else sourceHeight = sourceWidth / targetRatio;

    const sourceX = Math.max(
      0,
      Math.min(image.naturalWidth - sourceWidth, portrait.focusX * image.naturalWidth - sourceWidth / 2),
    );
    const sourceY = Math.max(
      0,
      Math.min(image.naturalHeight - sourceHeight, portrait.focusY * image.naturalHeight - sourceHeight / 2),
    );

    sampler.width = columns;
    sampler.height = rows;
    sampleContext.fillStyle = '#fff';
    sampleContext.fillRect(0, 0, columns, rows);
    sampleContext.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      columns,
      rows,
    );
  }

  async function samplePortrait(portraitIndex) {
    const cacheKey = `${portraitIndex}:${columns}`;
    if (sampleCache.has(cacheKey)) return sampleCache.get(cacheKey);

    const image = await loadImage(portraitIndex);
    drawCover(image, portraits[portraitIndex]);
    const pixels = sampleContext.getImageData(0, 0, columns, rows).data;
    const luminance = new Float32Array(columns * rows);
    const samples = new Array(columns * rows);

    for (let pixelIndex = 0; pixelIndex < luminance.length; pixelIndex += 1) {
      const offset = pixelIndex * 4;
      luminance[pixelIndex] = (
        pixels[offset] * 0.2126 +
        pixels[offset + 1] * 0.7152 +
        pixels[offset + 2] * 0.0722
      ) / 255;
    }

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const sampleIndex = row * columns + column;
        const left = luminance[row * columns + Math.max(0, column - 1)];
        const above = luminance[Math.max(0, row - 1) * columns + column];
        const edge = Math.abs(luminance[sampleIndex] - left) + Math.abs(luminance[sampleIndex] - above);
        const darkness = Math.min(1, Math.max(0, (1 - luminance[sampleIndex] - 0.035) * 1.18));
        const glyphIndex = Math.min(GLYPHS.length - 1, Math.floor(darkness * GLYPHS.length));

        samples[sampleIndex] = {
          darkness,
          edge,
          glyphIndex,
          accent: edge > 0.15 && hash(sampleIndex + 31 * (portraitIndex + 1)) > 0.72,
        };
      }
    }

    sampleCache.set(cacheKey, samples);
    return samples;
  }

  function sizeCanvas() {
    const bounds = frame.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.max(1, Math.round(bounds.width * pixelRatio));
    canvas.height = Math.max(1, Math.round(bounds.height * pixelRatio));
  }

  function draw(samples = currentSamples, options = {}) {
    if (!samples || !context) return;

    const { nextSamples = null, progress = 0, signal = -1, nextIndex = currentIndex } = options;
    const styles = getComputedStyle(document.documentElement);
    const ink = styles.getPropertyValue('--ink').trim() || '#11110f';
    const accent = styles.getPropertyValue('--accent').trim() || '#1646cb';
    const cellWidth = canvas.width / columns;
    const cellHeight = canvas.height / rows;
    const fontSize = cellHeight * 0.93;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `${fontSize}px "Courier New", Courier, monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = row * columns + column;
        const threshold = hash(index + nextIndex * 177.17);
        const sample = nextSamples && threshold < progress ? nextSamples[index] : samples[index];
        const transitionEdge = nextSamples && Math.abs(threshold - progress) < 0.045;
        const signalDistance = signal < 0 ? 1 : Math.abs(row / Math.max(1, rows - 1) - signal);
        const inSignal = signalDistance < 0.075;
        const glyphShift = inSignal && hash(index + signal * 100) > 0.48 ? 1 : 0;
        const glyphIndex = Math.min(GLYPHS.length - 1, sample.glyphIndex + glyphShift);
        const glyph = GLYPHS[glyphIndex];

        if (glyph === ' ') continue;

        const useAccent = transitionEdge || (inSignal && sample.edge > 0.08) || sample.accent;
        context.fillStyle = useAccent ? accent : ink;
        context.globalAlpha = useAccent
          ? Math.min(0.88, 0.42 + sample.darkness * 0.5)
          : Math.min(0.94, 0.2 + sample.darkness * 0.84);
        context.fillText(
          glyph,
          (column + 0.5) * cellWidth,
          (row + 0.52) * cellHeight,
        );
      }
    }

    context.globalAlpha = 1;
  }

  function scheduleSignal() {
    clearTimeout(signalTimer);
    if (reduceMotion.matches || document.hidden || stopped) return;

    signalTimer = window.setTimeout(() => {
      const startedAt = performance.now();

      const animate = (now) => {
        const progress = Math.min(1, (now - startedAt) / SIGNAL_DURATION_MS);
        draw(currentSamples, { signal: progress * 1.3 - 0.15 });

        if (progress < 1 && !stopped && !document.hidden) {
          animationFrame = requestAnimationFrame(animate);
        } else {
          draw();
          scheduleSignal();
        }
      };

      animationFrame = requestAnimationFrame(animate);
    }, SIGNAL_MIN_MS + Math.random() * SIGNAL_VARIANCE_MS);
  }

  function updateLabels(index) {
    const number = String(index + 1).padStart(2, '0');
    name.textContent = `portrait_${number}.txt`;
    count.textContent = `${number} / ${String(portraits.length).padStart(2, '0')}`;
    frame.setAttribute('aria-label', `${portraits[index].alt}. Show the next portrait.`);
  }

  async function showNextPortrait() {
    if (transitioning) return;
    transitioning = true;
    clearTimeout(signalTimer);
    cancelAnimationFrame(animationFrame);

    const id = ++transitionId;
    const nextIndex = (currentIndex + 1) % portraits.length;

    try {
      const nextSamples = await samplePortrait(nextIndex);
      if (id !== transitionId || stopped) return;

      if (reduceMotion.matches) {
        currentIndex = nextIndex;
        currentSamples = nextSamples;
        draw();
      } else {
        const startedAt = performance.now();
        await new Promise((resolve) => {
          const animate = (now) => {
            const linear = Math.min(1, (now - startedAt) / 520);
            const eased = 1 - (1 - linear) ** 3;
            draw(currentSamples, { nextSamples, progress: eased, nextIndex });

            if (linear < 1 && id === transitionId && !stopped) {
              animationFrame = requestAnimationFrame(animate);
            } else {
              resolve();
            }
          };
          animationFrame = requestAnimationFrame(animate);
        });

        currentIndex = nextIndex;
        currentSamples = nextSamples;
        draw();
      }

      fallback.src = portraits[currentIndex].src;
      fallback.alt = portraits[currentIndex].alt;
      updateLabels(currentIndex);
    } finally {
      transitioning = false;
      scheduleSignal();
    }
  }

  async function initialise() {
    sizeCanvas();
    currentSamples = await samplePortrait(currentIndex);
    if (stopped) return;
    draw();
    root.classList.add('is-ready');
    updateLabels(currentIndex);
    scheduleSignal();

    const warm = () => {
      for (let index = 1; index < portraits.length; index += 1) void loadImage(index);
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 2500 });
    else window.setTimeout(warm, 1000);
  }

  const resizeObserver = new ResizeObserver(() => {
    const nextColumns = getColumnCount();
    if (nextColumns !== columns) {
      columns = nextColumns;
      rows = getRowCount(columns);
      sampleCache.clear();
      void samplePortrait(currentIndex).then((samples) => {
        currentSamples = samples;
        sizeCanvas();
        draw();
      });
      return;
    }

    sizeCanvas();
    draw();
  });

  frame.addEventListener('click', () => void showNextPortrait());
  reduceMotion.addEventListener('change', () => {
    cancelAnimationFrame(animationFrame);
    draw();
    scheduleSignal();
  });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(animationFrame);
    if (document.hidden) clearTimeout(signalTimer);
    else {
      draw();
      scheduleSignal();
    }
  });
  subscribeTheme(() => draw());
  resizeObserver.observe(frame);

  window.addEventListener('pagehide', () => {
    stopped = true;
    transitionId += 1;
    clearTimeout(signalTimer);
    cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();
  }, { once: true });

  void initialise();
}
