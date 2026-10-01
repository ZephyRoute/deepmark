import { ENEMIES } from '../game/enemies';
import { MAX_FLOOR } from '../game/floor';
import { HEROES, type HeroId } from '../game/heroes';
import type { Progress } from '../game/progress';
import type { RunState } from '../game/state';

export interface LeaderboardRow {
  address: string;
  bestFloor: number;
  bestRelics: number;
  totalRuns: number;
}

export type ChainRead = 'loading' | 'ready' | 'unavailable';

export interface OnchainSnapshot {
  bestFloor: number;
  bestRelics: number;
  totalRuns: number;
}

export interface ChromeView {
  showLeaderboard: boolean;
  showStats: boolean;
  leaderboardLoading: boolean;
  leaderboardRows: LeaderboardRow[] | null;
  playerAddress: string;
  run: RunState | null;
  progress: Progress;
  onchainSummary: string;
  onchain: OnchainSnapshot | null;
  chainRead: ChainRead;
  chainStatus: string;
  heroId: HeroId;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, action: string, className = 'btn'): HTMLButtonElement {
  const node = el('button', className, label);
  node.type = 'button';
  node.dataset.action = action;
  return node;
}

function shortenAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function setText(id: string, value: string): void {
  const node = document.getElementById(id);
  if (node && node.textContent !== value) node.textContent = value;
}

let overlayKey = '';

function renderOverlay(view: ChromeView): void {
  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  const key = overlaySignature(view);
  if (key === overlayKey) return;
  overlayKey = key;
  overlay.replaceChildren();

  if (view.showLeaderboard) {
    overlay.hidden = false;
    overlay.append(leaderboardCard(view));
    return;
  }

  if (view.showStats) {
    overlay.hidden = false;
    overlay.append(statsCard(view));
    return;
  }

  if (!view.run) {
    overlay.hidden = false;
    overlay.append(titleCard(view));
    return;
  }

  if (view.run.mode === 'result') {
    overlay.hidden = false;
    overlay.append(resultCard(view.run, view.progress, view.chainStatus));
    return;
  }

  if (view.run.mode === 'combat' || view.run.mode === 'choice') {
    overlay.hidden = false;
    overlay.classList.add('overlay-prompt');
    overlay.append(view.run.mode === 'combat' ? combatCard(view.run) : choiceCard(view.run));
    return;
  }

  overlay.hidden = true;
  overlay.classList.remove('overlay-prompt');
}

function overlaySignature(view: ChromeView): string {
  if (view.showLeaderboard) {
    const rows = view.leaderboardRows
      ?.map((row) => `${row.address}:${row.bestFloor}:${row.bestRelics}:${row.totalRuns}`)
      .join('|');
    return `board:${view.leaderboardLoading}:${rows ?? ''}:${view.playerAddress}`;
  }
  if (view.showStats) {
    const progress = view.progress;
    const chain = view.onchain
      ? `${view.onchain.bestFloor}:${view.onchain.bestRelics}:${view.onchain.totalRuns}`
      : '';
    return `stats:${view.chainRead}:${chain}:${view.playerAddress}:${progress.runsPlayed}:${progress.extractions}:${progress.deaths}:${progress.bestFloor}:${progress.bestRelics}:${progress.bestScore}:${progress.relicsKept}:${progress.lanternRuns}:${progress.cinderRuns}`;
  }
  if (!view.run) {
    return `title:${view.heroId}:${view.progress.runsPlayed}:${view.progress.bestFloor}:${view.progress.bestRelics}:${view.onchainSummary}`;
  }
  if (view.run.mode === 'result') {
    return `result:${view.run.resultKind}:${view.run.floorNumber}:${view.run.relicsThisRun}:${view.run.scoreThisRun}:${view.run.player.hp}:${view.run.newBest}:${view.chainStatus}:${view.progress.bestFloor}:${view.progress.bestRelics}`;
  }
  if (view.run.mode === 'combat') {
    const enemy = view.run.activeEnemyIndex !== null ? view.run.enemies[view.run.activeEnemyIndex] : undefined;
    return `combat:${enemy?.kind ?? ''}:${enemy?.hp ?? ''}`;
  }
  if (view.run.mode === 'choice') {
    return `choice:${view.run.floorNumber}:${view.run.relicsThisRun}`;
  }
  return 'play';
}

