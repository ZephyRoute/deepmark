import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

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

export default defineConfig({
  plugins: [statsShortcut()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        stats: fileURLToPath(new URL('./stats/index.html', import.meta.url)),
      },
    },
  },
});
