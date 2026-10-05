export type Action =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'confirm'
  | 'cancel'
  | 'leaderboard'
  | 'stats'
  | 'vault'
  | 'mute'
  | 'retryVerify'
  | 'tabFresh'
  | 'tabVeteran'
  | 'pickLantern'
  | 'pickCinder'
  | 'replayHints'
  | 'shareSave'
  | 'shareCopy'
  | 'shareChallenge';

const KEY_MAP: Record<string, Action> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Enter: 'confirm',
  Space: 'confirm',
  Escape: 'cancel',
  KeyL: 'leaderboard',
  KeyM: 'stats',
  KeyV: 'vault',
  KeyN: 'mute',
};

const ACTIONS: readonly Action[] = [
  'up',
  'down',
  'left',
  'right',
  'confirm',
  'cancel',
  'leaderboard',
  'stats',
  'vault',
  'mute',
  'retryVerify',
  'tabFresh',
  'tabVeteran',
  'pickLantern',
  'pickCinder',
  'replayHints',
  'shareSave',
  'shareCopy',
  'shareChallenge',
];

function isAction(value: string | undefined): value is Action {
  return ACTIONS.some((action) => action === value);
}

let emit: ((action: Action) => void) | null = null;

export function emitAction(action: Action): void {
  emit?.(action);
}

/** Fields and anything inside a form (the creator) keep their own keys. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
  return target instanceof Element && target.closest('form') !== null;
}

export function onAction(handler: (action: Action) => void): void {
  emit = handler;
  window.addEventListener('keydown', (event) => {
    // Typing in a field (the delver's name) must never be read as a game key.
    if (isTypingTarget(event.target)) return;
    const action = KEY_MAP[event.code];
    if (!action) return;
    event.preventDefault();
    emitAction(action);
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest('[data-action]');
    if (!(control instanceof HTMLElement)) return;
    const action = control.dataset.action;
    if (!isAction(action)) return;
    emitAction(action);
  });
}
