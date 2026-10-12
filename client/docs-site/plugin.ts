import type { Plugin } from 'vite';
import { buildSite, type SiteFiles } from './site';

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  svg: 'image/svg+xml',
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

/** `/docs` and `/docs/page` become `/docs/` and `/docs/page/`, like Vercel does for a directory. */
function withTrailingSlash(url: string): string {
  const [path = '', query] = url.split('?');
  if (!/^\/docs(\/[^/.]+)?$/.test(path)) return url;
  return query ? `${path}/?${query}` : `${path}/`;
}

export function docsSite(): Plugin {
  let cached: SiteFiles | undefined;
  return {
    name: 'deepmark-docs-site',
    buildStart() {
      cached = buildSite();
    },
    generateBundle() {
      for (const [fileName, source] of cached ?? buildSite()) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = withTrailingSlash(req.url ?? '');
        const path = url.split('?')[0] ?? '';
        if (!path.startsWith('/docs')) return next();
        const key = path.endsWith('/') ? `${path.slice(1)}index.html` : path.slice(1);
        const content = buildSite().get(key);
        if (content === undefined) return next();
        res.setHeader('Content-Type', CONTENT_TYPES[key.split('.').pop() ?? ''] ?? 'application/octet-stream');
        res.end(content);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url) req.url = withTrailingSlash(req.url);
        next();
      });
    },
  };
}
