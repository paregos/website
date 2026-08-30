import {
  Geometry,
  Mesh,
  Program,
  Renderer,
  Texture,
  Transform,
  Triangle,
  Vec2,
} from 'ogl';

const flower = document.querySelector('[data-lily]');
const image = flower?.querySelector('img');
const canvas = flower?.querySelector('.lily-canvas');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (flower && image && canvas && !reduceMotion.matches) {
  startLily().catch(() => {
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

  const scene = new Transform();
  const pointer = new Vec2(0.5, 0.55);
  const pointerTarget = new Vec2(0.5, 0.55);
  const texture = new Texture(gl, {
    image,
    generateMipmaps: false,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
  });

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
      uniform vec2 uPointer;
      uniform float uTime;
      uniform float uHover;
      uniform float uPulse;
      uniform float uWindStrength;
      uniform float uWindDirection;
      uniform float uRainStrength;
      uniform float uWeatherMute;
      uniform float uHeatStrength;

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

        vec2 warpedUv = vUv + direction * (softWave + pulseRing);
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

        vec4 pigment = texture2D(tMap, warpedUv);
        float blueBloom = exp(-distanceToPointer * 5.0) * uHover * 0.055;
        pigment.b = min(1.0, pigment.b + blueBloom * pigment.a);

        float luminance = dot(pigment.rgb, vec3(0.299, 0.587, 0.114));
        vec3 weatherGrey = vec3(luminance) * vec3(0.96, 0.98, 1.02);
        pigment.rgb = mix(pigment.rgb, weatherGrey, uWeatherMute);

        gl_FragColor = pigment;
      }
    `,
    uniforms: {
      tMap: { value: texture },
      uPointer: { value: pointer },
      uTime: { value: 0 },
      uHover: { value: 0 },
      uPulse: { value: -1 },
      uWindStrength: { value: 0 },
      uWindDirection: { value: 0 },
      uRainStrength: { value: 0 },
      uWeatherMute: { value: 0 },
      uHeatStrength: { value: 0 },
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

      void main() {
        float dotShape = smoothstep(0.5, 0.14, length(gl_PointCoord - 0.5));
        vec3 paleBlue = vec3(0.16, 0.42, 0.96);
        vec3 deepBlue = vec3(0.035, 0.12, 0.56);
        vec3 color = mix(deepBlue, paleBlue, vShade);
        gl_FragColor = vec4(color, dotShape * vAlpha);
      }
    `,
    uniforms: {
      uBurst: { value: -1 },
      uDpr: { value: renderer.dpr },
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

    lilyProgram.uniforms.uTime.value = time * 0.001;
    lilyProgram.uniforms.uHover.value = hover;
    lilyProgram.uniforms.uPulse.value = burst;
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
      !pointerIsSettled ||
      !tiltIsSettled ||
      (weatherIsMoving && !document.hidden);

    frameId = isActive ? requestAnimationFrame(render) : 0;
  }

  flower.addEventListener('pointerenter', () => {
    ensureAnimation();
  });
  flower.addEventListener('pointermove', (event) => {
    updatePointer(event);
    ensureAnimation();
  });
  flower.addEventListener('pointerleave', () => {
    hoverTarget = 0;
    pointerTarget.set(0.5, 0.55);
    tiltTargetX = 0;
    tiltTargetY = 0;
    ensureAnimation();
  });
  flower.addEventListener('click', releasePigment);
  flower.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      releasePigment();
    }
  });
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

  window.addEventListener('siteweatherchange', (event) => {
    applyWeather(event.detail);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && weatherIsMoving) ensureAnimation();
  });
  window.addEventListener('resize', resize);
  reduceMotion.addEventListener('change', (event) => {
    if (!event.matches) return;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    flower.classList.remove('is-alive');
    flower.removeAttribute('role');
    flower.removeAttribute('tabindex');
    flower.removeAttribute('aria-label');
  });

  flower.setAttribute('role', 'button');
  flower.setAttribute('tabindex', '0');
  flower.setAttribute(
    'aria-label',
    'Interactive blue spider lily. Move the pointer or press Enter to release pigment.',
  );

  resize();
  applyWeather(window.siteWeather);
  flower.classList.add('is-alive');
}
