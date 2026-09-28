export type Action = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel';

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
};

export function onAction(handler: (action: Action) => void): void {
  window.addEventListener('keydown', (event) => {
    const action = KEY_MAP[event.code];
    if (!action) return;
    event.preventDefault();
    handler(action);
  });
}