function titleCard(view: ChromeView): HTMLElement {
  const card = el('div', 'title-screen');
  card.append(el('p', 'eyebrow', 'Stellar testnet'));
  card.append(el('h1', 'title', 'Deepmark'));
  card.append(el('p', 'tagline', 'Leave a mark in the depths, or lose it on the way out.'));
  const picks = el('div', 'hero-picks');
  picks.append(heroPick('lantern', view.heroId));
  picks.append(heroPick('cinder', view.heroId));
  card.append(picks);
  const actions = el('div', 'title-actions');
  actions.append(button('Descend', 'confirm', 'btn btn-primary'));
  actions.append(button('Stats', 'stats', 'btn'));
  actions.append(button('Leaderboard', 'leaderboard', 'btn'));
  card.append(actions);

  if (view.progress.runsPlayed > 0) {
    card.append(
      el(
        'p',
        'stats',
        `Best floor ${view.progress.bestFloor} / ${MAX_FLOOR}  ·  Best relics ${view.progress.bestRelics}  ·  Runs ${view.progress.runsPlayed}`
      )
    );
  }
  if (view.onchainSummary) card.append(el('p', 'chain', view.onchainSummary));
  card.append(el('p', 'hint', 'Left and right choose a delver. Enter descends. M opens your record. WASD moves. Esc retreats or extracts.'));
  return card;
}

function heroPick(id: HeroId, selectedId: HeroId): HTMLButtonElement {
  const hero = HEROES[id];
  const selected = id === selectedId;
  const node = el('button', selected ? 'hero-pick is-selected' : 'hero-pick');
  node.type = 'button';
  node.dataset.action = id === 'lantern' ? 'pickLantern' : 'pickCinder';
  node.setAttribute('aria-pressed', selected ? 'true' : 'false');
  const portrait = el('img', 'hero-portrait');
  portrait.src = `/art/${hero.art}`;
  portrait.alt = '';
  const copy = el('span', 'hero-copy');
  copy.append(el('span', 'hero-name', hero.name));
  copy.append(el('span', 'hero-blurb', hero.blurb));
  node.append(portrait, copy);
  return node;
}

function leaderboardCard(view: ChromeView): HTMLElement {
  const card = el('div', 'panel panel-scroll');
  card.append(el('h2', 'panel-title', 'Leaderboard'));
  card.append(el('p', 'panel-sub', 'Read live from the deployed Stellar testnet contract.'));

  if (view.leaderboardLoading) {
    card.append(el('p', 'panel-body', 'Loading records...'));
  } else if (!view.leaderboardRows || view.leaderboardRows.length === 0) {
    card.append(el('p', 'panel-body', 'No runs recorded on-chain yet.'));
  } else {
    const table = el('ol', 'board');
    view.leaderboardRows.forEach((row, index) => {
      const item = el('li', row.address === view.playerAddress ? 'board-row is-you' : 'board-row');
      item.append(el('span', 'board-rank', `${index + 1}`));
      const who = row.address === view.playerAddress
        ? `${shortenAddress(row.address)} (you)`
        : shortenAddress(row.address);
      item.append(el('span', 'board-who', who));
      item.append(el('span', 'board-stat', `${row.bestFloor}/${MAX_FLOOR}`));
      item.append(el('span', 'board-stat', `${row.bestRelics}`));
      item.append(el('span', 'board-stat', `${row.totalRuns}`));
      table.append(item);
    });
    const head = el('div', 'board-head');
    head.append(el('span', '', '#'));
    head.append(el('span', '', 'Player'));
    head.append(el('span', '', 'Floor'));
    head.append(el('span', '', 'Relics'));
    head.append(el('span', '', 'Runs'));
    card.append(head, table);
  }

  card.append(button('Back', 'cancel', 'btn'));
  return card;
}

