import { existsSync, statSync } from 'node:fs';
import { posix, join } from 'node:path';
import { DIAGRAMS_DIR, GITHUB_BLOB, GITHUB_TREE, PAGES, pageUrl } from './manifest';
import { REPO_ROOT } from './sources';

/** Where a heading of a source file ended up in the site. */
export interface AnchorTarget {
  slug: string;
  id: string;
  /** The heading was left out of the page, so link to the page itself. */
  dropped: boolean;
}

export interface LinkContext {
  anchors: Map<string, AnchorTarget>;
  /** Slugs of the pages that exist, with the diagram stems of the diagrams page. */
  diagramStems: Set<string>;
  /** Images found while rendering: output name to repository path. */
  images: Map<string, string>;
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function anchorKey(file: string, slug: string): string {
  return `${file}#${slug}`;
}

/** The first page that renders a given source file. */
function pageForFile(file: string): string | undefined {
  return PAGES.find((page) => page.parts.some((part) => part.file === file))?.slug;
}

function repoPath(fromFile: string, target: string): string {
  const joined = posix.normalize(posix.join(posix.dirname(fromFile), target));
  if (joined.startsWith('..')) throw new Error(`docs: link "${target}" in ${fromFile} leaves the repository`);
  return joined;
}

function isDirectory(path: string): boolean {
  return statSync(join(REPO_ROOT, path)).isDirectory();
}

function fail(fromFile: string, href: string, why: string): never {
  throw new Error(`docs: broken link "${href}" in ${fromFile}: ${why}`);
}

/**
 * Turn a link written for GitHub into one that works on the site.
 * External links pass through, links between pages become docs routes,
 * links to other repository files become GitHub URLs. Anything else fails.
 */
export function resolveHref(href: string, fromFile: string, currentSlug: string, ctx: LinkContext): string {
  if (SCHEME.test(href)) return href;
  const hashAt = href.indexOf('#');
  const path = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : href.slice(hashAt + 1);
  const file = path === '' ? fromFile : repoPath(fromFile, decodeURI(path));

  if (file.startsWith(`${DIAGRAMS_DIR}/`) && file.endsWith('.svg')) {
    const stem = posix.basename(file, '.svg');
    if (!ctx.diagramStems.has(stem)) fail(fromFile, href, 'no such diagram');
    return `${pageUrl('diagrams')}#${stem}`;
  }

  const pageSlug = pageForFile(file);
  if (pageSlug) {
    if (!hash) return path === '' ? '#' : pageUrl(pageSlug);
    const target = ctx.anchors.get(anchorKey(file, hash));
    if (!target) fail(fromFile, href, `no heading "${hash}" in ${file}`);
    if (target.dropped) return target.slug === currentSlug ? '#' : pageUrl(target.slug);
    return target.slug === currentSlug ? `#${target.id}` : `${pageUrl(target.slug)}#${target.id}`;
  }

  if (!existsSync(join(REPO_ROOT, file))) fail(fromFile, href, `${file} does not exist`);
  return `${isDirectory(file) ? GITHUB_TREE : GITHUB_BLOB}/${file}`;
}

/** Resolve an image path, register it for copying, and return its site URL. */
export function resolveImage(href: string, fromFile: string, ctx: LinkContext): string {
  if (SCHEME.test(href)) return href;
  const file = repoPath(fromFile, decodeURI(href));
  const full = join(REPO_ROOT, file);
  if (!existsSync(full) || !statSync(full).isFile()) {
    throw new Error(`docs: missing image "${href}" in ${fromFile}`);
  }
  const name = posix.basename(file);
  const known = ctx.images.get(name);
  if (known && known !== file) throw new Error(`docs: two images share the name ${name}: ${known} and ${file}`);
  ctx.images.set(name, file);
  return `/docs/img/${name}`;
}
