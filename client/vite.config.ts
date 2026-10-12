import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { docsSite } from './docs-site/plugin';

function statsShortcut(): Plugin {
  const rewrite = (url: string | undefined): string | undefined => {
    if (!url) return url;
    const [path, query] = url.split('?');
    if (path !== '/stats') return url;
    return query ? `/stats/?${query}` : '/stats/';
  };
  return {
    name: 'deepmark-stats-path',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        req.url = rewrite(req.url);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        req.url = rewrite(req.url);
        next();
      });
    },
  };
}

/**
 * The Stellar SDK is the one large dependency (about 650 kB minified, 135 kB
 * gzip). It is only ever reached through the dynamic import in
 * `src/stellar/lazy.ts`, which warms it when the browser is idle, so it never
 * sits on the path to the title. Naming it keeps it recognisable in the build
 * output and out of the game's own chunks.
 */
const STELLAR_SDK_CHUNK = 'stellar-sdk';
/**
 * Vite warns above this size, in kB. It sits just over the lazy SDK chunk so
 * the warning still fires if the SDK grows or if a heavy module lands in an
 * eager chunk. The tracked limit is the cold load transfer budget in
 * `scripts/budgets.ts`, documented in `docs/performance.md`.
 */
const CHUNK_WARNING_KB = 700;

/**
 * Vite's dynamic import helper is shared by every entry. Left to the SDK's
 * chunk assignment it would land inside it and make the title preload the SDK,
 * so it gets its own tiny chunk.
 */
function splitChunks(id: string): string | undefined {
  if (id.includes('vite/preload-helper')) return 'preload-helper';
  if (id.includes('/node_modules/@stellar/')) return STELLAR_SDK_CHUNK;
  return undefined;
}

export default defineConfig({
  plugins: [statsShortcut(), docsSite()],
  build: {
    chunkSizeWarningLimit: CHUNK_WARNING_KB,
    rollupOptions: {
      output: {
        manualChunks: splitChunks,
      },
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        stats: fileURLToPath(new URL('./stats/index.html', import.meta.url)),
      },
    },
  },
});
