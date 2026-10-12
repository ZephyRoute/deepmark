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
import { DELVER_EARNED_KICKER, delverGrewKicker } from '../game/delverOutcome';
import { emblemIcon } from './emblems';
import { prefersReducedMotion } from './preferences';
import { sigilIcon } from './sigil';

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
  /** A fresh delver was minted by this run (its first full clear). */
  heroEarned: boolean;
  /** A veteran cleared again: no new delver, but its clear count rose. Null clears means the count is not known yet. */
  delverGrew?: { clears: number | null } | null;
  canRetry: boolean;
  /** A fresh account's first verified win: gently point at Your record so the delver is never lost. */
  recordNudge?: boolean;
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

function countUp(node: HTMLElement, to: number, suffix = '', delay = 0): void {
  if (prefersReducedMotion() || to <= 0) {
    node.textContent = `${to}${suffix}`;
    return;
  }
  node.textContent = `0${suffix}`;
  const duration = 700;
  window.setTimeout(() => {
    const start = performance.now();
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
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

const STRIKE_KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: 'scale(1.9) rotate(-14deg) translateY(-6px)' },
  { opacity: 1, transform: 'scale(0.92) rotate(-4deg) translateY(0)', offset: 0.55 },
  { opacity: 1, transform: 'scale(1) rotate(-4deg) translateY(0)' },
];

const DUST_KEYFRAMES: Keyframe[] = [
  { opacity: 0.6, transform: 'scale(0.6)' },
  { opacity: 0, transform: 'scale(1.9)' },
];

const NUDGE_KEYFRAMES: Keyframe[] = [
  { transform: 'translate(0, 0)' },
  { transform: 'translate(1px, -1px)' },
  { transform: 'translate(-1px, 1px)' },
  { transform: 'translate(0, 0)' },
];

/** Strikes the seal: sound and the three motions all start on this one call. */
function strikeSeal(card: HTMLElement, seal: HTMLElement, dust: HTMLElement, onSeal?: () => void): void {
  onSeal?.();
  if (prefersReducedMotion()) {
    seal.style.opacity = '1';
    seal.style.transform = 'rotate(-4deg)';
    dust.style.opacity = '0';
    return;
  }
  seal.animate(STRIKE_KEYFRAMES, { duration: 620, easing: 'cubic-bezier(0.2, 1.3, 0.3, 1)', fill: 'forwards' });
  dust.animate(DUST_KEYFRAMES, { duration: 520, easing: 'ease-out', fill: 'forwards' });
  card.animate(NUDGE_KEYFRAMES, { duration: 120, easing: 'ease-out' });
}

let applyVerification: ((v: Verification) => void) | null = null;

/** Updates the mounted ceremony, if there is one. Cheap to call every frame. */
export function updateVerification(v: Verification): void {
  applyVerification?.(v);
}

export function mountResult(host: HTMLElement, summary: ResultSummary, onSeal?: () => void): void {
  host.replaceChildren();
  const card = el('div', summary.won ? 'panel result result-win' : 'panel result result-loss');

  const title = el('h2', 'result-title', summary.won ? 'Extracted' : 'Lost in the dark');
  card.append(el('p', 'result-eyebrow', summary.won ? 'The depths let you go' : 'The depths keep what you carried'), title);

  const stats = el('div', 'result-stats');
  stats.append(
    stat('Floor', summary.floorReached, ` / ${summary.maxFloor}`, 120),
    stat('Relics', summary.relics, '', 220),
    stat('Score', summary.score, '', 320),
    stat('HP left', summary.hpLeft, '', 420)
  );
  card.append(stats);
  if (summary.newBest) card.append(el('p', 'new-best', 'New best'));
  if (summary.bestLine) card.append(el('p', 'stats', summary.bestLine));

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
  const dust = el('span', 'seal-dust');
  const seal = el('div', 'seal');
  seal.append(sigilIcon());
  sealWrap.append(dust, seal);
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
  const kicker = el('p', 'hero-kicker', DELVER_EARNED_KICKER);
  heroCopy.append(kicker, el('p', 'hero-earned-name', summary.delver.name));
  const vault = el('button', 'btn btn-primary', 'Open the vault');
  vault.type = 'button';
  vault.dataset.action = 'vault';
  heroCopy.append(vault);
  hero.append(medallion, heroCopy);
  card.append(hero);

  const nudge = el('p', 'record-nudge', 'Your delver lives in this browser, so keep your record safe. ');
  nudge.hidden = true;
  const nudgeLink = el('button', 'quiet-link', 'Open Your record');
  nudgeLink.type = 'button';
  nudgeLink.dataset.action = 'stats';
  nudge.append(nudgeLink);
  card.append(nudge);

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

  const actions = el('div', 'result-actions sticky-actions');
  const retry = el('button', 'btn', 'Try again');
  retry.type = 'button';
  retry.dataset.action = 'retryVerify';
  retry.hidden = true;
  const again = el('button', 'btn', 'Descend again');
  again.type = 'button';
  again.dataset.action = 'again';
  const cont = el('button', 'btn btn-primary', 'Title screen');
  cont.type = 'button';
  cont.dataset.action = 'confirm';
  actions.append(retry, again, cont);
  card.append(actions);

  host.append(card);
  // Focus lands on the outcome, so a screen reader reads it and Tab reaches the buttons below.
  title.tabIndex = -1;
  title.focus({ preventScroll: true });

  let last = '';
  let sealed = false;
  applyVerification = (v) => {
    const key = `${v.state}|${v.message}|${v.rank}|${v.txUrl}|${v.heroEarned}|${v.delverGrew?.clears ?? 'x'}|${v.delverGrew ? 1 : 0}|${v.canRetry}|${v.recordNudge ? 1 : 0}`;
    if (key === last) return;
    last = key;

    ribbon.classList.toggle('is-pending', v.state === 'pending' || v.state === 'waiting');
    ribbon.classList.toggle('is-failed', v.state === 'failed');
    ribbon.classList.toggle('is-practice', v.state === 'practice');
    retry.hidden = !v.canRetry;
    nudge.hidden = !v.recordNudge;

    if (v.state === 'pending' || v.state === 'waiting') {
      story.textContent = STORY[v.state];
    } else if (v.state === 'verified') {
      story.textContent = summary.won ? 'Sealed on Stellar' : 'Recorded on Stellar';
      if (!sealed) {
        sealed = true;
        ribbon.classList.add('is-sealed');
        strikeSeal(card, seal, dust, onSeal);
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
    if (v.heroEarned || v.delverGrew) {
      kicker.textContent = v.delverGrew ? delverGrewKicker(v.delverGrew.clears) : DELVER_EARNED_KICKER;
      hero.hidden = false;
      hero.classList.add('is-revealed');
    }
  };
}
