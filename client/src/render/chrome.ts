import { ENEMIES } from '../game/enemies';
import { MAX_FLOOR } from '../game/floor';
import { HEROES, HERO_ORDER } from '../game/heroes';
import type { Progress } from '../game/progress';
import type { RunState } from '../game/state';
import type { Draft } from '../game/draft';
import { CHARMS, WEAPONS } from '../game/items';
import { MAX_RANK } from '../game/loadout';
import { STELLAR_CONFIG } from '../stellar/config';
import type { Hero } from '../stellar/contract';
import { mountCreator, type CreatorHooks } from './creator';
import { cloakFilter, emblemIcon } from './emblems';
import type { RelicBalances } from '../stellar/relics';

export interface LeaderboardRow {
  address: string;
  name: string;
  emblem: number;
  score: number;
  floor: number;
  hpLeft: number;
  actions: number;
}

export type ChainRead = 'loading' | 'ready' | 'unavailable';

export interface OnchainSnapshot {
  bestFloor: number;
  bestScore: number;
  runs: number;
  extractions: number;
  deaths: number;
  forfeits: number;
  relicsBanked: number;
}

export type BoardTab = 'fresh' | 'veteran';

export interface ChromeView {
  showCreator: boolean;
  showVault: boolean;
  draft: Draft;
  creatorHooks: CreatorHooks;
  vaultHeroes: Hero[] | null;
  vaultLoading: boolean;
  onVeteran: (id: number) => void;
  boardTab: BoardTab;
  chainHeroId: number | null;
  showLeaderboard: boolean;
  showStats: boolean;
  leaderboardLoading: boolean;
  leaderboardRows: LeaderboardRow[] | null;
  playerAddress: string;
  run: RunState | null;
  progress: Progress;
  onchain: OnchainSnapshot | null;
  relics: RelicBalances | null;
  chainRead: ChainRead;
  chainStatus: string;
  chainTx: string;
  chainRank: number | null;
  starting: boolean;
  practice: boolean;
}

const TX_HASH = /^[a-f0-9]{64}$/;
const WAITING_TEXT = 'Lowering the lantern. Your run is being opened on Stellar.';

