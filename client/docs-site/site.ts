import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadDiagrams, type Diagram } from './diagrams';
import { escapeHtml } from './html';
import type { AnchorTarget, LinkContext } from './links';
import { DIAGRAMS_DIR, DOCS_BASE, OG_IMAGE_SOURCE, PAGES, SITE_ORIGIN, pageUrl } from './manifest';
import { lexPage, renderPage } from './render';
import { REPO_ROOT } from './sources';
import { canonicalFor, renderShell, type Shell } from './template';

export type SiteFiles = Map<string, string | Uint8Array>;

const EM_DASH = String.fromCharCode(0x2014);
const OG_IMAGE_NAME = 'og-poster.jpg';

function diagramsBody(diagrams: Diagram[]): string {
  const intro =
    '<p>Seven diagrams, drawn from one source each and checked into the repository. Select a diagram to open the full size file.</p>';
  const sections = diagrams
    .map(
      (d) => `<section aria-labelledby="h-${d.stem}">
<h2 id="${d.stem}"><span id="h-${d.stem}">${escapeHtml(d.title)}</span><a class="anchor" href="#${d.stem}" aria-label="Link to this diagram">#</a></h2>
<figure>
<div class="diagram"><a href="/docs/img/${d.stem}.svg"><img src="/docs/img/${d.stem}.svg" alt="${escapeHtml(`${d.title}. ${d.description}`)}" loading="lazy" decoding="async"></a></div>
<figcaption>${escapeHtml(d.description)}</figcaption>
</figure>
</section>`
    )
    .join('\n');
  return `${intro}\n${sections}`;
}

function indexBody(): string {
  const cards = PAGES.map(
    (page) =>
      `<li><a href="${pageUrl(page.slug)}"><strong>${escapeHtml(page.title)}</strong><span>${escapeHtml(page.description)}</span></a></li>`
  ).join('\n');
  return `<p class="lede">Deepmark is a turn based dungeon crawler where a Stellar contract replays every run, so a result or a relic cannot be claimed without playing for it. These pages are built from the markdown in the repository.</p>
<p><a class="button" href="/">Play the game</a> <a class="button ghost" href="${pageUrl('verify')}">Verify a run in 60 seconds</a></p>
<ul class="cards">
${cards}
</ul>`;
}

/** Build every file of the docs site, relative to the site root (for example docs/overview/index.html). */
export function buildSite(): SiteFiles {
  const files: SiteFiles = new Map();
  const diagrams = loadDiagrams();
  const anchors = new Map<string, AnchorTarget>();
  const ctx: LinkContext = {
    anchors,
    diagramStems: new Set(diagrams.map((d) => d.stem)),
    images: new Map(diagrams.map((d) => [`${d.stem}.svg`, d.file])),
  };

  const css = readFileSync(join(import.meta.dirname, 'docs.css'));
  const cssHash = createHash('sha256').update(css).digest('hex').slice(0, 10);
  const cssPath = `${DOCS_BASE}/assets/docs-${cssHash}.css`;
  files.set(cssPath.slice(1), css);
  const ogImage = `${SITE_ORIGIN}${DOCS_BASE}/img/${OG_IMAGE_NAME}`;
  files.set(`docs/img/${OG_IMAGE_NAME}`, readFileSync(join(REPO_ROOT, OG_IMAGE_SOURCE)));

  const lexed = PAGES.map((page) => ({ page, lexed: page.generated ? undefined : lexPage(page, anchors) }));

  const emit = (shell: Shell): void => {
    files.set(`${shell.path.slice(1)}index.html`, renderShell(shell));
  };

  emit({
    path: `${DOCS_BASE}/`,
    canonical: canonicalFor(`${DOCS_BASE}/`),
    title: 'Documentation',
    heading: 'Deepmark documentation',
    description:
      'Documentation for Deepmark, a dungeon crawler on Stellar where the contract replays every run: how it works, how to verify a run, contracts, threat model and roadmap.',
    bodyHtml: indexBody(),
    cssHref: cssPath,
    ogImage,
    next: PAGES[0],
  });

  lexed.forEach(({ page, lexed: lex }, i) => {
    const bodyHtml = lex ? renderPage(lex, ctx) : diagramsBody(diagrams);
    const path = pageUrl(page.slug);
    emit({
      path,
      canonical: canonicalFor(path),
      title: page.title,
      heading: page.title,
      description: page.description,
      bodyHtml,
      cssHref: cssPath,
      ogImage,
      currentSlug: page.slug,
      prev: PAGES[i - 1],
      next: PAGES[i + 1],
      sourceFile: page.generated ? DIAGRAMS_DIR : page.parts[0]?.file,
    });
  });

  for (const d of diagrams) files.set(`docs/img/${d.stem}.svg`, d.bytes);
  for (const [name, file] of ctx.images) {
    if (!files.has(`docs/img/${name}`)) files.set(`docs/img/${name}`, readFileSync(join(REPO_ROOT, file)));
  }

  for (const [path, content] of files) {
    if (typeof content === 'string' && content.includes(EM_DASH)) {
      throw new Error(`docs: ${path} contains an em dash, fix the source markdown`);
    }
  }
  return files;
}
