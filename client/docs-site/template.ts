import { DOCS_BASE, GITHUB_BLOB, GITHUB_REPO, PAGES, SITE_ORIGIN, pageUrl, type DocPage } from './manifest';
import { escapeHtml } from './html';

export interface Shell {
  /** Route path with a leading slash, for example /docs/overview/. */
  path: string;
  /** The URL search engines should index. */
  canonical: string;
  title: string;
  description: string;
  heading: string;
  bodyHtml: string;
  cssHref: string;
  ogImage: string;
  /** The nav entry to mark as current, or undefined for the index. */
  currentSlug?: string;
  prev?: DocPage;
  next?: DocPage;
  /** Repository file the page comes from, for the edit link. */
  sourceFile?: string;
}

const SITE_NAME = 'Deepmark docs';

function navHtml(currentSlug: string | undefined): string {
  const items = PAGES.map((page) => {
    const current = page.slug === currentSlug ? ' aria-current="page"' : '';
    return `<li><a href="${pageUrl(page.slug)}"${current}>${escapeHtml(page.title)}</a></li>`;
  }).join('\n');
  const home = currentSlug === undefined ? ' aria-current="page"' : '';
  return `<ul>\n<li><a href="${DOCS_BASE}/"${home}>Docs home</a></li>\n${items}\n</ul>`;
}

function pagerHtml(prev: DocPage | undefined, next: DocPage | undefined, isHome: boolean): string {
  const link = (page: DocPage, rel: 'prev' | 'next', label: string): string =>
    `<a class="pager-${rel}" rel="${rel}" href="${pageUrl(page.slug)}"><span>${label}</span>${escapeHtml(page.title)}</a>`;
  const left = prev
    ? link(prev, 'prev', 'Previous')
    : isHome
      ? ''
      : `<a class="pager-prev" rel="prev" href="${DOCS_BASE}/"><span>Previous</span>Docs home</a>`;
  const right = next ? link(next, 'next', 'Next') : '';
  return `<nav class="pager" aria-label="Previous and next page">${left}${right}</nav>`;
}

export function renderShell(shell: Shell): string {
  const fullTitle = shell.path === `${DOCS_BASE}/` ? `${SITE_NAME}: ${shell.title}` : `${shell.title} | ${SITE_NAME}`;
  const description = escapeHtml(shell.description);
  const edit = shell.sourceFile
    ? `<a href="${GITHUB_BLOB}/${shell.sourceFile}" rel="noopener">View the source on GitHub</a>`
    : `<a href="${GITHUB_REPO}" rel="noopener">View the repository on GitHub</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${shell.canonical}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#07080e">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Deepmark">
<meta property="og:title" content="${escapeHtml(fullTitle)}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${shell.canonical}">
<meta property="og:image" content="${shell.ogImage}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="${shell.cssHref}">
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<header class="site-header">
<a class="brand" href="${DOCS_BASE}/">Deepmark <span>docs</span></a>
<nav class="site-links" aria-label="Site">
<a href="/">Play the game</a>
<a href="${GITHUB_REPO}" rel="noopener">GitHub</a>
</nav>
</header>
<div class="layout">
<input class="nav-toggle" type="checkbox" id="nav-toggle">
<label class="nav-button" for="nav-toggle">Pages</label>
<nav class="side-nav" aria-label="Documentation pages">
${navHtml(shell.currentSlug)}
</nav>
<main id="content" tabindex="-1">
<article class="prose">
<h1>${escapeHtml(shell.heading)}</h1>
${shell.bodyHtml}
</article>
${pagerHtml(shell.prev, shell.next, shell.currentSlug === undefined)}
</main>
</div>
<footer class="site-footer">
<p>${edit}. <a href="/">Play Deepmark</a>. <a href="${GITHUB_REPO}" rel="noopener">${GITHUB_REPO.replace('https://', '')}</a></p>
<p>Generated at build time from the markdown in the repository. Deepmark runs on Stellar testnet.</p>
</footer>
</body>
</html>
`;
}

export function canonicalFor(path: string): string {
  return path === `${DOCS_BASE}/` ? `${SITE_ORIGIN}${DOCS_BASE}` : `${SITE_ORIGIN}${path}`;
}
