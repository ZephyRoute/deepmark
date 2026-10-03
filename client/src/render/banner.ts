/** Floor and boss titles that rise over the board for a moment, then fade. */
export type BannerTone = 'floor' | 'boss';

let node: HTMLElement | null = null;

export function showBanner(title: string, subtitle: string, tone: BannerTone = 'floor'): void {
  const stage = document.querySelector('.stage');
  if (!stage) return;
  node?.remove();
  const banner = document.createElement('div');
  banner.className = `banner banner-${tone}`;
  banner.setAttribute('aria-hidden', 'true');
  const line = document.createElement('span');
  line.className = 'banner-line';
  const heading = document.createElement('p');
  heading.className = 'banner-title';
  heading.textContent = title;
  const sub = document.createElement('p');
  sub.className = 'banner-sub';
  sub.textContent = subtitle;
  banner.append(line, heading, sub);
  stage.append(banner);
  node = banner;
  window.setTimeout(() => {
    if (node === banner) {
      banner.remove();
      node = null;
    }
  }, 2800);
}

export function clearBanner(): void {
  node?.remove();
  node = null;
}
