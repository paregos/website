import { createServer } from 'node:http';

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = 'http://127.0.0.1:8977/callback';
const scope = 'user-read-currently-playing';

if (!clientId || !clientSecret) {
  console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET before running this script.');
  process.exit(1);
}

const authorizeUrl = new URL('https://accounts.spotify.com/authorize');
authorizeUrl.search = new URLSearchParams({
  client_id: clientId,
  response_type: 'code',
  redirect_uri: redirectUri,
  scope,
});

const server = createServer(async (request, response) => {
  const callbackUrl = new URL(request.url, redirectUri);
  const code = callbackUrl.searchParams.get('code');
  const error = callbackUrl.searchParams.get('error');

  if (error || !code) {
    response.end('Spotify authorisation was cancelled. You can close this window.');
    server.close();
    return;
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) throw new Error(`Spotify returned ${tokenResponse.status}`);
    const token = await tokenResponse.json();
    console.log(`\nRefresh token (keep this private):\n${token.refresh_token}\n`);
    response.end('Authorised. Return to the terminal for the next step.');
  } catch (tokenError) {
    console.error(tokenError.message);
    response.end('The token exchange failed. Check the terminal and try again.');
  } finally {
    server.close();
  }
});

server.listen(8977, '127.0.0.1', () => {
  console.log('\nOpen this Spotify approval link in your browser:\n');
  console.log(authorizeUrl.toString());
});
