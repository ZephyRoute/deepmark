import { now as clockNow } from './clock';
import type { RelicKind } from '../game/floor';
import { prefersReducedMotion } from './preferences';

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
  popups.push({ x, y, text, color, start: clockNow() });
}

/** Screen shake is skipped when the player asks for reduced motion. */
export function triggerShake(duration = 150, magnitude = 6): void {
  if (prefersReducedMotion()) return;
  shake = { start: clockNow(), duration, magnitude };
}

export function getShakeOffset(): [number, number] {
  if (!shake) return [0, 0];
  const elapsed = clockNow() - shake.start;
  if (elapsed > shake.duration) {
    shake = null;
    return [0, 0];
  }
  const decay = 1 - elapsed / shake.duration;
  const mag = shake.magnitude * decay;
  // Deterministic in visual time, so the shake holds still during a hit stop.
  return [Math.sin(elapsed * 0.9 + 1.3) * mag, Math.cos(elapsed * 1.1) * mag];
}

export function drawPopups(
  ctx: CanvasRenderingContext2D,
  toScreen: (x: number, y: number) => { cx: number; cy: number }
): void {
  const now = clockNow();
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

// ---- impact feel: flashes, particles and a low health pulse ----

const FLASH_MS = 120;
const flashes = new Map<string, number>();

/** Briefly whitens an actor so a hit reads before the damage number does. */
export function flashActor(id: string): void {
  flashes.set(id, clockNow());
}

export function isFlashing(id: string): boolean {
  const started = flashes.get(id);
  if (started === undefined) return false;
  if (clockNow() - started > FLASH_MS) {
    flashes.delete(id);
    return false;
  }
  return true;
}

export type BurstKind = 'kill' | 'relic' | 'hit';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  start: number;
  ttl: number;
  color: string;
  gravity: number;
}

let particles: Particle[] = [];

const BURST_SPECS: Record<BurstKind, { count: number; speed: number; ttl: number; size: number; gravity: number; colors: string[] }> = {
  kill: { count: 18, speed: 2.6, ttl: 650, size: 3.2, gravity: 4.5, colors: ['#9b8cc4', '#6f6a8a', '#d6d0e8'] },
  relic: { count: 22, speed: 2.2, ttl: 900, size: 2.8, gravity: -1.2, colors: ['#e7c36a', '#fff1b8', '#ffd98a'] },
  hit: { count: 7, speed: 3.4, ttl: 280, size: 2.2, gravity: 2, colors: ['#ffffff', '#cfe9ff'] },
};

/** Sparks and shards that fly out of a cell. Coordinates are in grid cells. */
export function spawnBurst(x: number, y: number, kind: BurstKind): void {
  const spec = BURST_SPECS[kind];
  const now = clockNow();
  for (let i = 0; i < spec.count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = spec.speed * (0.35 + Math.random() * 0.65);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (kind === 'relic' ? 0.8 : 0.4),
      size: spec.size * (0.5 + Math.random()),
      start: now,
      ttl: spec.ttl * (0.7 + Math.random() * 0.6),
      color: spec.colors[Math.floor(Math.random() * spec.colors.length)] ?? '#ffffff',
      gravity: spec.gravity,
    });
  }
}

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  toScreen: (x: number, y: number) => { cx: number; cy: number }
): void {
  const now = clockNow();
  particles = particles.filter((p) => now - p.start < p.ttl);
  for (const p of particles) {
    const age = (now - p.start) / 1000;
    const life = (now - p.start) / p.ttl;
    const x = p.x + p.vx * age;
    const y = p.y + p.vy * age + 0.5 * p.gravity * age * age;
    const { cx, cy } = toScreen(x, y);
    ctx.globalAlpha = Math.max(0, 1 - life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(cx, cy, p.size * (1 - life * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * A red edge that beats when hit points are low. Strength follows how close the
 * player is to death, and the beat slows to a heartbeat rhythm.
 */
export function drawLowHealth(ctx: CanvasRenderingContext2D, ratio: number): void {
  if (ratio > 0.34 || ratio <= 0) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const urgency = 1 - ratio / 0.34;
  // A steady tint instead of a heartbeat when the player asks for reduced motion.
  const beat = prefersReducedMotion() ? 1 : Math.pow(Math.max(0, Math.sin(clockNow() / 1000 * (3.2 + urgency * 2))), 6);
  const alpha = (0.1 + urgency * 0.28) * (0.45 + 0.55 * beat);
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.32, w / 2, h / 2, h * 0.8);
  g.addColorStop(0, 'rgba(255, 60, 50, 0)');
  g.addColorStop(1, `rgba(255, 60, 50, ${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ---- relic travel: a single point flying from the pickup to the HUD counter ----

interface RelicTravel {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  kind: RelicKind;
  start: number;
}

const TRAVEL_MS = 380;
const TRAVEL_COLOR: Record<RelicKind, string> = { common: '#e7c36a', rare: '#9be8da', core: '#fff1b8' };

let travels: RelicTravel[] = [];
let arrived: RelicKind[] = [];

/** One point, from a relic's canvas position to wherever the HUD counter sits right now. */
export function spawnRelicTravel(x0: number, y0: number, x1: number, y1: number, kind: RelicKind): void {
  travels.push({ x0, y0, x1, y1, kind, start: clockNow() });
}

/** Draws every travelling point still in flight, one draw call each, and queues arrivals. */
export function drawRelicTravel(ctx: CanvasRenderingContext2D): void {
  const now = clockNow();
  travels = travels.filter((t) => {
    const p = (now - t.start) / TRAVEL_MS;
    if (p >= 1) {
      arrived.push(t.kind);
      return false;
    }
    const eased = 1 - Math.pow(1 - p, 3);
    const x = t.x0 + (t.x1 - t.x0) * eased;
    const lift = Math.sin(p * Math.PI) * -26;
    const y = t.y0 + (t.y1 - t.y0) * eased + lift;
    ctx.fillStyle = TRAVEL_COLOR[t.kind];
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    return true;
  });
}

/** The relic kinds whose travelling point landed since the last call. */
export function drainArrivedRelics(): RelicKind[] {
  const out = arrived;
  arrived = [];
  return out;
}

/**
 * Drops any travel still in flight when a run ends: `drawWorld` (and so
 * `drawRelicTravel`) stops being called once the result screen takes over, so a
 * pickup from the last instant of a run would otherwise freeze mid-air and then
 * "arrive" on the very first frame of the next run, phantom-crediting its counter.
 */
export function resetRelicTravel(): void {
  travels = [];
  arrived = [];
}
