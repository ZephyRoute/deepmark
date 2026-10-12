import { HEROES, HERO_ORDER } from '../game/heroes';
import { CHARMS, WEAPONS } from '../game/items';
import { MAX_RANK } from '../game/loadout';
import type { Hero } from '../stellar/contract';
import { el, button } from './dom';
import { cloakFilter, emblemIcon } from './emblems';
import { loadingBlock } from './loader';
import type { VaultView } from './chromeTypes';

/** Vault cards enter one after another so the list reads top down. */
const CARD_STAGGER_MS = 60;

export function vaultCard(view: VaultView): HTMLElement {
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
    if (view.vaultLoading) {
      card.append(loadingBlock('Opening the vault', 2));
    } else {
      card.append(el('p', 'panel-body', 'The vault could not be read right now. Your connection or Stellar may be having a moment.'));
      card.append(button('Try again', 'retryVault', 'btn btn-primary'));
    }
  } else if (view.vaultHeroes.length === 0) {
    card.append(el('p', 'panel-body', 'Empty for now. Clear all three floors with a new delver to claim one.'));
  } else {
    const list = el('div', 'vault-list');
    view.vaultHeroes.forEach((hero, index) => {
      const item = heroCard(hero, view);
      item.style.animationDelay = `${index * CARD_STAGGER_MS}ms`;
      list.append(item);
    });
    card.append(list);
  }

  card.append(button('Back', 'cancel', 'btn'));
  wrap.append(card);
  return wrap;
}

function heroCard(hero: Hero, view: VaultView): HTMLElement {
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
