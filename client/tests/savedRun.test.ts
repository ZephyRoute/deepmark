import { beforeEach, describe, expect, test } from 'bun:test';
import { playBalanced } from '../scripts/policy';
import type { Loadout } from '../src/game/loadout';
import {
  clearSavedRun,
  loadSavedRun,
  MAX_SAVED_BYTES,
  parseSavedRun,
  planResume,
  replayRun,
  saveRun,
  serializeSavedRun,
  type OpenTicket,
  type SavedRun,
} from '../src/game/savedRun';
import { ActionCode, MAX_ACTIONS, newRun, type RunState } from '../src/game/state';
import { installMemoryStorage } from './storage';

const LOADOUT: Loadout = { base: 1, weapon: 0, charm: 2, rank: 0 };
const LOOK = { name: 'Ash', emblem: 1, cloak: 2 };
const SEED = 20_261_005;
const MID_RUN_ACTIONS = 40;

function ticketFor(run: RunState): OpenTicket {
  const { base, weapon, charm, rank } = run.loadout;
  return { seed: run.seed, base, weapon, charm, rank, look: LOOK };
}

/** A fresh run played by the balanced policy until it holds `maxActions` actions (or ends). */
function played(seed: number, maxActions: number): RunState {
  return playBalanced(newRun(LOADOUT, seed, LOOK), maxActions);
}

/** Everything a player can see or that decides what happens next, including the next dice roll. */
function snapshot(run: RunState): unknown {
  const { rng, log, events, ...rest } = run;
  return { ...rest, log, nextRoll: rng() };
}

function winningSeed(): number {
  for (let seed = 1; seed < 500; seed += 1) {
    if (played(seed, Infinity).resultKind === 'extracted') return seed;
  }
  throw new Error('no winning seed found in range');
}

beforeEach(() => {
  installMemoryStorage();
});

describe('replaying a saved run', () => {
  test('rebuilds the exact board, hit points, relics and dice of a run left mid descent', () => {
    const live = played(SEED, MID_RUN_ACTIONS);
    expect(live.mode).not.toBe('result');
    expect(live.actions.length).toBe(MID_RUN_ACTIONS);

    saveRun(live);
    const saved = loadSavedRun();
    expect(saved).not.toBeNull();
    const rebuilt = replayRun(saved!.loadout, saved!.seed, LOOK, saved!.actions);

    expect(rebuilt).not.toBeNull();
    expect(snapshot(rebuilt!)).toEqual(snapshot(live));
  });

  test('rebuilds a run from every point of a full descent', () => {
    const full = played(SEED, Infinity);
    for (let length = 0; length <= full.actions.length; length += 1) {
      const live = played(SEED, length);
      const rebuilt = replayRun(LOADOUT, SEED, LOOK, live.actions);
      expect(snapshot(rebuilt!)).toEqual(snapshot(live));
    }
  });

  test('raises no events, so a restored run makes no sound and books no progress', () => {
    const live = played(winningSeed(), Infinity);
    const rebuilt = replayRun(live.loadout, live.seed, LOOK, live.actions);
    expect(rebuilt!.events).toEqual([]);
  });

  test('rejects a log containing an action the simulation would refuse', () => {
    expect(replayRun(LOADOUT, SEED, LOOK, [ActionCode.Descend])).toBeNull();
    expect(replayRun(LOADOUT, SEED, LOOK, [ActionCode.Attack])).toBeNull();
  });
});

