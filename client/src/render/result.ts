/**
 * The result ceremony. The outcome appears the moment a run ends, with numbers
 * that count up, so nobody waits to learn how they did. Verification runs
 * alongside as a short story: the contract replays the descent floor by floor,
 * a light sweeps the ribbon, and when it finishes a seal is pressed. If a
 * delver was earned, it is revealed after the seal.
 *
 * Like the creator, this component owns its DOM. The overlay renderer mounts it
 * once per run and only calls `updateVerification` afterwards.
 */
import { emblemIcon } from './emblems';

export interface ResultSummary {
  won: boolean;
  floorReached: number;
  maxFloor: number;
  relics: number;
  score: number;
  hpLeft: number;
  newBest: boolean;
  bestLine: string;
  delver: { name: string; art: string; filter: string; emblem: number };
}

export type VerifyState = 'pending' | 'waiting' | 'verified' | 'failed' | 'practice';

export interface Verification {
  state: VerifyState;
  /** A failure explanation or practice note, shown in place of the story. */
  message: string;
  rank: number | null;
  txUrl: string | null;
  heroEarned: boolean;
  canRetry: boolean;
}

const STORY: Record<'pending' | 'waiting', string> = {
  pending: 'The contract is replaying your descent',
  waiting: 'Waiting for Stellar to settle the replay',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function reduced(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function countUp(node: HTMLElement, to: number, suffix = '', delay = 0): void {
  if (reduced() || to <= 0) {
    node.textContent = `${to}${suffix}`;
    return;
  }
  node.textContent = `0${suffix}`;
  const duration = 700;
  window.setTimeout(() => {
    const start = performance.now();
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      node.textContent = `${Math.round(to * eased)}${suffix}`;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, delay);
}

function stat(label: string, value: number, suffix: string, delay: number): HTMLElement {
  const tile = el('div', 'result-stat');
  tile.style.animationDelay = `${delay}ms`;
  const number = el('span', 'result-stat-value');
  countUp(number, value, suffix, delay + 200);
  tile.append(number, el('span', 'result-stat-label', label));
  return tile;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function sealIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('class', 'seal-icon');
  svg.setAttribute('aria-hidden', 'true');
  const outer = document.createElementNS(SVG_NS, 'circle');
  outer.setAttribute('cx', '32');
  outer.setAttribute('cy', '32');
  outer.setAttribute('r', '29');
  const inner = document.createElementNS(SVG_NS, 'circle');
  inner.setAttribute('cx', '32');
  inner.setAttribute('cy', '32');
  inner.setAttribute('r', '22');
  const check = document.createElementNS(SVG_NS, 'path');
  check.setAttribute('d', 'M20 33l8 8 17-18');
  check.setAttribute('class', 'seal-check');
  svg.append(outer, inner, check);
  return svg;
}

let applyVerification: ((v: Verification) => void) | null = null;

/** Updates the mounted ceremony, if there is one. Cheap to call every frame. */
export function updateVerification(v: Verification): void {
  applyVerification?.(v);
}

export function mountResult(host: HTMLElement, summary: ResultSummary): void {
  host.replaceChildren();
  const card = el('div', summary.won ? 'panel result result-win' : 'panel result result-loss');

  card.append(
    el('p', 'result-eyebrow', summary.won ? 'The depths let you go' : 'The depths keep what you carried'),
    el('h2', 'result-title', summary.won ? 'Extracted' : 'Lost in the dark')
  );

  const stats = el('div', 'result-stats');
  stats.append(
    stat('Floor', summary.floorReached, ` / ${summary.maxFloor}`, 120),
    stat('Relics', summary.relics, '', 220),
    stat('Score', summary.score, '', 320),
    stat('HP left', summary.hpLeft, '', 420)
  );
  card.append(stats);
  if (summary.newBest) card.append(el('p', 'new-best', 'New best'));
  card.append(el('p', 'stats', summary.bestLine));

  // The replay ribbon: one pip per floor, a sweeping light while the contract reads the run.
  const ribbon = el('div', 'ribbon is-pending');
  const track = el('div', 'ribbon-track');
  const sweep = el('span', 'ribbon-sweep');
  track.append(sweep);
  const pips = el('ol', 'ribbon-pips');
  for (let floor = 1; floor <= summary.maxFloor; floor += 1) {
    const pip = el('li', floor <= summary.floorReached ? 'ribbon-pip is-reached' : 'ribbon-pip');
    pip.style.animationDelay = `${500 + floor * 160}ms`;
    pip.append(el('span', 'ribbon-pip-dot'), el('span', 'ribbon-pip-label', `Floor ${floor}`));
    pips.append(pip);
  }
  const sealWrap = el('div', 'seal-wrap');
  const seal = el('div', 'seal');
  seal.append(sealIcon());
  sealWrap.append(seal);
  ribbon.append(track, pips);
  card.append(ribbon, sealWrap);

  const story = el('p', 'ribbon-story', STORY.pending);
  story.setAttribute('role', 'status');
  card.append(story);

  const meta = el('div', 'result-meta');
  const rank = el('span', 'chip-rank');
  rank.hidden = true;
  const tx = el('a', 'quiet-link', 'View the transaction');
  tx.hidden = true;
  tx.target = '_blank';
  tx.rel = 'noopener noreferrer';
  meta.append(rank, tx);
  card.append(meta);

  // The earned delver, revealed after the seal.
  const hero = el('div', 'result-hero');
  hero.hidden = true;
  const medallion = el('div', 'hero-medallion');
  const portrait = el('img', 'hero-medallion-portrait');
  portrait.src = `/art/${summary.delver.art}`;
  portrait.alt = '';
  portrait.style.filter = summary.delver.filter;
  const crest = el('span', 'hero-medallion-crest');
  crest.append(emblemIcon(summary.delver.emblem, 'emblem'));
  medallion.append(portrait, crest);
  const heroCopy = el('div', 'hero-copy-block');
  heroCopy.append(el('p', 'hero-kicker', 'A new delver is yours'), el('p', 'hero-earned-name', summary.delver.name));
  const vault = el('button', 'btn btn-primary', 'Open the vault');
  vault.type = 'button';
  vault.dataset.action = 'vault';
  heroCopy.append(vault);
  hero.append(medallion, heroCopy);
  card.append(hero);

  const share = el('div', 'share-actions');
  share.hidden = true;
  const shareSave = el('button', 'btn', 'Save image');
  shareSave.type = 'button';
  shareSave.dataset.action = 'shareSave';
  const shareCopy = el('button', 'btn', 'Copy image');
  shareCopy.type = 'button';
  shareCopy.dataset.action = 'shareCopy';
  const shareChallenge = el('button', 'btn', 'Copy challenge link');
  shareChallenge.type = 'button';
  shareChallenge.dataset.action = 'shareChallenge';
  share.append(shareSave, shareCopy, shareChallenge);
  card.append(share);

  const actions = el('div', 'result-actions');
  const retry = el('button', 'btn', 'Try again');
  retry.type = 'button';
  retry.dataset.action = 'retryVerify';
  retry.hidden = true;
  const cont = el('button', 'btn btn-primary', 'Title screen');
  cont.type = 'button';
  cont.dataset.action = 'confirm';
  actions.append(retry, cont);
  card.append(actions);

  host.append(card);

  let last = '';
  let sealed = false;
  applyVerification = (v) => {
    const key = `${v.state}|${v.message}|${v.rank}|${v.txUrl}|${v.heroEarned}|${v.canRetry}`;
    if (key === last) return;
    last = key;

    ribbon.classList.toggle('is-pending', v.state === 'pending' || v.state === 'waiting');
    ribbon.classList.toggle('is-failed', v.state === 'failed');
    ribbon.classList.toggle('is-practice', v.state === 'practice');
    retry.hidden = !v.canRetry;

    if (v.state === 'pending' || v.state === 'waiting') {
      story.textContent = STORY[v.state];
    } else if (v.state === 'verified') {
      story.textContent = summary.won ? 'Sealed on Stellar' : 'Recorded on Stellar';
      if (!sealed) {
        sealed = true;
        ribbon.classList.add('is-sealed');
      }
      if (summary.won) share.hidden = false;
    } else {
      story.textContent = v.message;
    }

    if (v.rank !== null) {
      rank.hidden = false;
      rank.textContent = `Rank #${v.rank}`;
    }
    if (v.txUrl) {
      tx.hidden = false;
      tx.href = v.txUrl;
    }
    if (v.heroEarned) {
      hero.hidden = false;
      hero.classList.add('is-revealed');
    }
  };
}
