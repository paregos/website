const endpoint = document.documentElement.dataset.nowPlayingEndpoint;
const row = document.querySelector('[data-now-playing]');
const track = document.querySelector('[data-now-playing-track]');
const artist = document.querySelector('[data-now-playing-artist]');
const link = document.querySelector('[data-now-playing-link]');
const POLL_MS = 45_000;

if (endpoint && row && track && artist && link) {
  let timer = 0;
  const lifecycle = new AbortController();

  async function refresh() {
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
        signal: lifecycle.signal,
      });

      if (!response.ok) throw new Error(`Now playing request failed: ${response.status}`);
      const playing = await response.json();

      if (!playing.isPlaying || !playing.name || !playing.artist || !playing.url) {
        row.hidden = true;
        return;
      }

      track.textContent = playing.name;
      artist.textContent = playing.artist;
      link.href = playing.url;
      row.hidden = false;
    } catch (error) {
      if (error.name !== 'AbortError') row.hidden = true;
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = window.setTimeout(async () => {
      await refresh();
      schedule();
    }, POLL_MS);
  }

  refresh().finally(schedule);

  window.addEventListener('pagehide', () => {
    clearTimeout(timer);
    lifecycle.abort();
  }, { once: true });
}
