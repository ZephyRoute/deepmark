/** Small DOM builders shared by the chrome's cards. */

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(label: string, action: string, className = 'btn'): HTMLButtonElement {
  const node = el('button', className, label);
  node.type = 'button';
  node.dataset.action = action;
  return node;
}

export function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function setText(id: string, value: string): void {
  const node = document.getElementById(id);
  if (node && node.textContent !== value) node.textContent = value;
}

/** Sets text and, if it changed, replays a small pop so gains are felt. */
export function setBumpText(id: string, value: string): void {
  const node = document.getElementById(id);
  if (!node || node.textContent === value) return;
  const first = node.textContent === '';
  node.textContent = value;
  if (first) return;
  node.classList.remove('bump');
  void node.offsetWidth;
  node.classList.add('bump');
}

/** True when the main pointer is a finger. Focusing a field there raises the keyboard and pulls the page, so nothing is auto focused. */
export function isTouchFirst(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}
