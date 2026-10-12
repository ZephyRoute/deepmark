import { Easing, interpolate } from 'remotion';

/** The one easing curve the whole film uses: fast start, long settle. */
export const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);
export const SMOOTH = Easing.bezier(0.45, 0, 0.25, 1);

export function ramp(frame: number, from: number, to: number, easing: (t: number) => number = SETTLE): number {
  return interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });
}

/** Opacity for a scene that fades in and out over `edge` frames at each end. */
export function sceneFade(frame: number, duration: number, inFrames: number, outFrames: number): number {
  const up = inFrames > 0 ? ramp(frame, 0, inFrames, SMOOTH) : 1;
  const down = outFrames > 0 ? 1 - ramp(frame, duration - outFrames, duration, SMOOTH) : 1;
  return Math.min(up, down);
}
