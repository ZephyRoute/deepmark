import { describe, expect, test } from 'bun:test';
import { raceSkip, SKIPPED, SkipGate } from '../src/app/skipGate';
import { ChainQueue } from '../src/app/chainQueue';
import { waitState } from '../src/render/descentWait';
import { SKIP_OFFER_AFTER_MS, SLOW_NOTE_AFTER_MS } from '../src/constants';

describe('waitState', () => {
  test('stays quiet at first, then says it is slow, then offers the practice run', () => {
    expect(waitState(1000, 'account')).toEqual({ slow: false, canSkip: false });
    expect(waitState(SLOW_NOTE_AFTER_MS, 'opening')).toEqual({ slow: true, canSkip: false });
    expect(waitState(SKIP_OFFER_AFTER_MS, 'opening')).toEqual({ slow: true, canSkip: true });
  });

  test('never offers a skip once the stairs are open or the practice notice shows', () => {
    expect(waitState(60_000, 'ready')).toEqual({ slow: false, canSkip: false });
    expect(waitState(60_000, 'offline')).toEqual({ slow: false, canSkip: false });
  });
});

describe('SkipGate', () => {
  test('a skip wins over a slow chain job and its late result is ignored', async () => {
    const gate = new SkipGate();
    let finish: (value: string) => void = () => undefined;
    const job = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const raced = raceSkip(job, gate);
    gate.skip();
    expect(await raced).toBe(SKIPPED);
    expect(gate.skipped).toBe(true);
    expect(gate.closed).toBe(true);
    finish('late ticket');
    expect(await job).toBe('late ticket');
  });

  test('a job that finishes first wins, and a later skip changes nothing', async () => {
    const gate = new SkipGate();
    expect(await raceSkip(Promise.resolve('ticket'), gate)).toBe('ticket');
    gate.close();
    gate.skip();
    expect(gate.skipped).toBe(false);
  });

  test('a skipped wait leaves the chain queue ordered: the next job runs after the late one', async () => {
    const queue = new ChainQueue();
    const order: string[] = [];
    let release: () => void = () => undefined;
    const gate = new SkipGate();
    const first = queue.enqueue(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      order.push('first');
      return 'first';
    });
    const raced = raceSkip(first, gate);
    gate.skip();
    expect(await raced).toBe(SKIPPED);
    const second = queue.enqueue(async () => {
      order.push('second');
    });
    release();
    await second;
    expect(order).toEqual(['first', 'second']);
  });

  test('a late failure after a skip is not an unhandled rejection', async () => {
    const gate = new SkipGate();
    let fail: (err: Error) => void = () => undefined;
    const job = new Promise<string>((_, reject) => {
      fail = reject;
    });
    const raced = raceSkip(job, gate);
    gate.skip();
    expect(await raced).toBe(SKIPPED);
    fail(new Error('late'));
    await expect(job).rejects.toThrow('late');
  });
});