function metric(value: string, label: string): HTMLElement {
  const node = el('div', 'metric');
  node.append(el('span', 'metric-value', value));
  node.append(el('span', 'metric-label', label));
  return node;
}

function metricGrid(tiles: HTMLElement[]): HTMLElement {
  const grid = el('div', 'metric-grid');
  for (const tile of tiles) grid.append(tile);
  return grid;
}

function statsCard(view: ChromeView): HTMLElement {
  const card = el('div', 'panel panel-scroll panel-wide');
  card.append(el('h2', 'panel-title', 'Your record'));
  card.append(el('p', 'panel-sub', 'This browser keeps the detail. Stellar keeps the mark anyone can read.'));

  const local = el('section', 'metric-group');
  local.append(el('h3', 'metric-heading', 'This browser'));
  const progress = view.progress;
  if (progress.runsPlayed === 0) {
    local.append(el('p', 'panel-body', 'No finished run in this browser yet.'));
  } else {
    const outcomes = progress.extractions + progress.deaths;
    const delvers = progress.lanternRuns + progress.cinderRuns;
    const partial = outcomes < progress.runsPlayed || delvers < progress.runsPlayed;
    const hasNewDetail = outcomes + delvers > 0;
    local.append(
      metricGrid(
        hasNewDetail
          ? [
              metric(String(progress.runsPlayed), 'Runs'),
              metric(String(progress.extractions), 'Extracted'),
              metric(String(progress.deaths), 'Lost'),
              metric(`${progress.bestFloor} / ${MAX_FLOOR}`, 'Best floor'),
              metric(String(progress.bestRelics), 'Best relics'),
              metric(String(progress.relicsKept), 'Relics banked'),
              metric(String(progress.bestScore), 'Best score'),
              metric(String(progress.lanternRuns), 'Lantern'),
              metric(String(progress.cinderRuns), 'Cinder'),
            ]
          : [
              metric(String(progress.runsPlayed), 'Runs'),
              metric(`${progress.bestFloor} / ${MAX_FLOOR}`, 'Best floor'),
              metric(String(progress.bestRelics), 'Best relics'),
            ]
      )
    );
    if (partial) {
      local.append(
        el(
          'p',
          'panel-sub',
          'Wins, losses, score, relics banked, and delver counts include only runs finished after this page shipped. Earlier runs still count toward the total, best floor, and best relics.'
        )
      );
    }
  }
  card.append(local);

  const chain = el('section', 'metric-group');
  chain.append(el('h3', 'metric-heading', 'Stellar testnet'));
  if (view.playerAddress) {
    chain.append(el('p', 'panel-sub', `You ${shortenAddress(view.playerAddress)}`));
  }
  if (view.chainRead === 'loading') {
    chain.append(el('p', 'panel-body', 'Reading the Stellar record...'));
  } else if (view.chainRead === 'unavailable') {
    chain.append(el('p', 'panel-body', 'Stellar could not be reached from this browser.'));
  } else if (!view.onchain) {
    chain.append(el('p', 'panel-body', 'No run recorded for you on Stellar yet.'));
  } else {
    chain.append(el('p', 'panel-sub', 'Best floor, best relics, and how many runs were recorded.'));
    chain.append(
      metricGrid([
        metric(`${view.onchain.bestFloor} / ${MAX_FLOOR}`, 'Best floor'),
        metric(String(view.onchain.bestRelics), 'Best relics'),
        metric(String(view.onchain.totalRuns), 'Runs'),
      ])
    );
  }
  card.append(chain);

  card.append(button('Back', 'cancel', 'btn'));
  return card;
}

