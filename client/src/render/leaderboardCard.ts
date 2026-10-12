import { MAX_FLOOR } from '../game/floor';
import { button, el, shortenAddress } from './dom';
import { emblemIcon } from './emblems';
import { loadingBlock } from './loader';
import type { LeaderboardView } from './chromeTypes';

/** Rows enter one after another so the table reads top down. */
const ROW_STAGGER_MS = 60;
/** The rank number of a freshly verified row lands a beat after its row. */
const FRESH_RANK_DELAY_MS = 180;

export function leaderboardCard(view: LeaderboardView): HTMLElement {
  const card = el('div', 'panel panel-scroll');
  card.append(el('h2', 'panel-title', 'Leaderboard'));
  card.append(el('p', 'panel-sub', 'Best verified runs. The contract replays every run before it is ranked.'));

  const tabs = el('div', 'tab-row');
  const fresh = button('Fresh delvers', 'tabFresh', view.boardTab === 'fresh' ? 'btn btn-primary' : 'btn');
  const veteran = button('Veterans', 'tabVeteran', view.boardTab === 'veteran' ? 'btn btn-primary' : 'btn');
  fresh.setAttribute('aria-pressed', view.boardTab === 'fresh' ? 'true' : 'false');
  veteran.setAttribute('aria-pressed', view.boardTab === 'veteran' ? 'true' : 'false');
  tabs.append(fresh, veteran);
  card.append(tabs);

  if (view.leaderboardLoading) {
    card.append(loadingBlock('Loading records'));
  } else if (view.leaderboardFailed) {
    card.append(el('p', 'panel-body', 'The leaderboard could not be read right now. Your connection or Stellar may be having a moment.'));
    card.append(button('Try again', 'retryBoard', 'btn btn-primary'));
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
      item.style.animationDelay = `${index * ROW_STAGGER_MS}ms`;
      const rank = el('span', 'board-rank', `${index + 1}`);
      if (fresh) rank.style.animationDelay = `${index * ROW_STAGGER_MS + FRESH_RANK_DELAY_MS}ms`;
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
