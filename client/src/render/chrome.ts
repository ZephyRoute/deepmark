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
import { mountResult, updateVerification, type ResultSummary, type Verification, type VerifyState } from './result';
import { mountDescent, setDescentStage, type DescentOptions, type DescentStage } from './descent';
import { mountTitle, updateTitle, type TitleInfo } from './title';
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
  canRetry: boolean;
  verifyState: VerifyState;
  runId: number;
  showLeaderboard: boolean;
  showStats: boolean;
  leaderboardLoading: boolean;
  leaderboardRows: LeaderboardRow[] | null;
  justVerified: boolean;
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
  startStage: DescentStage;
  descent: DescentOptions | null;
  practice: boolean;
  /** Fired once, synchronously with the seal's strike animation, when a run is verified. */
  onSeal: () => void;
}

const TX_HASH = /^[a-f0-9]{64}$/;

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

/** Sets text and, if it changed, replays a small pop so gains are felt. */
function setBumpText(id: string, value: string): void {
  const node = document.getElementById(id);
  if (!node || node.textContent === value) return;
  const first = node.textContent === '';
  node.textContent = value;
  if (first) return;
  node.classList.remove('bump');
  void node.offsetWidth;
  node.classList.add('bump');
}

function paintHp(hp: number, max: number): void {
  const ratio = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  const fill = document.getElementById('hp-fill');
  const ghost = document.getElementById('hp-ghost');
  const bar = document.getElementById('hud-hp');
  const pct = `${(ratio * 100).toFixed(1)}%`;
  if (fill) fill.style.width = pct;
  if (ghost) ghost.style.width = pct;
  if (bar) bar.classList.toggle('is-low', ratio <= 0.34);
  setText('hp-text', `${hp} / ${max}`);
}

let overlayKey = '';

