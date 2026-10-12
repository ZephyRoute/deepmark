import { loadingBlock } from '../render/loader';
import { STELLAR_CONFIG } from '../stellar/config';
import { el } from './dom';
import { MAX_TRACKED_FLOOR, PLAYER_CAP, type DayCount, type PlayerMark, type RecordedRun, type TractionSummary } from './summary';

const WHEN = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const DAY = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
});

const LOADING_ROWS = 4;
const STELLAR_VIEW = 'https://stellarview.acachete.xyz/en/testnet';

function viewAccount(address: string): string {
  return `${STELLAR_VIEW}/account/${encodeURIComponent(address)}`;
}

function viewTx(hash: string): string {
  return `${STELLAR_VIEW}/tx/${encodeURIComponent(hash)}`;
}

function viewContract(): string {
  return `${STELLAR_VIEW}/contract/${encodeURIComponent(STELLAR_CONFIG.contractId)}`;
}

function externalLink(href: string, label: string): HTMLAnchorElement {
  const link = el('a', 'text-link', label);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function metric(value: string, label: string): HTMLElement {
  const node = el('div', 'metric');
  node.append(el('span', 'metric-value', value));
  node.append(el('span', 'metric-label', label));
  return node;
}

function copyButton(label: string, text: string): HTMLButtonElement {
  const button = el('button', 'btn', label);
  button.type = 'button';
  button.addEventListener('click', () => {
    void navigator.clipboard?.writeText(text).then(
      () => {
        button.textContent = 'Copied';
      },
      () => {
        button.textContent = 'Copy failed';
      }
    );
  });
  return button;
}

function floorBars(summary: TractionSummary): HTMLElement {
  const list = el('ol', 'bars');
  const max = Math.max(1, ...summary.floorCounts);
  for (let floor = 1; floor <= MAX_TRACKED_FLOOR; floor += 1) {
    const count = summary.floorCounts[floor] ?? 0;
    const item = el('li', 'bar-row');
    item.append(el('span', 'bar-label', `Floor ${floor}`));
    const track = el('span', 'bar-track');
    const fill = el('span', 'bar-fill');
    fill.style.width = `${Math.round((count / max) * 100)}%`;
    track.append(fill);
    item.append(track);
    item.append(el('span', 'bar-count', String(count)));
    list.append(item);
  }
  return list;
}

function dayBars(days: DayCount[]): HTMLElement {
  const list = el('ol', 'bars');
  const max = Math.max(1, ...days.map((day) => day.runs));
  for (const day of days) {
    const item = el('li', 'bar-row');
    const parsed = Date.parse(`${day.day}T00:00:00Z`);
    item.append(el('span', 'bar-label', Number.isFinite(parsed) ? DAY.format(parsed) : day.day));
    const track = el('span', 'bar-track');
    const fill = el('span', 'bar-fill');
    fill.style.width = `${Math.round((day.runs / max) * 100)}%`;
    track.append(fill);
    item.append(track);
    item.append(el('span', 'bar-count', String(day.runs)));
    list.append(item);
  }
  return list;
}

function playerCard(player: PlayerMark): HTMLElement {
  const card = el('article', 'player-card');
  const address = el('p', 'address', player.address);
  card.append(address);
  card.append(
    el(
      'p',
      'player-meta',
      `Best score ${player.bestScore}  ·  Best floor ${player.bestFloor} / ${MAX_TRACKED_FLOOR}  ·  Runs ${player.finishedRuns}`
    )
  );
  const actions = el('div', 'player-actions');
  actions.append(copyButton('Copy address', player.address));
  actions.append(externalLink(viewAccount(player.address), 'Stellar View'));
  card.append(actions);
  return card;
}

function runCard(run: RecordedRun): HTMLElement {
  const card = el('article', 'player-card');
  const parsed = Date.parse(run.at);
  const when = Number.isFinite(parsed) ? `${WHEN.format(parsed)} UTC` : run.at;
  const result = run.extracted ? `Extracted, score ${run.score}` : 'Lost';
  card.append(el('p', 'player-meta', `${when}  ·  Floor ${run.floorReached}  ·  ${result}`));
  card.append(el('p', 'address', run.address));
  card.append(externalLink(viewTx(run.txHash), 'Transaction'));
  return card;
}

export function renderLoading(root: HTMLElement): void {
  root.replaceChildren(shell(loadingBlock('Reading recorded runs from Stellar testnet', LOADING_ROWS)));
}

export function renderError(root: HTMLElement, onRetry: () => void): void {
  const body = el('div', 'notice');
  body.setAttribute('role', 'alert');
  body.append(el('h2', 'section-title', 'Could not read the record'));
  body.append(
    el(
      'p',
      'lede',
      'Stellar testnet could not be read from this browser. Your connection or the network may be having a moment. Nothing was lost.'
    )
  );
  const actions = el('div', 'player-actions');
  const retry = el('button', 'btn btn-primary', 'Try again');
  retry.type = 'button';
  retry.addEventListener('click', onRetry);
  actions.append(retry);
  body.append(actions);
  root.replaceChildren(shell(body));
  retry.focus();
}

export function renderSummary(root: HTMLElement, summary: TractionSummary): void {
  const body = el('div', 'stack');
  body.append(
    el(
      'p',
      'lede',
      'A player is a Stellar address with at least one finished run on the contract. Every run here was replayed by the contract before it counted. Opening the game without finishing a run is not counted.'
    )
  );

  const metrics = el('div', 'metric-grid');
  metrics.append(metric(String(summary.playerCount), 'Players'));
  metrics.append(metric(String(summary.recordedRuns), 'Recorded runs'));
  metrics.append(metric(String(summary.bestFloorThree), 'Best floor is 3'));
  metrics.append(metric(String(summary.bankedRelic), 'Banked a relic'));
  metrics.append(metric(String(summary.openedCount), 'Opened a run'));
  body.append(metrics);

  if (summary.listCapped) {
    body.append(el('p', 'note', `This page reads the first ${PLAYER_CAP} players. More exist on the contract.`));
  }

  const floors = el('section', 'block');
  floors.append(el('h2', 'section-title', 'Best floor'));
  floors.append(el('p', 'note', 'How many players have that floor as their stored best. It is not a count of every run.'));
  if (summary.playerCount === 0) {
    floors.append(el('p', 'lede', 'No finished run has been recorded yet.'));
  } else {
    floors.append(floorBars(summary));
  }
  body.append(floors);

  if (summary.days.length > 0 && (summary.recentRunCount > 0 || summary.recordedRuns > 0)) {
    const days = el('section', 'block');
    days.append(el('h2', 'section-title', 'Runs by day'));
    const covered = summary.eventsTruncated
      ? `Stellar's public history still has ${summary.recentRunCount} matching events in this window, and the list stopped early.`
      : summary.recentRunCount === summary.recordedRuns
        ? `All ${summary.recordedRuns} stored runs are still in Stellar's public history.`
        : `Stellar's public history still has ${summary.recentRunCount} recorded runs in this window. The all-time total above can be higher, because older events leave that history.`;
    days.append(el('p', 'note', covered));
    days.append(dayBars(summary.days));
    body.append(days);
  }

  const players = el('section', 'block');
  players.append(el('h2', 'section-title', 'Player addresses'));
  if (summary.playerCount === 0) {
    players.append(el('p', 'lede', 'No addresses yet.'));
  } else {
    const actions = el('div', 'player-actions');
    actions.append(copyButton('Copy all addresses', summary.players.map((player) => player.address).join('\n')));
    players.append(actions);
    const list = el('div', 'player-list');
    for (const player of summary.players) list.append(playerCard(player));
    players.append(list);
  }
  body.append(players);

  if (summary.recentRuns.length > 0) {
    const recent = el('section', 'block');
    recent.append(el('h2', 'section-title', 'Latest recorded runs'));
    if (summary.recentRunCount > summary.recentRuns.length) {
      recent.append(
        el('p', 'note', `Showing the latest ${summary.recentRuns.length} of ${summary.recentRunCount} still in Stellar's public history.`)
      );
    }
    const list = el('div', 'player-list');
    for (const run of summary.recentRuns) list.append(runCard(run));
    recent.append(list);
    body.append(recent);
  }

  const fine = el('p', 'note');
  fine.append('Stored by ');
  fine.append(externalLink(viewContract(), STELLAR_CONFIG.contractId));
  fine.append(
    '. The contract replays each run from its action log and derives the floor, score and relics itself, so a result cannot be claimed without playing it. A death banks no relics.'
  );
  body.append(fine);
  const leave = el('div', 'player-actions');
  leave.append(backLink(), docsLink());
  body.append(leave);

  root.replaceChildren(shell(body));
}

/** The way home, always visible: a real button-sized link, not just the small wordmark. */
function backLink(): HTMLAnchorElement {
  const link = el('a', 'btn btn-back', 'Back to the game');
  link.href = '/';
  return link;
}

function docsLink(): HTMLAnchorElement {
  const link = el('a', 'btn', 'Docs');
  link.href = '/docs/';
  return link;
}

function shell(content: HTMLElement): HTMLElement {
  const page = el('div', 'page');
  const header = el('header', 'page-header');
  const brand = el('a', 'brand-link', 'Deepmark');
  brand.href = '/';
  header.append(brand);
  header.append(el('p', 'eyebrow', 'Stellar testnet'));
  page.append(header);
  const nav = el('nav', 'page-nav');
  nav.setAttribute('aria-label', 'Deepmark');
  nav.append(backLink(), docsLink());
  page.append(nav);
  const main = el('main');
  main.setAttribute('aria-busy', content.getAttribute('role') === 'status' ? 'true' : 'false');
  main.append(el('h1', 'page-title', 'Recorded play'));
  main.append(content);
  page.append(main);
  return page;
}
