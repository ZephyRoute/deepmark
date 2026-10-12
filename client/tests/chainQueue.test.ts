import { describe, expect, test } from 'bun:test';
import { ChainQueue, sleep, withTimeout } from '../src/app/chainQueue';
import { describeFailure, type FailureKind, failureKind, isPermanentFailure, keepsRun, SettlementUnconfirmed } from '../src/app/failures';
import { CONTRACT_ERROR } from '../src/stellar/choice';

const contractError = (code: number): Error => new Error(`HostError: Error(Contract, #${code})`);

describe('ChainQueue', () => {
  test('runs jobs one at a time, in order', async () => {
    const queue = new ChainQueue();
    const log: string[] = [];
    const job = (name: string, ms: number) => async () => {
      log.push(`${name}:start`);
      await sleep(ms);
      log.push(`${name}:end`);
      return name;
    };
    const results = await Promise.all([queue.enqueue(job('a', 20)), queue.enqueue(job('b', 1)), queue.enqueue(job('c', 1))]);
    expect(results).toEqual(['a', 'b', 'c']);
    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
  });

  test('a job holds the queue through its whole retry loop, sleeps included', async () => {
    const queue = new ChainQueue();
    const log: string[] = [];
    const finishRun = queue.enqueue(async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        log.push(`finish:${attempt}`);
        await sleep(5);
      }
    });
    const startRun = queue.enqueue(async () => {
      log.push('start');
    });
    await Promise.all([finishRun, startRun]);
    expect(log).toEqual(['finish:0', 'finish:1', 'finish:2', 'start']);
  });

  test('a failed job rejects its own caller but does not block the next one', async () => {
    const queue = new ChainQueue();
    const failing = queue.enqueue(async () => {
      throw new Error('boom');
    });
    const next = queue.enqueue(async () => 'ok');
    await expect(failing).rejects.toThrow('boom');
    expect(await next).toBe('ok');
  });
});

describe('withTimeout', () => {
  test('passes through a value that arrives in time', async () => {
    expect(await withTimeout(Promise.resolve(7), 50)).toBe(7);
  });

  test('passes through the original rejection', async () => {
    await expect(withTimeout(Promise.reject(new Error('nope')), 50)).rejects.toThrow('nope');
  });

  test('rejects when the promise is too slow', async () => {
    await expect(withTimeout(sleep(100), 5)).rejects.toThrow('Timed out');
  });
});

describe('failure classification', () => {
  test('contract refusals are permanent, except TooFast which heals by waiting', () => {
    expect(isPermanentFailure(contractError(CONTRACT_ERROR.RunNotStarted))).toBe(true);
    expect(isPermanentFailure(contractError(CONTRACT_ERROR.InvalidAction))).toBe(true);
    expect(isPermanentFailure(contractError(CONTRACT_ERROR.TooFast))).toBe(false);
  });

  test('network trouble and non errors are not permanent', () => {
    expect(isPermanentFailure(new Error('fetch failed'))).toBe(false);
    expect(isPermanentFailure('Error(Contract, #2)')).toBe(false);
  });

  test('each refusal gets its own sentence, anything else says Stellar was unreachable', () => {
    expect(describeFailure(contractError(CONTRACT_ERROR.RunNotStarted))).toContain('no longer open');
    expect(describeFailure(contractError(CONTRACT_ERROR.NotHeroOwner))).toContain('changed hands');
    expect(describeFailure(contractError(CONTRACT_ERROR.TrailingActions))).toContain('could not reproduce');
    expect(describeFailure(new Error('timeout'))).toContain('could not be reached');
  });
});

describe('failure kinds, one per contract code', () => {
  const expected: Record<number, FailureKind> = {
    1: 'permanent',
    2: 'closed',
    3: 'permanent',
    4: 'permanent',
    5: 'permanent',
    6: 'permanent',
    7: 'wait',
    8: 'permanent',
    9: 'permanent',
    10: 'permanent',
    11: 'permanent',
    12: 'permanent',
    13: 'notReady',
    14: 'mint',
  };
  for (const [code, kind] of Object.entries(expected)) {
    test(`code ${code} is ${kind}`, () => {
      expect(failureKind(contractError(Number(code)))).toBe(kind);
    });
  }

  test('a rejected mint keeps the run and can be retried', () => {
    const err = contractError(CONTRACT_ERROR.MintFailed);
    expect(isPermanentFailure(err)).toBe(false);
    expect(keepsRun(err)).toBe(true);
    expect(describeFailure(err)).toContain('relics could not be delivered');
  });

  test('an uninitialised contract keeps the run and says so', () => {
    const err = contractError(CONTRACT_ERROR.NotInitialized);
    expect(isPermanentFailure(err)).toBe(false);
    expect(keepsRun(err)).toBe(true);
    expect(describeFailure(err)).toContain('not ready');
  });

  test('a refusal that cannot heal drops the run', () => {
    expect(keepsRun(contractError(CONTRACT_ERROR.InvalidAction))).toBe(false);
    expect(keepsRun(contractError(CONTRACT_ERROR.RunNotStarted))).toBe(false);
  });

  test('an unconfirmed settlement is retryable and honest', () => {
    const err = new SettlementUnconfirmed();
    expect(failureKind(err)).toBe('wait');
    expect(keepsRun(err)).toBe(true);
    expect(describeFailure(err)).toContain('may already be recorded');
  });
});