function relicSummary(relics: RelicBalances | null): string {
  if (!relics) return '';
  const parts: string[] = [];
  if (relics.common > 0) parts.push(`${relics.common} common`);
  if (relics.rare > 0) parts.push(`${relics.rare} rare`);
  if (relics.core > 0) parts.push(`${relics.core} core`);
  return parts.join(', ');
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

  if (view.showCreator) {
    overlay.hidden = false;
    mountCreator(overlay, view.draft, view.creatorHooks);
    return;
  }

  if (view.showVault) {
    overlay.hidden = false;
    overlay.append(vaultCard(view));
    return;
  }

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
    overlay.append(resultCard(view));
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
  // The creator owns its DOM, so it must keep one constant signature while open.
  if (view.showCreator) return 'creator';
  if (view.showVault) {
    const ids = view.vaultHeroes?.map((h) => `${h.id}:${h.clears}`).join('|');
    return `vault:${view.vaultLoading}:${ids ?? ''}`;
  }
  if (view.showLeaderboard) {
    const rows = view.leaderboardRows
      ?.map((row) => `${row.address}:${row.score}:${row.floor}:${row.hpLeft}:${row.actions}`)
      .join('|');
    return `board:${view.boardTab}:${view.leaderboardLoading}:${rows ?? ''}:${view.playerAddress}`;
  }
  if (view.showStats) {
    const progress = view.progress;
    const chain = view.onchain
      ? `${view.onchain.bestFloor}:${view.onchain.bestScore}:${view.onchain.runs}:${view.onchain.extractions}:${view.onchain.deaths}:${view.onchain.forfeits}:${view.onchain.relicsBanked}`
      : '';
    const vault = view.relics ? `${view.relics.common}:${view.relics.rare}:${view.relics.core}` : '';
    return `stats:${view.chainRead}:${chain}:${vault}:${view.playerAddress}:${progress.runsPlayed}:${progress.extractions}:${progress.deaths}:${progress.bestFloor}:${progress.bestRelics}:${progress.bestScore}:${progress.relicsKept}:${progress.lanternRuns}:${progress.cinderRuns}`;
  }
  if (!view.run) {
    const chain = view.onchain ? `${view.onchain.bestScore}:${view.onchain.bestFloor}:${view.onchain.runs}` : '';
    const vault = view.relics ? `${view.relics.common}:${view.relics.rare}:${view.relics.core}` : '';
    return `title:${view.starting}:${view.progress.runsPlayed}:${view.progress.bestFloor}:${view.progress.bestRelics}:${chain}:${vault}`;
  }
  if (view.run.mode === 'result') {
    return `result:${view.run.resultKind}:${view.run.floorNumber}:${view.run.relicsThisRun}:${view.run.scoreThisRun}:${view.run.player.hp}:${view.run.newBest}:${view.chainStatus}:${view.chainRank ?? ''}:${view.chainTx}:${view.practice}:${view.chainHeroId ?? ''}:${view.progress.bestFloor}:${view.progress.bestRelics}`;
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
  const actions = el('div', 'title-actions');
  const descend = button(view.starting ? 'Descending...' : 'Forge a delver', 'confirm', 'btn btn-primary');
  descend.disabled = view.starting;
  actions.append(descend);
  actions.append(button('Vault', 'vault', 'btn'));
  actions.append(button('Leaderboard', 'leaderboard', 'btn'));
  actions.append(button('Stats', 'stats', 'btn'));
  card.append(actions);
  if (view.starting) {
    const waiting = el('p', 'chain', WAITING_TEXT);
    waiting.setAttribute('role', 'status');
    card.append(waiting);
  }

  if (view.progress.runsPlayed > 0) {
    card.append(
      el(
        'p',
        'stats',
        `Best floor ${view.progress.bestFloor} / ${MAX_FLOOR}  ·  Best relics ${view.progress.bestRelics}  ·  Runs ${view.progress.runsPlayed}`
      )
    );
  }
  if (view.onchain && view.onchain.runs > 0) {
    card.append(
      el(
        'p',
        'chain',
        `Verified on Stellar: best score ${view.onchain.bestScore}, floor ${view.onchain.bestFloor} / ${MAX_FLOOR}, ${view.onchain.runs} runs`
      )
    );
  }
  const vault = relicSummary(view.relics);
  if (vault) card.append(el('p', 'chain', `Relics in your vault: ${vault}`));
  card.append(el('p', 'hint', 'Enter forges a delver. V opens your vault. L the leaderboard. M your record. WASD moves. Esc retreats or extracts.'));
  const network = el('a', 'quiet-link', 'All players');
  network.href = '/stats';
  card.append(network);
  return card;
}

function leaderboardCard(view: ChromeView): HTMLElement {
  const card = el('div', 'panel panel-scroll');
  card.append(el('h2', 'panel-title', 'Leaderboard'));
  card.append(
    el('p', 'panel-sub', 'Best verified runs. The contract replays every run before it is ranked.')
  );

  const tabs = el('div', 'tab-row');
  const fresh = button('Fresh delvers', 'tabFresh', view.boardTab === 'fresh' ? 'btn btn-primary' : 'btn');
  const veteran = button('Veterans', 'tabVeteran', view.boardTab === 'veteran' ? 'btn btn-primary' : 'btn');
  fresh.setAttribute('aria-pressed', view.boardTab === 'fresh' ? 'true' : 'false');
  veteran.setAttribute('aria-pressed', view.boardTab === 'veteran' ? 'true' : 'false');
  tabs.append(fresh, veteran);
  card.append(tabs);

  if (view.leaderboardLoading) {
    card.append(el('p', 'panel-body', 'Loading records...'));
  } else if (!view.leaderboardRows || view.leaderboardRows.length === 0) {
    card.append(
      el('p', 'panel-body', view.boardTab === 'veteran' ? 'No veteran has descended yet.' : 'No verified runs yet. Be the first.')
    );
  } else {
    const table = el('ol', 'board');
    view.leaderboardRows.forEach((row, index) => {
      const mine = row.address === view.playerAddress;
      const item = el('li', mine ? 'board-row is-you' : 'board-row');
      item.append(el('span', 'board-rank', `${index + 1}`));
      const who = el('span', 'board-who');
      who.append(emblemIcon(row.emblem, 'emblem emblem-small'));
      who.append(el('span', 'board-name', mine ? `${row.name} (you)` : row.name));
      who.append(el('span', 'board-addr', shortenAddress(row.address)));
      item.append(who);
      item.append(el('span', 'board-stat', `${row.score}`));
      item.append(el('span', 'board-stat', `${row.floor}/${MAX_FLOOR}`));
      item.append(el('span', 'board-stat', `${row.hpLeft}`));
      item.append(el('span', 'board-stat', `${row.actions}`));
      table.append(item);
    });
    const head = el('div', 'board-head');
    head.append(el('span', '', '#'));
    head.append(el('span', '', 'Delver'));
    head.append(el('span', '', 'Score'));
    head.append(el('span', '', 'Floor'));
    head.append(el('span', '', 'HP'));
    head.append(el('span', '', 'Moves'));
    card.append(head, table);
  }

  card.append(button('Back', 'cancel', 'btn'));
  return card;
}

function vaultCard(view: ChromeView): HTMLElement {
  const card = el('div', 'panel panel-scroll panel-wide');
  card.append(el('h2', 'panel-title', 'Your vault'));
  card.append(
    el(
      'p',
      'panel-sub',
      'Delvers you earned by clearing all three floors. Each is a token on Stellar that you own, and each can descend again as a veteran.'
    )
  );

  if (view.vaultLoading || !view.vaultHeroes) {
    card.append(el('p', 'panel-body', view.vaultLoading ? 'Opening the vault...' : 'The vault could not be read.'));
  } else if (view.vaultHeroes.length === 0) {
    card.append(el('p', 'panel-body', 'Empty for now. Clear all three floors with a new delver to claim one.'));
  } else {
    const list = el('div', 'vault-list');
    for (const hero of view.vaultHeroes) list.append(heroCard(hero, view));
    card.append(list);
  }

  card.append(button('Back', 'cancel', 'btn'));
  return card;
}

function heroCard(hero: Hero, view: ChromeView): HTMLElement {
  const item = el('article', 'vault-card');
  const baseId = HERO_ORDER[hero.base] ?? 'lantern';
  const portrait = el('img', 'vault-portrait');
  portrait.src = `/art/${HEROES[baseId].art}`;
  portrait.alt = '';
  portrait.style.filter = cloakFilter(hero.look.cloak);
  const copy = el('div', 'vault-copy');
  const title = el('p', 'vault-name');
  title.append(emblemIcon(hero.look.emblem, 'emblem emblem-small'), el('span', '', hero.look.name));
  const kit = `${HEROES[baseId].name}  ·  ${WEAPONS[hero.weapon]?.name ?? '?'}  ·  ${CHARMS[hero.charm]?.name ?? '?'}`;
  const rank = Math.min(hero.clears, MAX_RANK);
  copy.append(
    title,
    el('p', 'vault-kit', kit),
    el('p', 'vault-meta', `Veteran rank ${rank}  ·  ${hero.clears} ${hero.clears === 1 ? 'clear' : 'clears'}`),
    el('p', 'vault-meta', `First clear: score ${hero.proof_score}, ${hero.proof_hp_left} HP left, ${hero.proof_actions} moves`)
  );
  const go = el('button', 'btn btn-primary', 'Descend as a veteran');
  go.type = 'button';
  go.addEventListener('click', () => view.onVeteran(hero.id));
  item.append(portrait, copy, go);
  return item;
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
    chain.append(el('p', 'panel-sub', 'Every number here was derived by the contract replaying your runs.'));
    chain.append(
      metricGrid([
        metric(String(view.onchain.bestScore), 'Best score'),
        metric(`${view.onchain.bestFloor} / ${MAX_FLOOR}`, 'Best floor'),
        metric(String(view.onchain.runs), 'Runs'),
        metric(String(view.onchain.extractions), 'Extracted'),
        metric(String(view.onchain.deaths), 'Lost'),
        metric(String(view.onchain.forfeits), 'Abandoned'),
        metric(String(view.onchain.relicsBanked), 'Relics banked'),
      ])
    );
  }
  if (view.relics) {
    chain.append(
      metricGrid([
        metric(String(view.relics.common), 'Common relics'),
        metric(String(view.relics.rare), 'Rare relics'),
        metric(String(view.relics.core), 'Core relics'),
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

function resultCard(view: ChromeView): HTMLElement {
  const run = view.run as RunState;
  const won = run.resultKind === 'extracted';
  const card = el('div', won ? 'panel result result-win' : 'panel result result-loss');
  card.append(el('h2', 'panel-title', won ? 'Extracted' : 'Lost in the dark'));
  card.append(el('p', 'panel-body', `Floor reached ${run.floorNumber} / ${MAX_FLOOR}`));
  card.append(el('p', 'panel-body', `Relics kept ${run.relicsThisRun}  ·  Score ${won ? run.scoreThisRun : 0}`));
  if (won) card.append(el('p', 'panel-body', `HP remaining ${run.player.hp}`));
  if (run.newBest) card.append(el('p', 'new-best', 'New best'));
  card.append(
    el('p', 'stats', `Best floor ${view.progress.bestFloor} / ${MAX_FLOOR}  ·  Best relics ${view.progress.bestRelics}`)
  );
  if (view.practice) {
    card.append(el('p', 'chain', view.chainStatus || 'Practice run. This one is not recorded on Stellar, so it cannot earn a delver.'));
  } else if (view.chainStatus) {
    const status = el('p', 'chain', view.chainStatus);
    status.setAttribute('role', 'status');
    card.append(status);
    if (view.chainRank !== null) card.append(el('p', 'chain', `Leaderboard rank #${view.chainRank}`));
    if (view.chainHeroId !== null) {
      const earned = el('p', 'new-best', `${run.look.name} is yours. Find them in your vault.`);
      earned.setAttribute('role', 'status');
      card.append(earned);
    }
    if (TX_HASH.test(view.chainTx)) {
      const link = el('a', 'quiet-link', 'View the transaction');
      link.href = `${STELLAR_CONFIG.explorerUrl}/tx/${view.chainTx}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      card.append(link);
    }
  }
  card.append(button('Title screen', 'confirm', 'btn btn-primary'));
  return card;
}

export function syncChrome(view: ChromeView): void {
  const playing =
    Boolean(view.run) && !view.showLeaderboard && !view.showStats && !view.showCreator && !view.showVault && view.run?.mode !== 'result';
  const hud = document.getElementById('hud');
  if (hud) hud.hidden = !playing;

  const overlay = document.getElementById('overlay');
  if (overlay && view.run?.mode !== 'combat' && view.run?.mode !== 'choice') {
    overlay.classList.remove('overlay-prompt');
  }

  if (playing && view.run) {
    const floorName = ['', 'Reliquary', 'Drowned chapel', 'Obsidian crypt'][view.run.floorNumber] ?? '';
    setText('floor-label', `Floor ${view.run.floorNumber} / ${MAX_FLOOR}  ${floorName}`);
    setText('hud-name', view.run.look.name);
    setText('hud-hp', `HP ${view.run.player.hp}/${view.run.player.maxHp}`);
    setText('hud-relics', `Relics ${view.run.relicsThisRun}`);
    setText('hud-score', `Score ${view.run.scoreThisRun}`);
    setText('hud-mode', view.practice ? 'Practice, not recorded' : '');
    const lastLine = view.run.log[view.run.log.length - 1] ?? '';
    setText('hud-log', lastLine);
  } else if (view.showCreator) {
    setText('floor-label', 'Forge');
  } else if (view.showVault) {
    setText('floor-label', 'Vault');
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
