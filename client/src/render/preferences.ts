/** Player preferences read from the browser, in one place so every scene agrees. */

// One live query for the page. `matches` follows the setting without another lookup,
// which matters because the render loop asks every frame.
const reducedMotionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export function prefersReducedMotion(): boolean {
  return reducedMotionQuery?.matches ?? false;
}
