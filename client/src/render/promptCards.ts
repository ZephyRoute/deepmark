import { ENEMIES } from '../game/enemies';
import { buildFloor, type RelicKind } from '../game/floor';
import type { RunState } from '../game/state';
import { button, el } from './dom';

export function combatCard(run: RunState): HTMLElement {
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

const RELIC_KIND_ORDER: readonly RelicKind[] = ['core', 'rare', 'common'];

export function choiceCard(run: RunState, onDescendHover: (hovering: boolean) => void): HTMLElement {
  const card = el('div', 'prompt prompt-safe');
  card.append(el('p', 'prompt-title', `Floor ${run.floorNumber} is clear.`));

  const stake = el('div', 'choice-stake');

  const hpRow = el('div', 'choice-hp');
  const track = el('span', 'hp-track');
  const fill = el('span', 'hp-fill');
  const ratio = run.player.maxHp > 0 ? Math.max(0, Math.min(1, run.player.hp / run.player.maxHp)) : 0;
  fill.style.width = `${(ratio * 100).toFixed(1)}%`;
  track.append(fill);
  hpRow.append(track, el('span', 'choice-hp-text', `${run.player.hp} / ${run.player.maxHp} HP`));
  stake.append(hpRow);

  const held = RELIC_KIND_ORDER.filter((kind) => run.relicsByKind[kind] > 0);
  if (held.length > 0) {
    const relicRow = el('div', 'choice-relics');
    for (const kind of held) {
      const chip = el('span', 'choice-relic-chip');
      const icon = el('img', 'choice-relic-icon');
      icon.src = `/art/relic-${kind}.webp`;
      icon.alt = '';
      chip.append(icon, el('span', 'sr-only', `${kind} relics `), el('span', '', `×${run.relicsByKind[kind]}`));
      relicRow.append(chip);
    }
    stake.append(relicRow);
  }

  stake.append(el('span', 'choice-score', `Score ${run.scoreThisRun}`));
  card.append(stake);

  const nextLayout = buildFloor(run.floorNumber + 1);
  const guardians = [...new Set(nextLayout.enemies.map((enemy) => ENEMIES[enemy.kind].name))];
  if (guardians.length > 0) {
    card.append(el('p', 'prompt-sub', `Ahead: ${guardians.join(', ')}.`));
  }
  card.append(el('p', 'prompt-sub', 'Descending keeps your HP and raises the risk. Extracting banks what you hold.'));

  const actions = el('div', 'prompt-actions');
  const descend = button('Descend', 'confirm', 'btn btn-primary');
  descend.addEventListener('pointerenter', () => onDescendHover(true));
  descend.addEventListener('pointerleave', () => onDescendHover(false));
  actions.append(descend, button('Extract', 'cancel', 'btn'));
  card.append(actions);
  return card;
}
