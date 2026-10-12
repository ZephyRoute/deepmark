import { now as clockNow } from './clock';

export type Clip = 'idle' | 'walk' | 'attack';

interface Track {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  start: number;
  duration: number;
  clip: Clip;
}

const tracks = new Map<string, Track>();

function ease(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function resetMotion(): void {
  tracks.clear();
}

export function playAttack(id: string, x: number, y: number): void {
  const now = clockNow();
  const prev = tracks.get(id);
  const px = prev?.toX ?? x;
  const py = prev?.toY ?? y;
  tracks.set(id, {
    fromX: px,
    fromY: py,
    toX: px,
    toY: py,
    start: now,
    duration: 380,
    clip: 'attack',
  });
}

export function sampleActor(
  id: string,
  x: number,
  y: number
): {
  x: number;
  y: number;
  clip: Clip;
  phase: number;
} {
  const now = clockNow();
  let track = tracks.get(id);
  if (!track) {
    track = { fromX: x, fromY: y, toX: x, toY: y, start: now, duration: 1, clip: 'idle' };
    tracks.set(id, track);
  } else if (track.toX !== x || track.toY !== y) {
    const t = Math.min(1, (now - track.start) / track.duration);
    const along = ease(t);
    track = {
      fromX: track.fromX + (track.toX - track.fromX) * along,
      fromY: track.fromY + (track.toY - track.fromY) * along,
      toX: x,
      toY: y,
      start: now,
      duration: 320,
      clip: 'walk',
    };
    tracks.set(id, track);
  }

  const phase = Math.min(1, (now - track.start) / track.duration);
  const along = ease(phase);
  return {
    x: track.fromX + (track.toX - track.fromX) * along,
    y: track.fromY + (track.toY - track.fromY) * along,
    clip: phase >= 1 ? 'idle' : track.clip,
    phase,
  };
}
