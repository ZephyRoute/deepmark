interface DamagePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  start: number;
}

interface Shake {
  start: number;
  duration: number;
  magnitude: number;
}

const POPUP_LIFETIME_MS = 700;

let popups: DamagePopup[] = [];
let shake: Shake | null = null;

export function spawnPopup(x: number, y: number, text: string, color: string): void {
  popups.push({ x, y, text, color, start: performance.now() });
}

export function triggerShake(duration = 150, magnitude = 6): void {
  shake = { start: performance.now(), duration, magnitude };
}

export function getShakeOffset(): [number, number] {
  if (!shake) return [0, 0];
  const elapsed = performance.now() - shake.start;
  if (elapsed > shake.duration) {
    shake = null;
    return [0, 0];
  }
  const decay = 1 - elapsed / shake.duration;
  const mag = shake.magnitude * decay;
  return [(Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag];
}

export function drawPopups(
  ctx: CanvasRenderingContext2D,
  toScreen: (x: number, y: number) => { cx: number; cy: number }
): void {
  const now = performance.now();
  popups = popups.filter((p) => now - p.start < POPUP_LIFETIME_MS);
  for (const popup of popups) {
    const t = (now - popup.start) / POPUP_LIFETIME_MS;
    const { cx, cy } = toScreen(popup.x, popup.y);
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = popup.color;
    ctx.font = 'bold 16px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(popup.text, cx, cy - 24 - t * 22);
  }
  ctx.globalAlpha = 1;
}
