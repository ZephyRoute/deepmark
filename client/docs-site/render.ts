import { Marked, type Token, type Tokens } from 'marked';
import { escapeHtml, githubSlug } from './html';
import { anchorKey, resolveHref, resolveImage, type AnchorTarget, type LinkContext } from './links';
import { extractPart } from './sources';
import type { DocPage } from './manifest';

/** A heading token that remembers the id it was given on its page. */
type DocHeading = Tokens.Heading & { docId?: string };

interface LexedPart {
  file: string;
  tokens: Token[];
}

export interface LexedPage {
  page: DocPage;
  parts: LexedPart[];
}

const marked = new Marked({ gfm: true });

function alignClass(align: 'left' | 'right' | 'center' | null): string {
  return align === 'right' || align === 'center' ? ` class="align-${align}"` : '';
}

function plainText(tokens: Token[] | undefined, fallback: string): string {
  if (!tokens || tokens.length === 0) return fallback;
  return tokens
    .map((t) => {
      const inner = (t as { tokens?: Token[] }).tokens;
      return inner ? plainText(inner, '') : ((t as { text?: string }).text ?? '');
    })
    .join('');
}

/** Phase one: lex every part, give headings page unique ids, record where each heading went. */
export function lexPage(page: DocPage, anchors: Map<string, AnchorTarget>): LexedPage {
  const used = new Map<string, number>();
  const parts: LexedPart[] = [];
  page.parts.forEach((part) => {
    const extracted = extractPart(part);
    const tokens = marked.lexer(extracted.markdown);
    marked.walkTokens(tokens, (token) => {
      if (token.type !== 'heading') return;
      const heading = token as DocHeading;
      if (extracted.shiftDepth) heading.depth = Math.max(2, heading.depth - 1);
      const base = githubSlug(plainText(heading.tokens, heading.text)) || 'section';
      const seen = used.get(base) ?? 0;
      used.set(base, seen + 1);
      heading.docId = seen === 0 ? base : `${base}-${seen}`;
      const key = anchorKey(part.file, base);
      if (!anchors.has(key)) anchors.set(key, { slug: page.slug, id: heading.docId, dropped: false });
    });
    if (part.heading) {
      const key = anchorKey(part.file, githubSlug(part.heading));
      const existing = anchors.get(key);
      if (part.dropHeading || !existing) {
        anchors.set(key, { slug: page.slug, id: githubSlug(part.heading), dropped: Boolean(part.dropHeading) });
      }
    }
    parts.push({ file: part.file, tokens });
  });
  return { page, parts };
}

/** Phase two: rewrite links and images, then render to HTML. */
export function renderPage(lexed: LexedPage, ctx: LinkContext): string {
  const renderer = new Marked({
    gfm: true,
    renderer: {
      heading(token) {
        const { depth, tokens, docId } = token as DocHeading;
        const text = this.parser.parseInline(tokens);
        const id = docId ?? '';
        return `<h${depth} id="${id}">${text}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const external = /^https?:/i.test(href);
        const attrs = `${title ? ` title="${escapeHtml(title)}"` : ''}${external ? ' rel="noopener"' : ''}`;
        return `<a href="${escapeHtml(href)}"${attrs}>${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href, title, text }) {
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy" decoding="async">`;
      },
      table(token) {
        const header = token.header.map((cell) => `<th${alignClass(cell.align)}>${this.parser.parseInline(cell.tokens)}</th>`).join('');
        const rows = token.rows
          .map(
            (row) => `<tr>${row.map((cell) => `<td${alignClass(cell.align)}>${this.parser.parseInline(cell.tokens)}</td>`).join('')}</tr>`
          )
          .join('\n');
        return `<div class="table-wrap" tabindex="0" role="region" aria-label="Table, scrolls sideways"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
      },
    },
  });

  return lexed.parts
    .map((part) => {
      renderer.walkTokens(part.tokens, (token) => {
        if (token.type === 'link') token.href = resolveHref(token.href, part.file, lexed.page.slug, ctx);
        if (token.type === 'image') token.href = resolveImage(token.href, part.file, ctx);
      });
      return renderer.parser(part.tokens);
    })
    .join('\n');
}
