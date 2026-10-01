export type Action =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'confirm'
  | 'cancel'
  | 'leaderboard'
  | 'pickLantern'
  | 'pickCinder';

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
};

const ACTIONS: readonly Action[] = [
  'up',
  'down',
  'left',
  'right',
  'confirm',
  'cancel',
  'leaderboard',
  'pickLantern',
  'pickCinder',
];

function isAction(value: string | undefined): value is Action {
  return ACTIONS.some((action) => action === value);
}

let emit: ((action: Action) => void) | null = null;

export function emitAction(action: Action): void {
  emit?.(action);
}

export function onAction(handler: (action: Action) => void): void {
  emit = handler;
  window.addEventListener('keydown', (event) => {
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
