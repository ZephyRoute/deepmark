import type { RunState } from '../game/state';
import { MAX_FLOOR } from '../game/floor';
import { HEROES, HERO_ORDER } from '../game/heroes';
import { cloakFilter } from '../render/emblems';
import { challengeUrl, renderShareCard } from '../render/shareCard';
import { OBJECT_URL_REVOKE_MS, SHARE_FLASH_MS } from '../constants';
import { session } from './session';

type ShareButton = 'shareSave' | 'shareCopy' | 'shareChallenge';

function flashShareButton(action: ShareButton, label: string): void {
  const btn = document.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
  if (!btn) return;
  const original = btn.textContent ?? '';
  btn.textContent = label;
  window.setTimeout(() => {
    btn.textContent = original;
  }, SHARE_FLASH_MS);
}

export async function shareResult(target: RunState, mode: 'save' | 'copy'): Promise<void> {
  const heroId = HERO_ORDER[target.loadout.base] ?? 'lantern';
  const blob = await renderShareCard({
    name: target.look.name,
    portraitArt: HEROES[heroId].veteranArt,
    portraitFilter: cloakFilter(target.look.cloak, target.loadout.base),
    weapon: target.loadout.weapon,
    charm: target.loadout.charm,
    floorReached: target.floorNumber,
    maxFloor: MAX_FLOOR,
    score: target.scoreThisRun,
    relics: target.relicsThisRun,
    rank: session.chainRank,
    txHash: session.chainTx,
  });
  if (!blob) return;
  if (mode === 'copy' && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      flashShareButton('shareCopy', 'Copied');
      return;
    } catch {
      // Clipboard image writes are not supported everywhere (notably iOS Safari): fall back to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `deepmark-${target.look.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_REVOKE_MS);
  flashShareButton(mode === 'copy' ? 'shareCopy' : 'shareSave', 'Saved');
}

export async function copyChallengeLink(target: RunState): Promise<void> {
  const url = challengeUrl(target.seed, target.loadout);
  try {
    await navigator.clipboard.writeText(url);
    flashShareButton('shareChallenge', 'Copied');
  } catch {
    // No clipboard permission: the button simply does not confirm.
  }
}
