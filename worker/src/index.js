let accessToken = '';
let accessTokenExpiresAt = 0;

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';

function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim());

  if (!origin || !allowedOrigins.includes(origin)) return null;

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept',
    Vary: 'Origin',
  };
}

function json(body, status, corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function getAccessToken(env) {
  if (accessToken && Date.now() < accessTokenExpiresAt) return accessToken;

  const credentials = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: env.SPOTIFY_REFRESH_TOKEN,
    }),
  });

  if (!response.ok) throw new Error(`Spotify token refresh failed: ${response.status}`);

  const token = await response.json();
  accessToken = token.access_token;
  accessTokenExpiresAt = Date.now() + Math.max(0, (token.expires_in - 60) * 1000);
  return accessToken;
}

function describeItem(item) {
  if (!item) return null;

  if (item.type === 'episode') {
    return {
      name: item.name,
      artist: item.show?.name || 'Podcast',
      url: item.external_urls?.spotify,
    };
  }

  return {
    name: item.name,
    artist: item.artists?.map((person) => person.name).join(', '),
    url: item.external_urls?.spotify,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(request, env);

    if (!corsHeaders) return new Response('Forbidden', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (request.method !== 'GET' || url.pathname !== '/now-playing') {
      return json({ error: 'Not found' }, 404, corsHeaders);
    }

    try {
      const token = await getAccessToken(env);
      const response = await fetch(SPOTIFY_NOW_PLAYING_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 204) return json({ isPlaying: false }, 200, corsHeaders);
      if (!response.ok) throw new Error(`Spotify playback lookup failed: ${response.status}`);

      const payload = await response.json();
      const item = describeItem(payload.item);
      return json({ isPlaying: Boolean(payload.is_playing && item), ...item }, 200, corsHeaders);
    } catch (error) {
      console.error(error.message);
      return json({ error: 'Now playing is temporarily unavailable' }, 503, corsHeaders);
    }
  },
};