function renderOverlay(view: ChromeView): void {
  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  const key = overlaySignature(view);
  if (key === overlayKey) {
    if (key === 'title') updateTitle(titleInfo(view));
    return;
  }
  overlayKey = key;
  overlay.replaceChildren();

  if (view.starting && view.descent) {
    overlay.hidden = false;
    mountDescent(overlay, view.descent);
    return;
  }

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
    const info = titleInfo(view);
    if (overlay.querySelector('.title-v2')) updateTitle(info);
    else mountTitle(overlay, info);
    return;
  }

  if (view.run.mode === 'result') {
    overlay.hidden = false;
    mountResult(overlay, resultSummary(view), view.onSeal);
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
  // The descent scene animates itself, so it keeps one signature while it plays.
  if (view.starting && view.descent) return 'descent';
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
  if (!view.run) return 'title';
  if (view.run.mode === 'result') {
    // The ceremony owns its DOM and is updated in place, so it keeps one signature per run.
    return `result:${view.runId}`;
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

function titleInfo(view: ChromeView): TitleInfo {
  const progress = view.progress;
  const local = progress.runsPlayed > 0
    ? `Best floor ${progress.bestFloor} / ${MAX_FLOOR}  ·  Best relics ${progress.bestRelics}  ·  Runs ${progress.runsPlayed}`
    : '';
  const chain = view.onchain && view.onchain.runs > 0
    ? `Verified on Stellar: best score ${view.onchain.bestScore}, floor ${view.onchain.bestFloor} / ${MAX_FLOOR}, ${view.onchain.runs} runs`
    : '';
  const held = relicSummary(view.relics);
  return { local, chain, vault: held ? `Relics in your vault: ${held}` : '' };
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
      const fresh = mine && view.justVerified;
      const item = el('li', mine ? 'board-row is-you' : 'board-row');
      if (fresh) item.classList.add('is-fresh');
      item.style.animationDelay = `${index * 60}ms`;
      const rank = el('span', 'board-rank', `${index + 1}`);
      if (fresh) rank.style.animationDelay = `${index * 60 + 180}ms`;
      item.append(rank);
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
  const wrap = el('div', 'vault-view');
  wrap.append(el('div', 'vault-backdrop'));

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
    view.vaultHeroes.forEach((hero, index) => {
      const item = heroCard(hero, view);
      item.style.animationDelay = `${index * 60}ms`;
      list.append(item);
    });
    card.append(list);
  }

  card.append(button('Back', 'cancel', 'btn'));
  wrap.append(card);
  return wrap;
}

function heroCard(hero: Hero, view: ChromeView): HTMLElement {
  const item = el('article', 'vault-card');
  const baseId = HERO_ORDER[hero.base] ?? 'lantern';
  const portrait = el('img', 'vault-portrait');
  portrait.src = `/art/${HEROES[baseId].veteranArt}`;
  portrait.alt = '';
  portrait.style.filter = cloakFilter(hero.look.cloak, hero.base);
  const copy = el('div', 'vault-copy');
  const title = el('p', 'vault-name');
  title.append(emblemIcon(hero.look.emblem, 'emblem emblem-small'), el('span', '', hero.look.name));
  const kit = `${HEROES[baseId].name}  ·  ${WEAPONS[hero.weapon]?.name ?? '?'}  ·  ${CHARMS[hero.charm]?.name ?? '?'}`;
  const icons = el('span', 'vault-icons');
  for (const file of [WEAPONS[hero.weapon]?.icon, CHARMS[hero.charm]?.icon]) {
    if (!file) continue;
    const icon = el('img', 'vault-icon');
    icon.src = `/art/${file}`;
    icon.alt = '';
    icons.append(icon);
  }
  const rank = Math.min(hero.clears, MAX_RANK);
  const pips = el('span', 'vault-pips');
  for (let i = 0; i < MAX_RANK; i += 1) pips.append(el('span', i < rank ? 'vault-pip is-filled' : 'vault-pip'));
  const rankLine = el('p', 'vault-meta');
  rankLine.append(pips, document.createTextNode(`Veteran rank ${rank}  ·  ${hero.clears} ${hero.clears === 1 ? 'clear' : 'clears'}`));
  copy.append(
    title,
    el('p', 'vault-kit', kit),
    icons,
    rankLine,
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

function resultSummary(view: ChromeView): ResultSummary {
  const run = view.run as RunState;
  const won = run.resultKind === 'extracted';
  const heroId = HERO_ORDER[run.loadout.base] ?? 'lantern';
  return {
    won,
    floorReached: run.floorNumber,
    maxFloor: MAX_FLOOR,
    relics: run.relicsThisRun,
    score: won ? run.scoreThisRun : 0,
    hpLeft: run.player.hp,
    newBest: run.newBest,
    bestLine: `Best floor ${view.progress.bestFloor} / ${MAX_FLOOR}  ·  Best relics ${view.progress.bestRelics}`,
    delver: {
      name: run.look.name,
      art: HEROES[heroId].veteranArt,
      filter: cloakFilter(run.look.cloak, run.loadout.base),
      emblem: run.look.emblem,
    },
  };
}

function verificationOf(view: ChromeView): Verification {
  const url = TX_HASH.test(view.chainTx) ? `${STELLAR_CONFIG.explorerUrl}/tx/${view.chainTx}` : null;
  return {
    state: view.practice ? 'practice' : view.verifyState,
    message: view.practice
      ? view.chainStatus || 'Practice run. This one is not recorded on Stellar, so it cannot earn a delver.'
      : view.chainStatus,
    rank: view.chainRank,
    txUrl: url,
    heroEarned: view.chainHeroId !== null,
    canRetry: view.canRetry,
  };
}

export function syncChrome(view: ChromeView): void {
  if (view.starting) setDescentStage(view.startStage);
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
    const practice = view.practice ? '  ·  Practice' : '';
    setText('floor-label', `Floor ${view.run.floorNumber} / ${MAX_FLOOR}  ${floorName}${practice}`);
    setText('hud-name', view.run.look.name);
    paintHp(view.run.player.hp, view.run.player.maxHp);
    setBumpText('hud-relics', `Relics ${view.run.relicsThisRun}`);
    setBumpText('hud-score', `Score ${view.run.scoreThisRun}`);
    setText('hud-mode', view.practice ? 'Practice, not recorded' : '');
    const lastLine = view.run.log[view.run.log.length - 1] ?? '';
    setText('hud-log', lastLine);
  } else if (view.showCreator || view.showVault) {
    setText('floor-label', '');
  } else if (view.showStats) {
    setText('floor-label', 'Record');
  } else if (view.showLeaderboard) {
    setText('floor-label', 'Records');
  } else if (!view.run) {
    setText('floor-label', '');
  } else {
    setText('floor-label', view.run.resultKind === 'extracted' ? 'Out' : 'Ended');
  }

  if (view.run?.mode === 'result' && !view.showStats && !view.showLeaderboard && !view.showVault) {
    updateVerification(verificationOf(view));
  }
  renderOverlay(view);
}
