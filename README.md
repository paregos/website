# Ben Mitchell's website

A small, single-page personal website deployed from GitHub Actions to GitHub
Pages:

<https://paregos.github.io/website/>

For the visual system and code map, read [`AGENTS.md`](AGENTS.md). This README
also records the one external integration that needs occasional maintenance.

## Spotify now playing

The optional `Listening to` line gets its data without exposing Spotify
credentials to visitors.

```text
GitHub Pages browser → Cloudflare Worker → Spotify Web API
```

- Website module: `src/spotify.js`
- Website endpoint setting: `data-now-playing-endpoint` on `<html>` in
  `index.html`
- Worker source/config: `worker/src/index.js`, `worker/wrangler.jsonc`
- Worker URL: `https://ben-now-playing.ben-mitchell-website.workers.dev/now-playing`
- Local OAuth helper: `scripts/spotify-authorize.mjs`

The Worker returns only a track/episode name, artist/show, and Spotify URL. It
allows requests from `https://paregos.github.io` and local Vite development.
The site hides the whole row if nothing is playing or the Worker cannot reach
Spotify.

### Secrets

These values are stored as Cloudflare Worker secrets, never in Git, source
files, or this document:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

The Spotify app has this exact redirect URI registered:

```text
http://127.0.0.1:8977/callback
```

## Reauthorising Spotify

Spotify Developer Dashboard refresh tokens currently expire after six months;
refreshing an access token does **not** extend that period. If the Listening
line quietly disappears while music is playing, reauthorise it as follows.

1. In a terminal, enter the project directory:

   ```sh
   cd ~/work/website
   ```

2. Get the Client ID and Client Secret from the existing Spotify Developer
   Dashboard app. Do not paste either into chat or commit them.

3. Run the local authorisation helper, entering the values privately when
   prompted:

   ```sh
   read -rsp "Spotify Client ID: " SPOTIFY_CLIENT_ID; echo
   export SPOTIFY_CLIENT_ID
   read -rsp "Spotify Client Secret: " SPOTIFY_CLIENT_SECRET; echo
   export SPOTIFY_CLIENT_SECRET
   npm run spotify:authorize
   ```

4. Open the printed Spotify approval link. After approving, the terminal
   prints a new refresh token. Enter that directly into Cloudflare:

   ```sh
   npx wrangler secret put SPOTIFY_REFRESH_TOKEN --config worker/wrangler.jsonc
   ```

   `wrangler` prompts for the value and deploys the updated secret. The static
   website does not need a GitHub Pages deployment for this step.

5. Play a track and test the Worker from the public site origin:

   ```sh
   curl -sS -H 'Origin: https://paregos.github.io' \
     https://ben-now-playing.ben-mitchell-website.workers.dev/now-playing
   ```

   A successful response has `"isPlaying": true` plus a name, artist, and
   Spotify URL. If no track is active it returns `"isPlaying": false`.

If the Spotify app's Client ID or Client Secret is rotated, update it in
Cloudflare too with `npx wrangler secret put SPOTIFY_CLIENT_ID ...` and
`npx wrangler secret put SPOTIFY_CLIENT_SECRET ...` before reauthorising.

## Changing the public site address

The Worker restricts browser requests through `ALLOWED_ORIGINS` in
`worker/wrangler.jsonc`. If the GitHub username, repository path, or a custom
domain changes, update that allow-list and deploy the Worker:

```sh
npm run worker:deploy
```

Also update `data-now-playing-endpoint` in `index.html` if the Worker URL ever
changes, then deploy the website through the usual GitHub push.

## Useful commands

```sh
npm run dev -- --host 0.0.0.0 --port 8000
npm run check
npm run worker:dev
npm run worker:deploy
```
