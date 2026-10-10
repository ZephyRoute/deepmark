/**
 * The descent shown while a run is being opened on Stellar. It uses the
 * painted shaft from the title art, a slow camera push, a little dust and
 * ember, film grain and a flickering lantern light. A thin three step line
 * follows the real steps, and when the stairs open the camera dives into the
 * dark. Restraint is the point: nothing here tries to look like a loading bar.
 */
import { emblemIcon } from './emblems';
import { prefersReducedMotion } from './preferences';

export interface DescentOptions {
  /** Portrait file under /art, for the medallion. */
  art: string;
  /** CSS filter for the cloak colour. */
  filter: string;
  name: string;
  emblem: number;
  /** One line describing the kit, such as "Cinder  ·  Reaver Hook  ·  Stone Heart". */
  kit: string;
}

export type DescentStage = 'account' | 'opening' | 'ready' | 'offline';

const STEPS: readonly string[] = ['Lantern lit', 'Run opened', 'Stairs open'];

const STAGE_TEXT: Record<DescentStage, string> = {
  account: 'Lighting the lantern',
  opening: 'Opening your run on Stellar',
  ready: 'The stairs are open',
  offline: 'Stellar is quiet. A practice descent',
};

const TIPS: readonly string[] = [
  'Every item is a trade. There is no single best kit.',
  'Fight only what blocks the stairs, or take the relic and risk it.',
  'Hit points do not come back between floors.',
  'Retreating is free, but a guardian keeps its wounds.',
  'Clear all three floors and this delver is yours for good.',
  'The contract replays your run. Nobody can fake a clear.',
];

const TIP_MS = 3600;
const EMBER_COUNT = 34;

let setStageRef: ((stage: DescentStage) => void) | null = null;

/** Moves the mounted scene to a new real step, if one is on screen. */
export function setDescentStage(stage: DescentStage): void {
  setStageRef?.(stage);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A small tiling noise texture, generated once, for film grain. */
function grainUrl(): string {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) return '';
  const image = g.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.random() * 255;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  g.putImageData(image, 0, 0);
  return c.toDataURL('image/png');
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  warm: boolean;
  life: number;
}

export function mountDescent(host: HTMLElement, options: DescentOptions): void {
  host.replaceChildren();
  const calm = prefersReducedMotion();

  const root = el('div', 'descent');
  const art = el('div', 'descent-art');
  const light = el('div', 'descent-light');
  const dust = document.createElement('canvas');
  dust.className = 'descent-dust';
  dust.setAttribute('aria-hidden', 'true');
  const grain = el('div', 'descent-grain');
  grain.style.backgroundImage = `url(${grainUrl()})`;
  const shade = el('div', 'descent-shade');

  // Dossier: the delver that was just forged.
  const dossier = el('div', 'descent-dossier');
  const medallion = el('div', 'descent-medallion');
  const portrait = el('img', 'descent-portrait');
  portrait.src = `/art/${options.art}`;
  portrait.alt = '';
  portrait.style.filter = options.filter;
  const crest = el('span', 'descent-crest');
  crest.append(emblemIcon(options.emblem, 'emblem emblem-small'));
  medallion.append(portrait, crest);
  const who = el('div', 'descent-who');
  who.append(el('p', 'descent-name', options.name), el('p', 'descent-kit', options.kit));
  dossier.append(medallion, who);

  // Progress: three honest steps and one line of text.
  const progress = el('div', 'descent-progress');
  const steps = el('ol', 'descent-steps');
  const stepNodes = STEPS.map((label) => {
    const li = el('li', 'descent-step');
    li.append(el('span', 'descent-step-dot'), el('span', 'descent-step-label', label));
    steps.append(li);
    return li;
  });
  const status = el('p', 'descent-status', STAGE_TEXT.account);
  status.setAttribute('role', 'status');
  const tip = el('p', 'descent-tip');
  progress.append(steps, status, tip);

  root.append(art, light, dust, grain, shade, dossier, progress);
  host.append(root);

  let tipIndex = Math.floor(Math.random() * TIPS.length);
  function showTip(): void {
    tip.textContent = TIPS[tipIndex % TIPS.length] ?? '';
    tip.classList.remove('is-in');
    void tip.offsetWidth;
    tip.classList.add('is-in');
  }
  showTip();
  const tipTimer = window.setInterval(() => {
    tipIndex += 1;
    showTip();
  }, TIP_MS);

  function paintSteps(active: number, allDone: boolean): void {
    stepNodes.forEach((node, i) => {
      node.classList.toggle('is-done', allDone || i < active);
      node.classList.toggle('is-active', !allDone && i === active);
    });
  }
  paintSteps(0, false);

  setStageRef = (stage) => {
    status.textContent = STAGE_TEXT[stage];
    if (stage === 'account') paintSteps(0, false);
    if (stage === 'opening') paintSteps(1, false);
    if (stage === 'ready' || stage === 'offline') {
      paintSteps(2, true);
      root.classList.add('is-diving');
    }
  };

  // Dust and embers, drawn small and soft on a single canvas.
  const ctx = dust.getContext('2d');
  let running = true;
  if (ctx && !calm) {
    const ink: CanvasRenderingContext2D = ctx;
    const embers: Ember[] = [];
    const spawn = (initial: boolean): Ember => ({
      x: Math.random(),
      y: initial ? Math.random() : 1.05,
      vx: (Math.random() - 0.5) * 0.012,
      vy: -(0.02 + Math.random() * 0.05),
      size: 0.8 + Math.random() * 2.2,
      warm: Math.random() < 0.35,
      life: Math.random() * Math.PI * 2,
    });
    for (let i = 0; i < EMBER_COUNT; i += 1) embers.push(spawn(true));
    let last = performance.now();
    const tick = (now: number): void => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = dust.clientWidth || 800;
      const h = dust.clientHeight || 500;
      if (dust.width !== w || dust.height !== h) {
        dust.width = w;
        dust.height = h;
      }
      ink.clearRect(0, 0, w, h);
      for (let i = 0; i < embers.length; i += 1) {
        const e = embers[i] as Ember;
        e.life += dt;
        e.x += (e.vx + Math.sin(e.life * 0.8) * 0.004) * dt * 6;
        e.y += e.vy * dt;
        if (e.y < -0.05) embers[i] = spawn(false);
        const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(e.life * 1.3));
        const px = e.x * w;
        const py = e.y * h;
        const radius = e.size * 2.4;
        const g = ink.createRadialGradient(px, py, 0, px, py, radius);
        const rgb = e.warm ? '255, 196, 120' : '150, 240, 230';
        g.addColorStop(0, `rgba(${rgb}, ${0.55 * twinkle})`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        ink.fillStyle = g;
        ink.beginPath();
        ink.arc(px, py, radius, 0, Math.PI * 2);
        ink.fill();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Stop timers and drawing once the scene is replaced.
  const observer = new MutationObserver(() => {
    if (!root.isConnected) {
      running = false;
      window.clearInterval(tipTimer);
      if (setStageRef) setStageRef = null;
      observer.disconnect();
    }
  });
  observer.observe(host, { childList: true });
}
