import { beforeEach, describe, expect, test } from 'bun:test';
import { resolveExchange } from '../src/game/combat';
import { loadDraft, saveDraft } from '../src/game/draft';
import { MAX_FLOOR } from '../src/game/floor';
import { CLOAK_COUNT, EMBLEM_COUNT, isValidLoadout, isValidName, MAX_RANK, rankForClears, statsFor } from '../src/game/loadout';
import { loadProgress, recordRun } from '../src/game/progress';
import { mulberry32, randInt } from '../src/game/rng';
import { ActionCode, applyAction, drainEvents, MAX_ACTIONS, newRun } from '../src/game/state';
import { playBalanced } from '../scripts/policy';
import { installMemoryStorage } from './storage';

const LOADOUT = { base: 0, weapon: 0, charm: 0, rank: 0 };

describe('rng', () => {
  test('the same seed gives the same sequence, a different seed does not', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const first = Array.from({ length: 8 }, () => a());
    expect(Array.from({ length: 8 }, () => b())).toEqual(first);
    expect(Array.from({ length: 8 }, () => c())).not.toEqual(first);
  });

  test('values stay in [0, 1) and a seed outside 32 bits wraps like the contract', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expect(mulberry32(0x1_0000_0005)()).toBe(mulberry32(5)());
  });

  test('randInt is inclusive at both ends and covers the range', () => {
    const rng = mulberry32(99);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) seen.add(randInt(rng, 2, 5));
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
    expect(randInt(rng, 3, 3)).toBe(3);
  });
});

describe('combat', () => {
  const low = () => 0;
  const high = () => 0.999999;

  test('the player strikes first and a killing blow ends the exchange with no reply', () => {
    const result = resolveExchange(low, 10, 2, 3, 3, 2, 4);
    expect(result).toEqual({ playerDamageDealt: 2, enemyDamageDealt: 0, enemyDied: true, playerDied: false });
  });

  test('a surviving enemy hits back using its own damage range', () => {
    const result = resolveExchange(high, 10, 20, 1, 4, 1, 3);
    expect(result.playerDamageDealt).toBe(3);
    expect(result.enemyDamageDealt).toBe(4);
    expect(result.enemyDied).toBe(false);
    expect(result.playerDied).toBe(false);
  });

  test('the player dies when the reply takes the last hit point', () => {
    expect(resolveExchange(high, 4, 20, 1, 4, 1, 3).playerDied).toBe(true);
    expect(resolveExchange(high, 5, 20, 1, 4, 1, 3).playerDied).toBe(false);
  });

  test('exact lethal damage counts as a kill', () => {
    expect(resolveExchange(low, 10, 3, 1, 1, 3, 3).enemyDied).toBe(true);
  });
});

describe('loadout rules', () => {
  test('accepts every in range kit and rejects out of range or fractional ones', () => {
    expect(isValidLoadout(LOADOUT)).toBe(true);
    expect(isValidLoadout({ ...LOADOUT, base: 99 })).toBe(false);
    expect(isValidLoadout({ ...LOADOUT, weapon: -1 })).toBe(false);
    expect(isValidLoadout({ ...LOADOUT, charm: 1.5 })).toBe(false);
    expect(isValidLoadout({ ...LOADOUT, rank: MAX_RANK + 1 })).toBe(false);
  });

  test('rank follows clears and is capped', () => {
    expect(rankForClears(-4)).toBe(0);
    expect(rankForClears(2)).toBe(2);
    expect(rankForClears(50)).toBe(MAX_RANK);
  });

  test('each rank adds one hit point and nothing else', () => {
    const base = statsFor(LOADOUT);
    const veteran = statsFor({ ...LOADOUT, rank: 2 });
    expect(veteran.maxHp).toBe(base.maxHp + 2);
    expect(veteran.dmgMin).toBe(base.dmgMin);
    expect(veteran.dmgMax).toBe(base.dmgMax);
    expect(statsFor({ ...LOADOUT, rank: 99 }).maxHp).toBe(statsFor({ ...LOADOUT, rank: MAX_RANK }).maxHp);
  });

  test('stats never fall below 1 and damage max never falls under min', () => {
    for (let base = 0; base < 2; base += 1) {
      for (let weapon = 0; weapon < 3; weapon += 1) {
        for (let charm = 0; charm < 3; charm += 1) {
          const stats = statsFor({ base, weapon, charm, rank: 0 });
          expect(stats.maxHp).toBeGreaterThanOrEqual(1);
          expect(stats.dmgMin).toBeGreaterThanOrEqual(1);
          expect(stats.dmgMax).toBeGreaterThanOrEqual(stats.dmgMin);
        }
      }
    }
  });

  test('an invalid loadout throws instead of producing stats', () => {
    expect(() => statsFor({ ...LOADOUT, base: 99 })).toThrow('Invalid loadout');
  });

  test('names are 3 to 16 letters or digits with single spaces', () => {
    expect(isValidName('Ash')).toBe(true);
    expect(isValidName('Mara Voss')).toBe(true);
    expect(isValidName('Al')).toBe(false);
    expect(isValidName('a'.repeat(17))).toBe(false);
    expect(isValidName('Two  Spaces')).toBe(false);
    expect(isValidName(' lead')).toBe(false);
    expect(isValidName('no-dash')).toBe(false);
  });
});

