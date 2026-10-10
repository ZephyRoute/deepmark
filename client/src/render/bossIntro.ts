/**
 * A short, skippable cinematic for the Warden Prime boss floor: letterbox
 * bars slide in, the painted boss art pushes in slowly, a name plate rises
 * with its health bar filling in, then the bars and art leave faster than
 * they arrived. Plays once on entering floor 3, never on a retreat or a
 * reload mid fight, since the caller only invokes it from the `descended`
 * event for the boss floor.
 */
import { prefersReducedMotion } from './preferences';

const BOSS_ART = 'boss-intro.webp';
const DURATION_MS = 2400;
const SKIP_AFTER_MS = 800;
const EXIT_MS = 400;
const REDUCED_HOLD_MS = 1200;

/** Warms the image cache so the cinematic never waits on the network. Call when floor 2 clears. */
export function preloadBossArt(): void {
  const img = new Image();
  img.src = `/art/${BOSS_ART}`;
}

export interface BossIntroHandle {
  /** Ends the cinematic early. A no-op before the 800ms skip window opens. */
  skip: () => void;
}

export function playBossIntro(host: HTMLElement, name: string, onSting: () => void, onDone: () => void): BossIntroHandle {
  const scene = document.createElement('div');
  scene.className = 'boss-intro';

  const dim = document.createElement('div');
  dim.className = 'boss-dim';

  const portrait = document.createElement('img');
  portrait.className = 'boss-portrait';
  portrait.src = `/art/${BOSS_ART}`;
  portrait.alt = '';

  const barTop = document.createElement('div');
  barTop.className = 'boss-bar boss-bar-top';
  const barBottom = document.createElement('div');
  barBottom.className = 'boss-bar boss-bar-bottom';

  const plate = document.createElement('div');
  plate.className = 'boss-plate';
  const rule = document.createElement('span');
  rule.className = 'boss-plate-rule';
  const label = document.createElement('p');
  label.className = 'boss-plate-name';
  label.textContent = name;
  const hp = document.createElement('div');
  hp.className = 'boss-hp';
  const hpFill = document.createElement('span');
  hpFill.className = 'boss-hp-fill';
  hp.append(hpFill);
  plate.append(rule, label, hp);

  scene.append(dim, portrait, plate, barTop, barBottom);
  host.append(scene);

  let done = false;
  let skippable = false;
  const timers: number[] = [];
  const schedule = (fn: () => void, ms: number): void => {
    timers.push(window.setTimeout(fn, ms));
  };

  function finish(): void {
    if (done) return;
    done = true;
    timers.forEach((timer) => window.clearTimeout(timer));
    scene.remove();
    onDone();
  }

  function exit(): void {
    if (done) return;
    scene.classList.add('is-leaving');
    schedule(finish, EXIT_MS);
  }

  if (prefersReducedMotion()) {
    scene.classList.add('is-reduced');
    onSting();
    scene.classList.add('is-revealed');
    schedule(exit, REDUCED_HOLD_MS);
    return { skip: exit };
  }

  requestAnimationFrame(() => scene.classList.add('is-entering'));
  schedule(() => {
    onSting();
    scene.classList.add('is-revealed');
  }, 240);
  schedule(() => {
    skippable = true;
  }, SKIP_AFTER_MS);
  schedule(exit, DURATION_MS);

  return {
    skip: () => {
      if (skippable) exit();
    },
  };
}
