import { HEROES, HERO_ORDER } from '../game/heroes';
import { CHARMS, WEAPONS, type Item } from '../game/items';
import { isValidName, NAME_MAX, NAME_MIN, statsFor, EMBLEM_COUNT } from '../game/loadout';
import { loadoutOf, randomName, saveDraft, type Draft } from '../game/draft';
import { cloakCount, cloakFilter, cloakName, cloakSwatch, EMBLEM_NAMES, emblemIcon } from './emblems';

export interface CreatorHooks {
  /** The player pressed Begin descent with a valid delver. */
  onBegin: (draft: Draft) => void;
  onBack: () => void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function signed(value: number): string {
  if (value === 0) return '0';
  return value > 0 ? `+${value}` : `${value}`;
}

function deltaText(item: Item): string {
  const parts: string[] = [];
  if (item.hp !== 0) parts.push(`HP ${signed(item.hp)}`);
  if (item.dmgMin !== 0) parts.push(`Min hit ${signed(item.dmgMin)}`);
  if (item.dmgMax !== 0) parts.push(`Max hit ${signed(item.dmgMax)}`);
  return parts.join('  ·  ');
}

/**
 * The delver creator. It is a self contained component: it owns its DOM and
 * its text field, so the overlay renderer must not rebuild it while it is open
 * (that would drop focus mid-typing).
 */
export function mountCreator(host: HTMLElement, initial: Draft, hooks: CreatorHooks): void {
  const draft: Draft = { ...initial, look: { ...initial.look } };
  host.replaceChildren();

  const root = el('form', 'panel panel-scroll panel-wide creator');
  root.noValidate = true;
  root.append(el('h2', 'panel-title', 'Forge your delver'));
  root.append(
    el(
      'p',
      'panel-sub',
      'Clear all three floors and this delver is yours to keep, as a token on Stellar. Fall, and it is gone.'
    )
  );

  // Preview
  const preview = el('div', 'creator-preview');
  const previewPortrait = el('img', 'creator-portrait');
  previewPortrait.alt = '';
  const previewCopy = el('div', 'creator-preview-copy');
  const previewName = el('p', 'creator-preview-name');
  const previewStats = el('p', 'creator-preview-stats');
  previewCopy.append(previewName, previewStats);
  const previewEmblem = el('span', 'creator-preview-emblem');
  preview.append(previewPortrait, previewCopy, previewEmblem);
  root.append(preview);

  // Name
  const nameField = el('label', 'field');
  nameField.append(el('span', 'field-label', 'Name'));
  const nameRow = el('div', 'field-row');
  const nameInput = el('input', 'input');
  nameInput.type = 'text';
  nameInput.maxLength = NAME_MAX;
  nameInput.autocomplete = 'off';
  nameInput.spellcheck = false;
  nameInput.value = draft.look.name;
  nameInput.setAttribute('aria-describedby', 'creator-name-hint');
  const reroll = el('button', 'btn', 'Another name');
  reroll.type = 'button';
  nameRow.append(nameInput, reroll);
  nameField.append(nameRow);
  const nameHint = el('span', 'field-hint');
  nameHint.id = 'creator-name-hint';
  nameField.append(nameHint);
  root.append(nameField);

  // Emblem and cloak
  const lookRow = el('div', 'look-row');
  const emblemGroup = el('div', 'field');
  emblemGroup.append(el('span', 'field-label', 'Emblem'));
  const emblemButtons: HTMLButtonElement[] = [];
  const emblemList = el('div', 'chip-row');
  emblemList.setAttribute('role', 'group');
  emblemList.setAttribute('aria-label', 'Emblem');
  for (let i = 0; i < EMBLEM_COUNT; i += 1) {
    const b = el('button', 'chip chip-emblem');
    b.type = 'button';
    b.setAttribute('aria-label', EMBLEM_NAMES[i] ?? `Emblem ${i + 1}`);
    b.append(emblemIcon(i));
    b.addEventListener('click', () => {
      draft.look.emblem = i;
      refresh();
    });
    emblemButtons.push(b);
    emblemList.append(b);
  }
  emblemGroup.append(emblemList);

  const cloakGroup = el('div', 'field');
  cloakGroup.append(el('span', 'field-label', 'Cloak'));
  const cloakButtons: HTMLButtonElement[] = [];
  const cloakList = el('div', 'chip-row');
  cloakList.setAttribute('role', 'group');
  cloakList.setAttribute('aria-label', 'Cloak colour');
  for (let i = 0; i < cloakCount(); i += 1) {
    const b = el('button', 'chip chip-cloak');
    b.type = 'button';
    b.setAttribute('aria-label', cloakName(i));
    b.style.setProperty('--swatch', cloakSwatch(i));
    b.addEventListener('click', () => {
      draft.look.cloak = i;
      refresh();
    });
    cloakButtons.push(b);
    cloakList.append(b);
  }
  cloakGroup.append(cloakList);
  lookRow.append(emblemGroup, cloakGroup);
  root.append(lookRow);

  // Base
  const baseGroup = el('div', 'field');
  baseGroup.append(el('span', 'field-label', 'Delver'));
  const baseButtons: HTMLButtonElement[] = [];
  const baseList = el('div', 'pick-grid pick-grid-2');
  HERO_ORDER.forEach((id, index) => {
    const hero = HEROES[id];
    const b = el('button', 'pick');
    b.type = 'button';
    const img = el('img', 'pick-portrait');
    img.src = `/art/${hero.art}`;
    img.alt = '';
    const copy = el('span', 'pick-copy');
    copy.append(el('span', 'pick-name', hero.name));
    copy.append(el('span', 'pick-blurb', hero.blurb));
    b.append(img, copy);
    b.addEventListener('click', () => {
      draft.base = index;
      refresh();
    });
    baseButtons.push(b);
    baseList.append(b);
  });
  baseGroup.append(baseList);
  root.append(baseGroup);

  function itemGroup(label: string, items: readonly Item[], pick: (id: number) => void): { group: HTMLElement; buttons: HTMLButtonElement[] } {
    const group = el('div', 'field');
    group.append(el('span', 'field-label', label));
    const list = el('div', 'pick-grid');
    const buttons: HTMLButtonElement[] = [];
    for (const item of items) {
      const b = el('button', 'pick pick-item');
      b.type = 'button';
      const copy = el('span', 'pick-copy');
      copy.append(el('span', 'pick-name', item.name));
      copy.append(el('span', 'pick-blurb', item.blurb));
      copy.append(el('span', 'pick-delta', deltaText(item)));
      b.append(copy);
      b.addEventListener('click', () => {
        pick(item.id);
        refresh();
      });
      buttons.push(b);
      list.append(b);
    }
    group.append(list);
    return { group, buttons };
  }
  const weapons = itemGroup('Weapon', WEAPONS, (id) => {
    draft.weapon = id;
  });
  const charms = itemGroup('Charm', CHARMS, (id) => {
    draft.charm = id;
  });
  root.append(weapons.group, charms.group);

  const actions = el('div', 'title-actions');
  const begin = el('button', 'btn btn-primary', 'Begin descent');
  begin.type = 'submit';
  const back = el('button', 'btn', 'Back');
  back.type = 'button';
  actions.append(begin, back);
  root.append(actions);

  function setPressed(buttons: HTMLButtonElement[], selected: number): void {
    buttons.forEach((b, i) => {
      b.setAttribute('aria-pressed', i === selected ? 'true' : 'false');
      b.classList.toggle('is-selected', i === selected);
    });
  }

  function refresh(): void {
    const name = draft.look.name;
    const valid = isValidName(name);
    nameHint.textContent = valid
      ? `${name.length} / ${NAME_MAX}`
      : `Use ${NAME_MIN} to ${NAME_MAX} letters, numbers and single spaces.`;
    nameHint.classList.toggle('is-error', !valid);
    nameInput.setAttribute('aria-invalid', valid ? 'false' : 'true');
    begin.disabled = !valid;

    setPressed(emblemButtons, draft.look.emblem);
    setPressed(cloakButtons, draft.look.cloak);
    setPressed(baseButtons, draft.base);
    setPressed(weapons.buttons, draft.weapon);
    setPressed(charms.buttons, draft.charm);

    const stats = statsFor(loadoutOf(draft));
    const heroId = HERO_ORDER[draft.base] ?? 'lantern';
    previewPortrait.src = `/art/${HEROES[heroId].art}`;
    previewPortrait.style.filter = cloakFilter(draft.look.cloak, draft.base);
    previewName.textContent = valid ? name : 'Unnamed delver';
    previewStats.textContent = `${stats.maxHp} HP  ·  strikes for ${stats.dmgMin} to ${stats.dmgMax}`;
    previewEmblem.replaceChildren(emblemIcon(draft.look.emblem, 'emblem emblem-large'));
  }

  nameInput.addEventListener('input', () => {
    draft.look.name = nameInput.value.trim().replace(/\s+/g, ' ');
    refresh();
  });
  reroll.addEventListener('click', () => {
    draft.look.name = randomName();
    nameInput.value = draft.look.name;
    refresh();
  });
  back.addEventListener('click', () => hooks.onBack());
  root.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!isValidName(draft.look.name)) {
      nameInput.focus();
      return;
    }
    saveDraft(draft);
    hooks.onBegin({ ...draft, look: { ...draft.look } });
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      hooks.onBack();
    }
  });

  host.append(root);
  refresh();
  nameInput.focus();
}
