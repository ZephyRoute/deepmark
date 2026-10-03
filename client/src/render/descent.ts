/**
 * The descent scene shown while a run is being opened on Stellar. A real time
 * canvas, not a video: stone rings rush toward the viewer, the delver who was
 * just forged falls with a lantern, and the text follows the real steps so the
 * wait is honest and never looks frozen.
 */
export interface DescentOptions {
  /** Portrait file under /art, for the falling delver. */
  art: string;
  /** CSS filter for the cloak colour. */
  filter: string;
  name: string;
}

export type DescentStage = 'account' | 'opening' | 'ready' | 'offline';

const STAGE_TEXT: Record<DescentStage, string> = {
  account: 'Lighting the lantern...',
  opening: 'Opening your run on Stellar...',
  ready: 'The stairs are open.',
  offline: 'Stellar is quiet. A practice descent.',
};

const TIPS: readonly string[] = [
  'Every item is a trade. There is no single best kit.',
  'Fight only what blocks the stairs, or take the relic and risk it.',
  'Hit points do not come back between floors.',
  'Retreating is free, but a guardian keeps its wounds.',
  'Clear all three floors and this delver is yours for good.',
  'The contract replays your run. Nobody can fake a clear.',
];

const WIDTH = 832;
const HEIGHT = 576;
const RING_COUNT = 18;
const TIP_MS = 3400;
const BASE_SPEED = 0.32;
const RUSH_SPEED = 1.8;

let setStageRef: ((stage: DescentStage) => void) | null = null;

/** Updates the text and the pace of the scene that is currently mounted, if any. */
export function setDescentStage(stage: DescentStage): void {
  setStageRef?.(stage);
}