function combatCard(run: RunState): HTMLElement {
  const enemy = run.activeEnemyIndex !== null ? run.enemies[run.activeEnemyIndex] : undefined;
  const name = enemy ? ENEMIES[enemy.kind].name : 'Something';
  const card = el('div', 'prompt prompt-danger');
  card.append(el('p', 'prompt-title', `${name} blocks the way.`));
  if (enemy) card.append(el('p', 'prompt-sub', `${enemy.hp} / ${enemy.maxHp} HP`));
  const actions = el('div', 'prompt-actions');
  actions.append(button('Attack', 'confirm', 'btn btn-primary'));
  actions.append(button('Retreat', 'cancel', 'btn'));
  card.append(actions);
  return card;
}

function choiceCard(run: RunState): HTMLElement {
  const card = el('div', 'prompt prompt-safe');
  card.append(el('p', 'prompt-title', `Floor ${run.floorNumber} is clear.`));
  card.append(el('p', 'prompt-sub', `${run.relicsThisRun} relics in hand. Descending keeps your HP and raises the risk.`));
  const actions = el('div', 'prompt-actions');
  actions.append(button('Descend', 'confirm', 'btn btn-primary'));
  actions.append(button('Extract', 'cancel', 'btn'));
  card.append(actions);
  return card;
}

function resultCard(run: RunState, progress: Progress, chainStatus: string): HTMLElement {
  const won = run.resultKind === 'extracted';
  const card = el('div', won ? 'panel result result-win' : 'panel result result-loss');
  card.append(el('h2', 'panel-title', won ? 'Extracted' : 'Lost in the dark'));
  card.append(el('p', 'panel-body', `Floor reached ${run.floorNumber} / ${MAX_FLOOR}`));
  card.append(el('p', 'panel-body', `Relics kept ${run.relicsThisRun}  ·  Score ${won ? run.scoreThisRun : 0}`));
  if (won) card.append(el('p', 'panel-body', `HP remaining ${run.player.hp}`));
  if (run.newBest) card.append(el('p', 'new-best', 'New best'));
  card.append(
    el('p', 'stats', `Best floor ${progress.bestFloor} / ${MAX_FLOOR}  ·  Best relics ${progress.bestRelics}`)
  );
  if (chainStatus) card.append(el('p', 'chain', chainStatus));
  card.append(button('Title screen', 'confirm', 'btn btn-primary'));
  return card;
}

export function syncChrome(view: ChromeView): void {
  const playing = Boolean(view.run) && !view.showLeaderboard && !view.showStats && view.run?.mode !== 'result';
  const hud = document.getElementById('hud');
  if (hud) hud.hidden = !playing;

  const overlay = document.getElementById('overlay');
  if (overlay && view.run?.mode !== 'combat' && view.run?.mode !== 'choice') {
    overlay.classList.remove('overlay-prompt');
  }

  if (playing && view.run) {
    const floorName = ['', 'Reliquary', 'Drowned chapel', 'Obsidian crypt'][view.run.floorNumber] ?? '';
    setText('floor-label', `Floor ${view.run.floorNumber} / ${MAX_FLOOR}  ${floorName}`);
    setText('hud-hp', `HP ${view.run.player.hp}/${view.run.player.maxHp}`);
    setText('hud-relics', `Relics ${view.run.relicsThisRun}`);
    setText('hud-score', `Score ${view.run.scoreThisRun}`);
    const lastLine = view.run.log[view.run.log.length - 1] ?? '';
    setText('hud-log', lastLine);
  } else if (view.showStats) {
    setText('floor-label', 'Record');
  } else if (view.showLeaderboard) {
    setText('floor-label', 'Records');
  } else if (!view.run) {
    setText('floor-label', '');
  } else {
    setText('floor-label', view.run.resultKind === 'extracted' ? 'Out' : 'Ended');
  }

  renderOverlay(view);
}
