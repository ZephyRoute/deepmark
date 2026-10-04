/**
 * Drifting embers and dust on a canvas, shared by the title and the descent.
 * Small, slow and few: the point is air, not spectacle. Draws with plain
 * circles and one soft gradient each, and stops itself when asked.
 */
export interface EmberOptions {
  count: number;
  /** Share of embers that are warm gold, the rest are cold cyan dust. */
  warm: number;
  /** Where new embers appear, in canvas pixels. Defaults to the bottom edge. */
  origin?: () => { x: number; y: number; spread: number };
  /** Upward speed in canvas heights per second. */
  rise?: number;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  warm: boolean;
  phase: number;
}

export function startEmbers(canvas: HTMLCanvasElement, options: EmberOptions): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;
  const ink: CanvasRenderingContext2D = ctx;
  const rise = options.rise ?? 0.05;
  let running = true;
  let width = 0;
  let height = 0;

  const resize = (): void => {
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 500;
    if (w !== width || h !== height) {
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = h;
    }
  };

  const spawn = (initial: boolean): Ember => {
    const origin = options.origin?.();
    const spread = origin?.spread ?? width;
    const x = origin ? origin.x + (Math.random() - 0.5) * spread : Math.random() * width;
    const y = initial ? Math.random() * height : origin ? origin.y + Math.random() * 12 : height + 6;
    return {
      x,
      y,
      vx: (Math.random() - 0.5) * 0.01,
      vy: -(0.4 + Math.random() * 0.9) * rise,
      size: 0.7 + Math.random() * 1.7,
      warm: Math.random() < options.warm,
      phase: Math.random() * Math.PI * 2,
    };
  };

  resize();
  const embers: Ember[] = Array.from({ length: options.count }, () => spawn(true));
  let last = performance.now();

  const tick = (now: number): void => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    resize();
    ink.clearRect(0, 0, width, height);
    for (let i = 0; i < embers.length; i += 1) {
      const e = embers[i] as Ember;
      e.phase += dt;
      e.x += (e.vx * width + Math.sin(e.phase * 0.9) * 0.012 * width) * dt;
      e.y += e.vy * height * dt;
      if (e.y < -8) embers[i] = spawn(false);
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(e.phase * 1.4));
      const radius = e.size * 2.6;
      const g = ink.createRadialGradient(e.x, e.y, 0, e.x, e.y, radius);
      const rgb = e.warm ? '255, 190, 110' : '170, 235, 228';
      g.addColorStop(0, `rgba(${rgb}, ${0.5 * twinkle})`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      ink.fillStyle = g;
      ink.beginPath();
      ink.arc(e.x, e.y, radius, 0, Math.PI * 2);
      ink.fill();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return () => {
    running = false;
  };
}