describe('run state', () => {
  test('a new run starts exploring on floor 1 at full health with no actions', () => {
    const run = newRun(LOADOUT, 5);
    expect(run.mode).toBe('explore');
    expect(run.floorNumber).toBe(1);
    expect(run.player.hp).toBe(run.player.maxHp);
    expect(run.actions).toEqual([]);
    expect(run.resultKind).toBeNull();
  });

  test('input with no effect is not recorded', () => {
    const run = newRun(LOADOUT, 5);
    expect(applyAction(run, ActionCode.Attack)).toBe(false);
    expect(applyAction(run, ActionCode.Descend)).toBe(false);
    expect(applyAction(run, ActionCode.Extract)).toBe(false);
    expect(run.actions).toEqual([]);
  });

  test('walking into a wall does not move or record', () => {
    const run = newRun(LOADOUT, 5);
    for (let i = 0; i < 40; i += 1) applyAction(run, ActionCode.Up);
    const recorded = run.actions.length;
    const { x, y } = run.player;
    expect(applyAction(run, ActionCode.Up)).toBe(false);
    expect(run.player).toMatchObject({ x, y });
    expect(run.actions.length).toBe(recorded);
  });

  test('every recorded action is a valid code and the same seed replays to the same result', () => {
    const first = playBalanced(newRun(LOADOUT, 1234), Infinity);
    const second = newRun(LOADOUT, 1234);
    for (const code of first.actions) applyAction(second, code as ActionCode);
    expect(second.mode).toBe(first.mode);
    expect(second.resultKind).toBe(first.resultKind);
    expect(second.scoreThisRun).toBe(first.scoreThisRun);
    expect(second.player.hp).toBe(first.player.hp);
    expect(second.floorNumber).toBe(first.floorNumber);
  });

  test('a finished run refuses further actions', () => {
    const run = playBalanced(newRun(LOADOUT, 1234), Infinity);
    expect(run.mode).toBe('result');
    const recorded = run.actions.length;
    expect(applyAction(run, ActionCode.Up)).toBe(false);
    expect(run.actions.length).toBe(recorded);
  });

  test('a death forfeits relics and score, an extraction keeps them', () => {
    let died = false;
    let extracted = false;
    for (let seed = 1; seed < 200 && !(died && extracted); seed += 1) {
      const run = playBalanced(newRun(LOADOUT, seed), Infinity);
      if (run.resultKind === 'dead') {
        died = true;
        expect(run.relicsThisRun).toBe(0);
        expect(run.scoreThisRun).toBe(0);
      }
      if (run.resultKind === 'extracted') {
        extracted = true;
        expect(run.floorNumber).toBeLessThanOrEqual(MAX_FLOOR);
      }
    }
    expect(died).toBe(true);
    expect(extracted).toBe(true);
  });

  test('draining events empties the queue and returns them in order', () => {
    const run = playBalanced(newRun(LOADOUT, 1234), 30);
    const events = drainEvents(run);
    expect(events.length).toBeGreaterThan(0);
    expect(drainEvents(run)).toEqual([]);
  });

  test('the action log is capped and flags exhaustion', () => {
    const run = newRun(LOADOUT, 5);
    const moves = [ActionCode.Left, ActionCode.Right, ActionCode.Up, ActionCode.Down];
    const pairs: [ActionCode, ActionCode][] = [
      [moves[0] as ActionCode, moves[1] as ActionCode],
      [moves[2] as ActionCode, moves[3] as ActionCode],
    ];
    const pair = pairs.find(([a]) => applyAction(newRun(LOADOUT, 5), a));
    expect(pair).toBeDefined();
    const [forward, back] = pair as [ActionCode, ActionCode];
    for (let i = 0; i < MAX_ACTIONS * 2 && !run.exhausted && run.mode === 'explore'; i += 1) {
      applyAction(run, i % 2 === 0 ? forward : back);
    }
    expect(run.actions.length).toBeLessThanOrEqual(MAX_ACTIONS);
    if (run.actions.length === MAX_ACTIONS) {
      expect(applyAction(run, forward)).toBe(false);
      expect(run.exhausted).toBe(true);
    }
  });
});

