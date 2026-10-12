import { MAX_FLOOR } from '../game/floor';
import { getAmbienceVolume, getFxVolume, setAmbienceVolume, setFxVolume } from './audio';
import { emitAction } from '../input/keyboard';
import { RESTORE_FIELD_ID } from '../constants';
import { button, el, shortenAddress } from './dom';
import { loadingBlock } from './loader';
import type { ChromeView } from './chromeTypes';

/** Volume sliders move in 5 percent steps. */
const VOLUME_STEP = '0.05';

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

/** Step one of restoring: an in-page field. The pasted text is masked and never echoed back. */
function restoreForm(view: ChromeView): HTMLElement {
  const form = el('form', 'field');
  form.noValidate = true;
  const label = el('label', 'field-label', 'Paste your recovery code');
  label.htmlFor = RESTORE_FIELD_ID;
  const input = el('input', 'input');
  input.id = RESTORE_FIELD_ID;
  input.type = 'password';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'off');
  if (view.restoreError) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', 'restore-hint');
  }
  const hint = el(
    'p',
    view.restoreError ? 'field-hint is-error' : 'field-hint',
    view.restoreError || 'Nothing changes until you confirm on the next step.'
  );
  hint.id = 'restore-hint';
  hint.setAttribute('role', view.restoreError ? 'alert' : 'note');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    emitAction('restoreCheck');
  });
  const actions = el('div', 'result-actions');
  const next = button('Continue', 'restoreCheck', 'btn');
  actions.append(next, button('Cancel', 'restoreCancel', 'btn'));
  form.append(label, input, hint, actions);
  setTimeout(() => input.focus({ preventScroll: true }), 0);
  return form;
}

/** Step two: replacing the account is explicit, and the current code can be copied first. */
function restoreConfirm(view: ChromeView): HTMLElement {
  const box = el('div', 'field');
  const who = view.playerAddress ? ` (${shortenAddress(view.playerAddress)})` : '';
  box.append(
    el(
      'p',
      'panel-body',
      `This browser will switch to the account ${view.restoreTarget}. Your current account${who} will be replaced, and you can only get its record and relics back with its own recovery code.`
    )
  );
  if (view.recoveryNote) box.append(el('p', 'field-hint', view.recoveryNote));
  if (view.restoreError) box.append(el('p', 'field-hint is-error', view.restoreError));
  const actions = el('div', 'result-actions');
  actions.append(
    button('Copy current recovery code first', 'copyRecovery', 'btn'),
    button('Replace this account', 'restoreConfirm', 'btn'),
    button('Keep my current account', 'restoreCancel', 'btn')
  );
  box.append(actions);
  return box;
}

export function statsCard(view: ChromeView): HTMLElement {
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
    chain.append(loadingBlock('Reading the Stellar record', 2));
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

  const account = el('section', 'metric-group');
  account.append(el('h3', 'metric-heading', 'Keep your record'));
  account.append(
    el(
      'p',
      'panel-sub',
      'Your record lives in this browser. If you clear its site data or switch browsers, you lose access to it. Copy your recovery code and keep it somewhere private to bring it back.'
    )
  );
  if (view.recoveryNote) account.append(el('p', 'panel-body', view.recoveryNote));
  if (view.restoreStep === 'enter') {
    account.append(restoreForm(view));
  } else if (view.restoreStep === 'confirm') {
    account.append(restoreConfirm(view));
  } else {
    const recovery = el('div', 'result-actions');
    recovery.append(button('Copy recovery code', 'copyRecovery', 'btn'), button('Restore from a code', 'restoreRecovery', 'btn'));
    account.append(recovery);
  }
  card.append(account);

  const sound = el('section', 'metric-group');
  sound.append(el('h3', 'metric-heading', 'Sound'));
  sound.append(volumeSlider('Effects', getFxVolume(), setFxVolume));
  sound.append(volumeSlider('Ambience', getAmbienceVolume(), setAmbienceVolume));
  card.append(sound);

  const actions = el('div', 'result-actions sticky-actions');
  actions.append(button('Replay hints', 'replayHints', 'btn'), button('Back', 'cancel', 'btn'));
  card.append(actions);
  return card;
}

function volumeSlider(label: string, value: number, onChange: (value: number) => void): HTMLElement {
  const row = el('label', 'volume-row');
  row.append(el('span', 'volume-label', label));
  const input = el('input', 'volume-input');
  input.type = 'range';
  input.min = '0';
  input.max = '1';
  input.step = VOLUME_STEP;
  input.value = String(value);
  input.addEventListener('input', () => onChange(Number(input.value)));
  row.append(input);
  return row;
}
