import {
  Geometry,
  Mesh,
  Program,
  Renderer,
  Transform,
  Triangle,
  Vec2,
} from 'ogl';
import { createLilyTextureCache } from './lily-textures.js';
import {
  getCurrentTheme,
  registerThemePreparer,
  subscribeTheme,
  subscribeWeather,
} from './site-state.js';
import { THEMES } from './themes.js';

const flower = document.querySelector('[data-lily]');
const image = flower?.querySelector('img');
const canvas = flower?.querySelector('.lily-canvas');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const THEME_TRANSITION_MS = 950;

if (flower && image && canvas && !reduceMotion.matches) {
  startLily().catch((error) => {
    console.warn('[lily] Interactive flower could not start.', error);
    flower.classList.remove('is-alive');
    flower.removeAttribute('role');
    flower.removeAttribute('tabindex');
    flower.removeAttribute('aria-label');
  });
}

async function startLily() {
  if (!image.complete) {
    await new Promise((resolve, reject) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', reject, { once: true });
    });
  } else if (image.decode) {
    await image.decode();
  }

  const initialTextureImage = new Image();
  initialTextureImage.src = image.currentSrc || image.src;
  if (initialTextureImage.decode) await initialTextureImage.decode();

  const initialTheme = getCurrentTheme();
  if (!initialTheme) throw new Error('A theme is required before the flower starts');

  const renderer = new Renderer({
    canvas,
    alpha: true,
    depth: false,
    dpr: Math.min(window.devicePixelRatio, 2),
    powerPreference: 'low-power',
  });
  const gl = renderer.gl;

  if (!gl) throw new Error('WebGL is unavailable');

  gl.clearColor(0, 0, 0, 0);
  const lifecycle = new AbortController();

  const scene = new Transform();
  const pointer = new Vec2(0.5, 0.55);
  const pointerTarget = new Vec2(0.5, 0.55);
  const textureCache = createLilyTextureCache(gl, initialTheme, initialTextureImage);
  let currentTexture = textureCache.initialTexture;
  let incomingTexture = textureCache.initialTexture;

  const lilyProgram = new Program(gl, {
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertex: /* glsl */ `
      attribute vec2 position;
      attribute vec2 uv;

      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `,
    fragment: /* glsl */ `
      precision highp float;

      uniform sampler2D tMap;
      uniform sampler2D tNextMap;
      uniform vec2 uPointer;
      uniform float uTime;
      uniform float uHover;
      uniform float uPulse;
      uniform float uThemeTransition;
      uniform float uWindStrength;
      uniform float uWindDirection;
      uniform float uRainStrength;
      uniform float uWeatherMute;
      uniform float uHeatStrength;
      uniform vec3 uAccentLight;

      varying vec2 vUv;

      void main() {
        vec2 delta = vUv - uPointer;
        float distanceToPointer = length(delta);
        vec2 direction = normalize(delta + vec2(0.0001));

        float softWave = sin(distanceToPointer * 42.0 - uTime * 3.2);
        softWave *= exp(-distanceToPointer * 7.0) * 0.0045 * uHover;

        float pulseRadius = max(uPulse, 0.0) * 0.72;
        float pulseRing = exp(-abs(distanceToPointer - pulseRadius) * 55.0);
        pulseRing *= sin(max(uPulse, 0.0) * 3.14159) * 0.014;

        vec2 themeDelta = vUv - vec2(0.5, 0.52);
        float themeDistance = length(themeDelta);
        vec2 themeDirection = normalize(themeDelta + vec2(0.0001));
        float themeRadius = max(uThemeTransition, 0.0) * 0.74;
        float themeRing = exp(-abs(themeDistance - themeRadius) * 52.0);
        themeRing *= sin(max(uThemeTransition, 0.0) * 3.14159) * 0.016;

        vec2 warpedUv = vUv + direction * (softWave + pulseRing);
        warpedUv += themeDirection * themeRing;
        warpedUv.x += sin(vUv.y * 9.0 + uTime * 0.75) * 0.0008 * uHover;

        vec2 wind = vec2(cos(uWindDirection), sin(uWindDirection));
        float windSway = sin(vUv.y * 5.5 + uTime * 0.72);
        windSway *= uWindStrength * pow(vUv.y, 2.0);
        warpedUv += wind * windSway;
        warpedUv.x += sin(vUv.y * 24.0 - uTime * 1.15) * uRainStrength;

        float heatWave = sin(vUv.y * 48.0 + uTime * 2.25);
        heatWave += sin(vUv.y * 83.0 - uTime * 1.4) * 0.45;
        warpedUv.x += heatWave * uHeatStrength;
        warpedUv.y += sin(vUv.x * 34.0 + uTime * 1.7) * uHeatStrength * 0.28;

        vec4 oldPigment = texture2D(tMap, warpedUv);
        vec4 nextPigment = texture2D(tNextMap, warpedUv);
        float themeMix = 1.0 - smoothstep(
          themeRadius - 0.035,
          themeRadius + 0.035,
          themeDistance
        );
        themeMix *= step(0.0, uThemeTransition);
        vec4 pigment = mix(oldPigment, nextPigment, themeMix);
        float accentBloom = exp(-distanceToPointer * 5.0) * uHover * 0.055;
        pigment.rgb = min(
          vec3(1.0),
          pigment.rgb + uAccentLight * accentBloom * pigment.a
        );

        float luminance = dot(pigment.rgb, vec3(0.299, 0.587, 0.114));
        vec3 weatherGrey = vec3(luminance) * vec3(0.96, 0.98, 1.02);
        pigment.rgb = mix(pigment.rgb, weatherGrey, uWeatherMute);

        gl_FragColor = pigment;
      }
    `,
    uniforms: {
      tMap: { value: currentTexture },
      tNextMap: { value: currentTexture },
      uPointer: { value: pointer },
      uTime: { value: 0 },
      uHover: { value: 0 },
      uPulse: { value: -1 },
      uThemeTransition: { value: -1 },
      uWindStrength: { value: 0 },
      uWindDirection: { value: 0 },
      uRainStrength: { value: 0 },
      uWeatherMute: { value: 0 },
      uHeatStrength: { value: 0 },
      uAccentLight: { value: new Float32Array([0.16, 0.42, 0.96]) },
    },
  });

  const lilyMesh = new Mesh(gl, {
    geometry: new Triangle(gl),
    program: lilyProgram,
  });
  lilyMesh.setParent(scene);

  const particleCount = 72;
  const positions = new Float32Array(particleCount * 2);
  const randoms = new Float32Array(particleCount * 4);

  for (let index = 0; index < particleCount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random());
    const x = 0.5 + Math.cos(angle) * radius * 0.27;
    const y = 0.58 + Math.sin(angle) * radius * 0.22;

    positions.set([x * 2 - 1, y * 2 - 1], index * 2);
    randoms.set(
      [Math.random(), Math.random(), Math.random(), Math.random()],
      index * 4,
    );
  }

  const particleProgram = new Program(gl, {
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertex: /* glsl */ `
      attribute vec2 position;
      attribute vec4 random;

      uniform float uBurst;
      uniform float uDpr;

      varying float vAlpha;
      varying float vShade;

      void main() {
        float progress = clamp(uBurst, 0.0, 1.0);
        float travel = sin(progress * 3.14159);
        float angle = random.x * 6.28318;
        vec2 direction = vec2(cos(angle), sin(angle));
        vec2 tangent = vec2(-direction.y, direction.x);

        vec2 offset = direction * travel * mix(0.08, 0.42, random.y);
        offset += tangent * sin(progress * 9.0 + random.z * 6.28318) * travel * 0.035;
        offset.y += travel * travel * mix(-0.04, 0.1, random.z);

        gl_Position = vec4(position + offset, 0.0, 1.0);
        gl_PointSize = mix(1.4, 3.5, random.w) * uDpr;

        vAlpha = travel * mix(0.32, 0.9, random.y);
        vShade = random.z;
      }
    `,
    fragment: /* glsl */ `
      precision highp float;

      varying float vAlpha;
      varying float vShade;

      uniform vec3 uAccentLight;
      uniform vec3 uAccentDeep;

      void main() {
        float dotShape = smoothstep(0.5, 0.14, length(gl_PointCoord - 0.5));
        vec3 color = mix(uAccentDeep, uAccentLight, vShade);
        gl_FragColor = vec4(color, dotShape * vAlpha);
      }
    `,
    uniforms: {
      uBurst: { value: -1 },
      uDpr: { value: renderer.dpr },
      uAccentLight: { value: new Float32Array([0.16, 0.42, 0.96]) },
      uAccentDeep: { value: new Float32Array([0.035, 0.12, 0.56]) },
    },
  });

  const particles = new Mesh(gl, {
    mode: gl.POINTS,
    geometry: new Geometry(gl, {
      position: { size: 2, data: positions },
      random: { size: 4, data: randoms },
    }),
    program: particleProgram,
  });
  particles.setParent(scene);

  let hoverTarget = 0;
  let hover = 0;
  let tiltX = 0;
  let tiltY = 0;
  let tiltTargetX = 0;
  let tiltTargetY = 0;
  let weatherIsMoving = false;
  let burstStarted = -1;
  let themeTransitionStarted = -1;
  let themeRequestId = 0;
  let currentThemeId = null;
  let frameId = 0;

  function resize() {
    const rect = image.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    renderer.render({ scene });
  }

  function updatePointer(event) {
    const rect = image.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = 1 - (event.clientY - rect.top) / rect.height;

    pointerTarget.set(
      Math.min(1, Math.max(0, x)),
      Math.min(1, Math.max(0, y)),
    );

    const edgeDistance = Math.max(
      0,
      Math.min(x, 1 - x, y, 1 - y),
    );
    const edgeProgress = Math.min(edgeDistance / 0.22, 1);
    const presence = edgeProgress * edgeProgress * (3 - 2 * edgeProgress);

    hoverTarget = presence;
    tiltTargetX = (0.5 - y) * 3 * presence;
    tiltTargetY = (x - 0.5) * 3 * presence;
  }

  function releasePigment() {
    burstStarted = performance.now();
    ensureAnimation();
  }

  function ensureAnimation() {
    if (!frameId) frameId = requestAnimationFrame(render);
  }

  function render(time) {
    pointer.lerp(pointerTarget, 0.04);
    hover += (hoverTarget - hover) * 0.045;
    tiltX += (tiltTargetX - tiltX) * 0.045;
    tiltY += (tiltTargetY - tiltY) * 0.045;

    flower.style.setProperty('--tilt-x', `${tiltX}deg`);
    flower.style.setProperty('--tilt-y', `${tiltY}deg`);

    let burst = -1;
    if (burstStarted >= 0) {
      burst = Math.min((time - burstStarted) / 1650, 1);
      if (burst >= 1) burstStarted = -1;
    }

    let themeTransition = -1;
    if (themeTransitionStarted >= 0) {
      const linearProgress = Math.min(
        (time - themeTransitionStarted) / THEME_TRANSITION_MS,
        1,
      );

      if (linearProgress >= 1) {
        currentTexture = incomingTexture;
        lilyProgram.uniforms.tMap.value = currentTexture;
        lilyProgram.uniforms.tNextMap.value = currentTexture;
        themeTransitionStarted = -1;
      } else {
        themeTransition = linearProgress;
      }
    }

    lilyProgram.uniforms.uTime.value = time * 0.001;
    lilyProgram.uniforms.uHover.value = hover;
    lilyProgram.uniforms.uPulse.value = burst;
    lilyProgram.uniforms.uThemeTransition.value = themeTransition;
    particleProgram.uniforms.uBurst.value = burst;

    renderer.render({ scene });

    const pointerIsSettled =
      Math.abs(pointer.x - pointerTarget.x) < 0.0001 &&
      Math.abs(pointer.y - pointerTarget.y) < 0.0001;
    const tiltIsSettled =
      Math.abs(tiltX - tiltTargetX) < 0.0001 &&
      Math.abs(tiltY - tiltTargetY) < 0.0001;
    const isActive =
      hover > 0.002 ||
      hoverTarget > 0 ||
      burstStarted >= 0 ||
      themeTransitionStarted >= 0 ||
      !pointerIsSettled ||
      !tiltIsSettled ||
      (weatherIsMoving && !document.hidden);

    frameId = isActive ? requestAnimationFrame(render) : 0;
  }

  flower.addEventListener('pointerenter', () => {
    ensureAnimation();
  }, { signal: lifecycle.signal });
  flower.addEventListener('pointermove', (event) => {
    updatePointer(event);
    ensureAnimation();
  }, { signal: lifecycle.signal });
  flower.addEventListener('pointerleave', () => {
    hoverTarget = 0;
    pointerTarget.set(0.5, 0.55);
    tiltTargetX = 0;
    tiltTargetY = 0;
    ensureAnimation();
  }, { signal: lifecycle.signal });
  flower.addEventListener('click', releasePigment, { signal: lifecycle.signal });
  flower.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      releasePigment();
    }
  }, { signal: lifecycle.signal });
  function applyWeather(weather) {
    if (!weather) return;

    const windStrength = Math.min(Math.max(weather.windSpeed, 0) / 55, 1);
    const rainStrength = weather.kind === 'storm'
      ? 0.0013
      : weather.kind === 'rain'
        ? 0.00065
        : 0;
    const weatherMute = weather.kind === 'overcast'
      ? 0.075
      : weather.kind === 'fog'
        ? 0.045
        : 0;

    const windSway = windStrength < 0.25
      ? windStrength * 0.002
      : 0.0005 + Math.pow(windStrength, 2) * 0.014;
    const heatStrength = weather.temperature >= 32
      ? Math.min((weather.temperature - 30) / 10, 1) * 0.0038
      : 0;

    lilyProgram.uniforms.uWindStrength.value = windSway;
    lilyProgram.uniforms.uWindDirection.value =
      ((weather.windDirection + 180) * Math.PI) / 180;
    lilyProgram.uniforms.uRainStrength.value = rainStrength;
    lilyProgram.uniforms.uWeatherMute.value = weatherMute;
    lilyProgram.uniforms.uHeatStrength.value = heatStrength;

    weatherIsMoving = windStrength > 0.08 || rainStrength > 0 || heatStrength > 0;
    renderer.render({ scene });
    if (weatherIsMoving) ensureAnimation();
  }

  async function transitionThemeImage(theme) {
    const requestId = ++themeRequestId;
    const preparedTexture = await textureCache.prepare(theme);
    if (requestId !== themeRequestId || !preparedTexture) return;

    incomingTexture = preparedTexture;
    lilyProgram.uniforms.tNextMap.value = incomingTexture;
    lilyProgram.uniforms.uThemeTransition.value = 0;

    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (requestId !== themeRequestId) return;

    themeTransitionStarted = performance.now();
    ensureAnimation();
  }

  function applyTheme(theme) {
    if (!theme) return;

    const shouldTransition = currentThemeId !== null && currentThemeId !== theme.id;
    currentThemeId = theme.id;

    const light = new Float32Array(theme.light);
    const deep = new Float32Array(theme.deep);
    lilyProgram.uniforms.uAccentLight.value = light;
    particleProgram.uniforms.uAccentLight.value = light;
    particleProgram.uniforms.uAccentDeep.value = deep;
    flower.setAttribute(
      'aria-label',
      `Interactive ${theme.colorName} spider lily. Move the pointer or press Enter to release pigment.`,
    );
    if (shouldTransition) {
      transitionThemeImage(theme).catch((error) => {
        console.warn(`[lily] Could not transition to the ${theme.id} texture.`, error);
      });
    } else {
      renderer.render({ scene });
    }
  }

  const unregisterThemePreparer = registerThemePreparer(
    (theme, options) => textureCache.prepare(theme, options),
  );
  const unsubscribeTheme = subscribeTheme(applyTheme);
  const unsubscribeWeather = subscribeWeather(applyWeather);

  image.addEventListener('load', () => {
    resize();
    ensureAnimation();
  }, { signal: lifecycle.signal });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && weatherIsMoving) ensureAnimation();
  }, { signal: lifecycle.signal });
  window.addEventListener('resize', resize, { signal: lifecycle.signal });
  reduceMotion.addEventListener('change', (event) => {
    if (!event.matches) return;
    cleanup();
  }, { signal: lifecycle.signal });

  flower.setAttribute('role', 'button');
  flower.setAttribute('tabindex', '0');
  flower.setAttribute(
    'aria-label',
    'Interactive spider lily. Move the pointer or press Enter to release pigment.',
  );

  resize();
  flower.classList.add('is-alive');

  void textureCache.warm(THEMES, currentThemeId, (theme, error) => {
    console.warn(`[lily] Could not warm the ${theme.id} texture.`, error);
  });

  let cleanedUp = false;
  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    lifecycle.abort();
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    unregisterThemePreparer();
    unsubscribeTheme();
    unsubscribeWeather();
    textureCache.destroy();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    flower.classList.remove('is-alive');
    flower.removeAttribute('role');
    flower.removeAttribute('tabindex');
    flower.removeAttribute('aria-label');
  }

  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) cleanup();
  }, { signal: lifecycle.signal });
}