describe('saved data', () => {
  test('stays far below the size cap even for the longest run the contract accepts', () => {
    const longest: SavedRun = { seed: 0xffff_ffff, loadout: { base: 1, weapon: 2, charm: 2, rank: 3 }, actions: Array(MAX_ACTIONS).fill(ActionCode.Retreat) };
    const run = newRun(longest.loadout, longest.seed, LOOK);
    run.actions = longest.actions;
    expect(serializeSavedRun(run).length).toBeLessThan(MAX_SAVED_BYTES);
    expect(parseSavedRun(serializeSavedRun(run))).not.toBeNull();
  });

  test('is refused above the size cap, past the action cap, or with unknown action codes', () => {
    const good = JSON.parse(serializeSavedRun(played(SEED, MID_RUN_ACTIONS))) as Record<string, unknown>;
    expect(parseSavedRun(JSON.stringify({ ...good, actions: '0'.repeat(MAX_ACTIONS + 1) }))).toBeNull();
    expect(parseSavedRun(JSON.stringify({ ...good, actions: '0189' }))).toBeNull();
    expect(parseSavedRun(JSON.stringify({ ...good, padding: 'x'.repeat(MAX_SAVED_BYTES) }))).toBeNull();
  });

  test('is refused when malformed, from another format, or describing an impossible delver', () => {
    const good = JSON.parse(serializeSavedRun(played(SEED, MID_RUN_ACTIONS))) as Record<string, unknown>;
    expect(parseSavedRun('not json')).toBeNull();
    expect(parseSavedRun('null')).toBeNull();
    expect(parseSavedRun(JSON.stringify({ ...good, v: 2 }))).toBeNull();
    expect(parseSavedRun(JSON.stringify({ ...good, seed: -1 }))).toBeNull();
    expect(parseSavedRun(JSON.stringify({ ...good, seed: 2 ** 32 }))).toBeNull();
    expect(parseSavedRun(JSON.stringify({ ...good, seed: 1.5 }))).toBeNull();
    expect(parseSavedRun(JSON.stringify({ ...good, base: 9 }))).toBeNull();
    expect(parseSavedRun(JSON.stringify({ ...good, rank: 4 }))).toBeNull();
    expect(parseSavedRun(JSON.stringify({ ...good, actions: 12 }))).toBeNull();
  });

  test('round trips through storage and can be cleared', () => {
    const live = played(SEED, MID_RUN_ACTIONS);
    saveRun(live);
    expect(loadSavedRun()).toEqual({ seed: SEED, loadout: LOADOUT, actions: live.actions });
    clearSavedRun();
    expect(loadSavedRun()).toBeNull();
  });

  test('is simply absent when storage is unavailable', () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => saveRun(played(SEED, 5))).not.toThrow();
    expect(loadSavedRun()).toBeNull();
    expect(() => clearSavedRun()).not.toThrow();
  });
});

describe('deciding what to do with a saved run', () => {
  test('continues a run the contract still holds open', () => {
    const live = played(SEED, MID_RUN_ACTIONS);
    const plan = planResume(loadAfterSave(live), ticketFor(live));
    expect(plan.kind).toBe('continue');
    if (plan.kind === 'continue') expect(snapshot(plan.run)).toEqual(snapshot(live));
  });

  test('submits the log of a run that had already been won when the tab closed', () => {
    const won = played(winningSeed(), Infinity);
    expect(won.resultKind).toBe('extracted');
    const plan = planResume(loadAfterSave(won), ticketFor(won));
    expect(plan.kind).toBe('submit');
    if (plan.kind === 'submit') {
      expect(plan.run.resultKind).toBe('extracted');
      expect(plan.run.actions).toEqual(won.actions);
      expect(plan.run.scoreThisRun).toBe(won.scoreThisRun);
    }
  });

  test('also submits a run that ended in a defeat, so the contract can record it', () => {
    let seed = 1;
    while (played(seed, Infinity).resultKind !== 'dead') seed += 1;
    const lost = played(seed, Infinity);
    expect(planResume(loadAfterSave(lost), ticketFor(lost)).kind).toBe('submit');
  });

  test('discards a saved run when the contract holds no open run', () => {
    expect(planResume(loadAfterSave(played(SEED, MID_RUN_ACTIONS)), null).kind).toBe('discard');
  });

  test('discards a saved run for another seed', () => {
    const live = played(SEED, MID_RUN_ACTIONS);
    expect(planResume(loadAfterSave(live), { ...ticketFor(live), seed: SEED + 1 }).kind).toBe('discard');
  });

  test('discards a saved run for another delver', () => {
    const live = played(SEED, MID_RUN_ACTIONS);
    const ticket = ticketFor(live);
    for (const other of [{ base: 0 }, { weapon: 1 }, { charm: 0 }, { rank: 2 }]) {
      expect(planResume(loadAfterSave(live), { ...ticket, ...other }).kind).toBe('discard');
    }
  });

  test('discards when there is nothing saved', () => {
    expect(planResume(null, { seed: SEED, ...LOADOUT, look: LOOK }).kind).toBe('discard');
  });
});

function loadAfterSave(run: RunState): SavedRun | null {
  saveRun(run);
  return loadSavedRun();
}