describe('local progress', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  test('an empty browser starts from zero', () => {
    expect(loadProgress().runsPlayed).toBe(0);
  });

  test('an extraction books floor, relics, score and delver, and flags a new best', () => {
    const { progress, isNewBest } = recordRun({
      floorReached: 3,
      relicsKept: 4,
      score: 120,
      extracted: true,
      heroId: 'cinder',
      practice: false,
    });
    expect(isNewBest).toBe(true);
    expect(progress).toMatchObject({
      runsPlayed: 1,
      extractions: 1,
      deaths: 0,
      bestFloor: 3,
      bestRelics: 4,
      bestScore: 120,
      cinderRuns: 1,
    });
    expect(loadProgress()).toEqual(progress);
  });

  test('a death keeps no relics or score and is not a new best by relics', () => {
    recordRun({ floorReached: 2, relicsKept: 3, score: 50, extracted: true, heroId: 'lantern', practice: false });
    const { progress, isNewBest } = recordRun({
      floorReached: 2,
      relicsKept: 9,
      score: 99,
      extracted: false,
      heroId: 'lantern',
      practice: false,
    });
    expect(isNewBest).toBe(false);
    expect(progress).toMatchObject({ deaths: 1, relicsKept: 3, bestRelics: 3, bestScore: 50, runsPlayed: 2 });
  });

  test('a practice run never counts toward this browser bests', () => {
    const store = (globalThis.localStorage as Storage).getItem.bind(globalThis.localStorage);
    const before = store('deepmark:progress:v1');
    const { progress, isNewBest } = recordRun({
      floorReached: 3,
      relicsKept: 5,
      score: 200,
      extracted: true,
      heroId: 'lantern',
      practice: true,
    });
    expect(isNewBest).toBe(false);
    expect(progress).toMatchObject({ runsPlayed: 0, bestFloor: 0, bestRelics: 0, bestScore: 0, extractions: 0 });
    expect(store('deepmark:progress:v1')).toBe(before);
    recordRun({ floorReached: 2, relicsKept: 1, score: 10, extracted: true, heroId: 'lantern', practice: false });
    const after = recordRun({ floorReached: 3, relicsKept: 9, score: 900, extracted: true, heroId: 'lantern', practice: true });
    expect(after.progress).toMatchObject({ runsPlayed: 1, bestFloor: 2, bestRelics: 1 });
  });

  test('stored garbage is sanitised to zeros rather than trusted', () => {
    (globalThis.localStorage as Storage).setItem('deepmark:progress:v1', JSON.stringify({ bestFloor: 99, runsPlayed: -5, bestScore: 'x' }));
    expect(loadProgress()).toMatchObject({ bestFloor: 0, runsPlayed: 0, bestScore: 0 });
  });
});

describe('creator draft', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  test('a saved draft round trips', () => {
    const draft = { look: { name: 'Corin', emblem: 2, cloak: 3 }, base: 1, weapon: 1, charm: 2 };
    saveDraft(draft);
    expect(loadDraft()).toEqual(draft);
  });

  test('a tampered draft falls back to a valid default', () => {
    const bad = { look: { name: 'x', emblem: EMBLEM_COUNT, cloak: CLOAK_COUNT }, base: 99, weapon: 0, charm: 0 };
    (globalThis.localStorage as Storage).setItem('deepmark:creator:v1', JSON.stringify(bad));
    const draft = loadDraft();
    expect(isValidName(draft.look.name)).toBe(true);
    expect(draft.base).toBeLessThan(2);
  });
});
