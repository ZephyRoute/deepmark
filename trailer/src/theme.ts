export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Tokens copied from the game's stylesheet so the film and the product read as one thing. */
export const COLOR = {
  bg: '#07080e',
  text: '#f4efe6',
  muted: '#a3988c',
  cyan: '#7ef0e0',
  cyanDeep: '#143f3c',
  gold: '#e7c36a',
  danger: '#ff6b5a',
} as const;

/** Seconds to frames, rounded so scene boundaries always land on a whole frame. */
export const sec = (seconds: number): number => Math.round(seconds * FPS);
