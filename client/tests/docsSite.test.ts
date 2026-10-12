import { describe, expect, test } from 'bun:test';
import { buildSite } from '../docs-site/site';
import { resolveHref, type LinkContext } from '../docs-site/links';
import { PAGES, pageUrl } from '../docs-site/manifest';

const EM_DASH = String.fromCharCode(0x2014);
const site = buildSite();

function html(path: string): string {
  const content = site.get(path);
  if (typeof content !== 'string') throw new Error(`missing ${path}`);
  return content;
}

describe('docs site', () => {
  test('the index and every navigation page exist', () => {
    expect(site.has('docs/index.html')).toBe(true);
    for (const page of PAGES) expect(site.has(`docs/${page.slug}/index.html`)).toBe(true);
  });

  test('no generated text contains an em dash', () => {
    for (const [path, content] of site) {
      if (typeof content === 'string') expect(content.includes(EM_DASH), path).toBe(false);
    }
  });

  test('pages ship no script and keep their SEO tags', () => {
    for (const page of PAGES) {
      const doc = html(`docs/${page.slug}/index.html`);
      expect(doc.includes('<script'), page.slug).toBe(false);
      expect(doc).toContain(`<link rel="canonical" href="https://deepmark-dun.vercel.app${pageUrl(page.slug)}">`);
      expect(doc).toContain('property="og:title"');
      expect(doc).toContain('name="description"');
      expect(doc).toContain('class="skip"');
    }
  });

  test('every local image and stylesheet a page references was emitted', () => {
    for (const [path, content] of site) {
      if (!path.endsWith('.html') || typeof content !== 'string') continue;
      for (const match of content.matchAll(/(?:src|href)="(\/docs\/(?:img|assets)\/[^"#]+)"/g)) {
        const target = match[1];
        if (target) expect(site.has(target.slice(1)), `${path} -> ${target}`).toBe(true);
      }
    }
  });

  test('explorer links on the contracts page are clickable', () => {
    expect(html('docs/contracts/index.html')).toContain('href="https://stellar.expert/explorer/testnet/contract/');
  });

  test('a broken internal link fails loudly', () => {
    const ctx: LinkContext = { anchors: new Map(), diagramStems: new Set(), images: new Map() };
    expect(() => resolveHref('docs/does-not-exist.md', 'README.md', 'overview', ctx)).toThrow('broken link');
    expect(resolveHref('LICENSE', 'README.md', 'overview', ctx)).toBe('https://github.com/ZephyRoute/deepmark/blob/main/LICENSE');
  });
});
