/**
 * The title screen. Painted key art with a quiet camera: a slow parallax that
 * follows the pointer, a lantern light that flickers, embers that rise from the
 * lantern, and a short entrance that brings in the art first, then the stone
 * logo, then the menu. Persistent like the creator, so data arriving from
 * Stellar updates text in place and never replays the entrance.
 */
import { startEmbers } from './embers';
import { prefersReducedMotion } from './preferences';

export interface TitleInfo {
  local: string;
  chain: string;
  vault: string;
}

// Where the lantern sits inside the key art, as a fraction of the image.
const LANTERN_X = 0.58;
const LANTERN_Y = 0.73;
const ART_W = 2400;
const ART_H = 1350;
const POS_X = 0.28;
const POS_Y = 0.62;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function menuItem(label: string, action: string, primary = false): HTMLButtonElement {
  const b = el('button', primary ? 'menu-item is-primary' : 'menu-item', label);
  b.type = 'button';
  b.dataset.action = action;
  return b;
}

let applyInfo: ((info: TitleInfo) => void) | null = null;

export function updateTitle(info: TitleInfo): void {
  applyInfo?.(info);
}

export function mountTitle(host: HTMLElement, info: TitleInfo): void {
  host.replaceChildren();
  const calm = prefersReducedMotion();
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  const root = el('div', 'title-screen title-v2');
  const stage = el('div', 'title-stage');
  const art = el('img', 'title-img');
  art.src = '/art/title-key-art.webp';
  art.alt = '';
  art.decoding = 'async';
  const light = el('div', 'title-light');
  const fog = el('div', 'title-fog');
  const embers = document.createElement('canvas');
  embers.className = 'title-embers';
  embers.setAttribute('aria-hidden', 'true');
  const shade = el('div', 'title-shade');
  stage.append(art, light, fog, embers, shade);

  const content = el('div', 'title-content');
  const logo = el('img', 'title-logo');
  logo.src = '/art/logo-lockup.webp';
  logo.alt = '';
  logo.width = 520;
  logo.height = 195;
  const tagline = el('p', 'title-tagline', 'Leave a mark in the depths, or lose it on the way out.');
  const menu = el('nav', 'menu');
  menu.setAttribute('aria-label', 'Main menu');
  menu.append(
    menuItem('Forge a delver', 'confirm', true),
    menuItem('Vault', 'vault'),
    menuItem('Leaderboard', 'leaderboard'),
    menuItem('Your record', 'stats')
  );
  const infoLocal = el('p', 'title-info');
  const infoChain = el('p', 'title-info is-chain');
  const infoVault = el('p', 'title-info is-chain');
  const hint = el('p', 'title-hint', 'Enter forges a delver. V the vault. L the leaderboard. M your record. N sound.');
  const players = el('a', 'quiet-link', 'All players');
  players.href = '/stats';
  const docs = el('a', 'quiet-link', 'Docs');
  docs.href = '/docs';
  const links = el('div', 'quiet-links');
  links.append(players, docs);
  content.append(logo, tagline, menu, infoLocal, infoChain, infoVault, hint, links);

  root.append(stage, content);
  host.append(root);

  // Menu items arrive one after another.
  menu.querySelectorAll<HTMLElement>('.menu-item').forEach((node, i) => {
    node.style.setProperty('--i', String(i));
  });

  const set = (node: HTMLElement, text: string): void => {
    node.textContent = text;
    node.hidden = text === '';
  };
  applyInfo = (next) => {
    set(infoLocal, next.local);
    set(infoChain, next.chain);
    set(infoVault, next.vault);
  };
  applyInfo(info);

  // Lantern position follows how the cover-fitted art lands in the window.
  const place = (): void => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (w === 0 || h === 0) return;
    const s = Math.max(w / ART_W, h / ART_H);
    const iw = ART_W * s;
    const ih = ART_H * s;
    const x = (w - iw) * POS_X + LANTERN_X * iw;
    const y = (h - ih) * POS_Y + LANTERN_Y * ih;
    light.style.setProperty('--lx', `${x}px`);
    light.style.setProperty('--ly', `${y}px`);
  };
  place();
  const resizer = new ResizeObserver(place);
  resizer.observe(stage);

  let running = true;
  let stopEmbers: () => void = () => undefined;
  if (!calm) {
    stopEmbers = startEmbers(embers, {
      count: 26,
      warm: 0.55,
      rise: 0.045,
      origin: () => {
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        const s = Math.max(w / ART_W, h / ART_H);
        const iw = ART_W * s;
        const ih = ART_H * s;
        return {
          x: (w - iw) * POS_X + LANTERN_X * iw,
          y: (h - ih) * POS_Y + LANTERN_Y * ih,
          spread: 90,
        };
      },
    });
  }

  // Parallax and light: one rAF loop, transform and opacity only.
  let tx = 0;
  let ty = 0;
  let cx = 0;
  let cy = 0;
  const onMove = (event: PointerEvent): void => {
    tx = event.clientX / window.innerWidth - 0.5;
    ty = event.clientY / window.innerHeight - 0.5;
  };
  if (!calm && !coarse) window.addEventListener('pointermove', onMove, { passive: true });

  const loop = (now: number): void => {
    if (!running) return;
    if (!root.isConnected) {
      running = false;
      return;
    }
    cx += (tx - cx) * 0.05;
    cy += (ty - cy) * 0.05;
    const t = now / 1000;
    const flick = 0.84 + Math.sin(t * 7.3) * 0.07 + Math.sin(t * 19.1 + 1.7) * 0.05 + Math.sin(t * 31) * 0.025;
    if (!calm) {
      art.style.transform = `translate3d(${(-cx * 16).toFixed(2)}px, ${(-cy * 10).toFixed(2)}px, 0) scale(1.05)`;
      light.style.transform = `translate3d(${(-cx * 16).toFixed(2)}px, ${(-cy * 10).toFixed(2)}px, 0)`;
    }
    light.style.opacity = flick.toFixed(3);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const observer = new MutationObserver(() => {
    if (!root.isConnected) {
      running = false;
      stopEmbers();
      resizer.disconnect();
      window.removeEventListener('pointermove', onMove);
      if (applyInfo) applyInfo = null;
      observer.disconnect();
    }
  });
  observer.observe(host, { childList: true });
}
