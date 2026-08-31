import { defineConfig } from 'vite';

const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  // Project Pages sites live at /<repository>/ rather than the domain root.
  // Keep local development and other static hosts root-relative instead.
  base: isGitHubPagesBuild ? '/website/' : '/',
});