function seeded(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Mote {
  x: number;
  y: number;
  speed: number;
  size: number;
}

export function mountDescent(host: HTMLElement, options: DescentOptions): void {
  host.replaceChildren();
  const root = document.createElement('div');
  root.className = 'descent';

  const canvas = document.createElement('canvas');
  canvas.className = 'descent-canvas';
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.setAttribute('aria-hidden', 'true');

  const copy = document.createElement('div');
  copy.className = 'descent-copy';
  const title = document.createElement('p');
  title.className = 'descent-title';
  title.textContent = options.name;
  const stage = document.createElement('p');
  stage.className = 'descent-stage';
  stage.setAttribute('role', 'status');
  stage.textContent = STAGE_TEXT.account;
  const tip = document.createElement('p');
  tip.className = 'descent-tip';
  copy.append(title, stage, tip);
  root.append(canvas, copy);
  host.append(root);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const draw: CanvasRenderingContext2D = ctx;

  const sprite = new Image();
  sprite.src = `/art/${options.art}`;

  const calm = reducedMotion();
  const motes: Mote[] = Array.from({ length: 46 }, (_, i) => ({
    x: seeded(i + 1) * WIDTH,
    y: seeded(i + 90) * HEIGHT,
    speed: 40 + seeded(i + 7) * 120,
    size: 0.6 + seeded(i + 31) * 1.8,
  }));

  let speed = BASE_SPEED;
  let targetSpeed = BASE_SPEED;
  let flash = 0;
  let depth = 0;
  let tipIndex = Math.floor(Math.random() * TIPS.length);
  let lastTip = performance.now();
  let last = performance.now();
  let running = true;

  function showTip(): void {
    tip.textContent = TIPS[tipIndex % TIPS.length] ?? '';
    tip.classList.remove('is-in');
    // Restart the CSS transition so the new line fades in.
    void tip.offsetWidth;
    tip.classList.add('is-in');
  }
  showTip();

  setStageRef = (next) => {
    stage.textContent = STAGE_TEXT[next];
    if (next === 'ready') {
      targetSpeed = RUSH_SPEED;
      flash = 1;
    }
  };

  function ring(index: number, z: number, t: number): void {
    const scale = Math.pow(z, 2.3);
    const radius = 24 + scale * WIDTH * 1.25;
    const sway = Math.sin(t * 0.55) * 10 * (1 - z);
    const cx = WIDTH / 2 + sway;
    const cy = HEIGHT * 0.46 + Math.cos(t * 0.4) * 6 * (1 - z);
    const fade = Math.min(1, z * 5) * (z > 0.9 ? Math.max(0, (1 - z) * 10) : 1);
    if (fade <= 0.01) return;

    // The lantern is the only light, so stone is brightest where it hangs and falls off both far and near.
    const light = 0.16 + 0.84 * Math.exp(-((z - 0.42) ** 2) / 0.07);
    const thickness = 3 + scale * 46;
    const inner = Math.max(1, radius - thickness / 2);
    const outer = radius + thickness / 2;
    const blocks = 26;
    const offset = seeded(index * 1.9) * Math.PI;

    for (let b = 0; b < blocks; b += 1) {
      const a0 = offset + (b / blocks) * Math.PI * 2;
      const a1 = offset + ((b + 0.93) / blocks) * Math.PI * 2;
      const tone = 0.62 + 0.55 * seeded(index * 13.1 + b * 3.3);
      const level = light * tone;
      draw.fillStyle = `rgba(${34 + level * 78}, ${44 + level * 96}, ${62 + level * 118}, ${fade})`;
      draw.beginPath();
      draw.moveTo(cx + Math.cos(a0) * inner, cy + Math.sin(a0) * inner * 0.78);
      draw.lineTo(cx + Math.cos(a0) * outer, cy + Math.sin(a0) * outer * 0.78);
      draw.lineTo(cx + Math.cos(a1) * outer, cy + Math.sin(a1) * outer * 0.78);
      draw.lineTo(cx + Math.cos(a1) * inner, cy + Math.sin(a1) * inner * 0.78);
      draw.closePath();
      draw.fill();
    }

    // Cyan light that seeps out of some of the stone.
    if (seeded(index * 3.7) > 0.4) {
      const pulse = 0.55 + 0.45 * Math.sin(t * 1.6 + index);
      const start = seeded(index * 5.1) * Math.PI * 2;
      draw.lineWidth = Math.max(1.5, scale * 7);
      draw.strokeStyle = `rgba(126, 240, 224, ${fade * 0.95 * pulse})`;
      draw.shadowColor = 'rgba(126, 240, 224, 0.8)';
      draw.shadowBlur = 18 * scale + 4;
      draw.beginPath();
      draw.ellipse(cx, cy, inner, inner * 0.78, 0, start, start + 0.7 + seeded(index) * 0.8);
      draw.stroke();
      draw.shadowBlur = 0;
    }
  }

  function frame(now: number): void {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    speed += (targetSpeed - speed) * Math.min(1, dt * 3);
    if (!calm) depth += dt * speed;
    flash = Math.max(0, flash - dt * 1.4);

    if (now - lastTip > TIP_MS) {
      lastTip = now;
      tipIndex += 1;
      showTip();
    }

    draw.fillStyle = '#05060b';
    draw.fillRect(0, 0, WIDTH, HEIGHT);

    // The distant void with a faint cold glow where the shaft ends.
    const void_ = draw.createRadialGradient(WIDTH / 2, HEIGHT * 0.46, 4, WIDTH / 2, HEIGHT * 0.46, WIDTH * 0.42);
    void_.addColorStop(0, 'rgba(126, 240, 224, 0.38)');
    void_.addColorStop(0.35, 'rgba(24, 60, 70, 0.5)');
    void_.addColorStop(1, 'rgba(5, 6, 11, 0)');
    draw.fillStyle = void_;
    draw.fillRect(0, 0, WIDTH, HEIGHT);

    const phase = depth % 1;
    for (let i = 0; i < RING_COUNT; i += 1) {
      const z = (i + phase) / RING_COUNT;
      ring(i + Math.floor(depth), z, t);
    }

    // Dust rushing past.
    draw.fillStyle = 'rgba(200, 230, 240, 0.5)';
    for (const m of motes) {
      if (!calm) {
        m.y -= m.speed * dt * (0.5 + speed);
        if (m.y < -4) {
          m.y = HEIGHT + 4;
          m.x = Math.random() * WIDTH;
        }
      }
      draw.globalAlpha = 0.25 + (m.size / 2.4) * 0.45;
      draw.fillRect(m.x, m.y, m.size, m.size * (1 + speed * 1.6));
    }
    draw.globalAlpha = 1;

    // The delver, falling with a lantern.
    const bob = Math.sin(t * 1.4) * 8;
    const dx = WIDTH / 2 + Math.sin(t * 0.7) * 14;
    const dy = HEIGHT * 0.6 + bob;
    const flicker = 0.85 + Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.05;
    const glow = draw.createRadialGradient(dx, dy - 20, 4, dx, dy - 20, 190);
    glow.addColorStop(0, `rgba(255, 214, 140, ${0.75 * flicker})`);
    glow.addColorStop(0.4, `rgba(126, 240, 224, ${0.3 * flicker})`);
    glow.addColorStop(1, 'rgba(126, 240, 224, 0)');
    draw.fillStyle = glow;
    draw.fillRect(0, 0, WIDTH, HEIGHT);
    if (sprite.complete && sprite.naturalWidth > 0) {
      const size = 190;
      draw.save();
      draw.translate(dx, dy);
      draw.rotate(Math.sin(t * 0.9) * 0.05);
      draw.filter = options.filter;
      draw.drawImage(sprite, -size / 2, -size * 0.8, size, size);
      draw.filter = 'none';
      draw.restore();
    }

    // Soft vignette, and a flash as the stairs open.
    const vignette = draw.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.25, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.85);
    vignette.addColorStop(0, 'rgba(5, 6, 11, 0)');
    vignette.addColorStop(1, 'rgba(5, 6, 11, 0.7)');
    draw.fillStyle = vignette;
    draw.fillRect(0, 0, WIDTH, HEIGHT);
    if (flash > 0) {
      draw.fillStyle = `rgba(190, 255, 245, ${flash * 0.35})`;
      draw.fillRect(0, 0, WIDTH, HEIGHT);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  // Stop drawing once the scene is replaced.
  const observer = new MutationObserver(() => {
    if (!root.isConnected) {
      running = false;
      if (setStageRef) setStageRef = null;
      observer.disconnect();
    }
  });
  observer.observe(host, { childList: true });
}
