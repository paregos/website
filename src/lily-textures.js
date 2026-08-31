import { Texture } from 'ogl';

const TEXTURE_SIZE = 900;

function isImageBitmap(value) {
  return typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap;
}

function waitForIdleFrame() {
  return new Promise((resolve) => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(resolve, { timeout: 120 });
    } else {
      setTimeout(resolve, 32);
    }
  });
}

async function loadImage(source) {
  const image = source instanceof HTMLImageElement ? source : new Image();
  if (!(source instanceof HTMLImageElement)) image.src = source;

  if (image.decode) {
    await image.decode();
  } else if (!image.complete) {
    await new Promise((resolve, reject) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', reject, { once: true });
    });
  }

  return image;
}

async function makeTextureSource(image) {
  if (!window.createImageBitmap || image.naturalWidth <= TEXTURE_SIZE) return image;

  try {
    return await window.createImageBitmap(image, {
      imageOrientation: 'flipY',
      resizeWidth: TEXTURE_SIZE,
      resizeHeight: TEXTURE_SIZE,
      resizeQuality: 'high',
    });
  } catch {
    return image;
  }
}

function createTexture(gl, image) {
  return new Texture(gl, {
    image,
    generateMipmaps: false,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
  });
}

export function createLilyTextureCache(gl, initialTheme, initialImage) {
  const entries = new Map();
  const pending = new Map();
  let destroyed = false;

  const initialTexture = createTexture(gl, initialImage);
  entries.set(initialTheme.id, { texture: initialTexture, source: initialImage });

  function prepare(theme, { idle = false } = {}) {
    if (destroyed) return Promise.reject(new Error('Lily texture cache is closed'));
    if (entries.has(theme.id)) return Promise.resolve(entries.get(theme.id).texture);
    if (pending.has(theme.id)) return pending.get(theme.id);

    const preparation = (async () => {
      const image = await loadImage(theme.image);
      const source = await makeTextureSource(image);
      const texture = createTexture(gl, source);

      if (idle) await waitForIdleFrame();
      if (destroyed) {
        if (isImageBitmap(source)) source.close();
        gl.deleteTexture(texture.texture);
        throw new Error('Lily texture cache closed during preparation');
      }

      texture.update(1);
      entries.set(theme.id, { texture, source });
      return texture;
    })().finally(() => pending.delete(theme.id));

    pending.set(theme.id, preparation);
    return preparation;
  }

  async function warm(themes, activeThemeId, onError) {
    for (const theme of themes) {
      if (destroyed || theme.id === activeThemeId) continue;
      try {
        await prepare(theme, { idle: true });
      } catch (error) {
        if (!destroyed) onError?.(theme, error);
      }
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;

    for (const { texture, source } of entries.values()) {
      gl.deleteTexture(texture.texture);
      if (isImageBitmap(source)) source.close();
    }
    entries.clear();
  }

  return {
    initialTexture,
    prepare,
    warm,
    destroy,
  };
}
