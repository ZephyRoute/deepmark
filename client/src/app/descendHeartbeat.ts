import { sfxHeartbeat } from '../render/audio';
import { DESCEND_BEAT_DECAY, DESCEND_BEAT_MIN_MS, DESCEND_BEAT_START_MS } from '../constants';

/** Hovering Descend on the bank-or-push prompt: the heartbeat quickens the longer it holds. */
let hovering = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function scheduleBeat(delay: number): void {
  timer = setTimeout(() => {
    if (!hovering) return;
    sfxHeartbeat();
    scheduleBeat(Math.max(DESCEND_BEAT_MIN_MS, delay * DESCEND_BEAT_DECAY));
  }, delay);
}

export function isDescendHovering(): boolean {
  return hovering;
}

export function onDescendHover(next: boolean): void {
  if (next === hovering) return;
  hovering = next;
  if (next) {
    sfxHeartbeat();
    scheduleBeat(DESCEND_BEAT_START_MS);
  } else if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
