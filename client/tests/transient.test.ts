import { describe, expect, test } from 'bun:test';
import { isTransientError, retryTransient } from '../src/stellar/transient';

const noWait = async (): Promise<void> => undefined;

describe('isTransientError', () => {
  test('recognises HTTP and network blips', () => {
    for (const status of [429, 500, 502, 503, 504]) {
      expect(isTransientError(new Error(`Request failed with status code ${status}`))).toBe(true);
      expect(isTransientError({ response: { status } })).toBe(true);
    }
    expect(isTransientError(new Error('Friendbot funding failed with status 503'))).toBe(true);
    expect(isTransientError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isTransientError(new Error('read ECONNRESET'))).toBe(true);
    expect(isTransientError(new Error('Timed out waiting for Stellar'))).toBe(true);
  });

  test('leaves real refusals alone', () => {
    expect(isTransientError({ response: { status: 400 } })).toBe(false);
    expect(isTransientError(new Error('HostError: Error(Contract, #8)'))).toBe(false);
    expect(isTransientError(new Error('Error(Contract, #504) refused'))).toBe(false);
    expect(isTransientError(new Error('The account was not found'))).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });
});

describe('retryTransient', () => {
  test('retries a transient failure and then succeeds', async () => {
    let calls = 0;
    const waits: number[] = [];
    const value = await retryTransient(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error('Request failed with status code 502');
        return 'ok';
      },
      { sleep: async (ms) => void waits.push(ms), random: () => 0.5, backoffMs: 100, jitterMs: 100 }
    );
    expect(value).toBe('ok');
    expect(calls).toBe(3);
    expect(waits).toEqual([150, 250]);
  });

  test('gives up after the retry budget', async () => {
    let calls = 0;
    const attempt = retryTransient(
      async () => {
        calls += 1;
        throw new Error('Request failed with status code 500');
      },
      { retries: 2, sleep: noWait }
    );
    await expect(attempt).rejects.toThrow('500');
    expect(calls).toBe(3);
  });

  test('does not retry a permanent error or once cancelled', async () => {
    let calls = 0;
    await expect(
      retryTransient(
        async () => {
          calls += 1;
          throw new Error('Error(Contract, #8)');
        },
        { sleep: noWait }
      )
    ).rejects.toThrow();
    expect(calls).toBe(1);
    calls = 0;
    await expect(
      retryTransient(
        async () => {
          calls += 1;
          throw new Error('Failed to fetch');
        },
        { sleep: noWait, cancelled: () => true }
      )
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });
});

describe('finish_run failures', () => {
  test('a transient send error is retried and keeps the saved run', async () => {
    const { failureKind, keepsRun } = await import('../src/app/failures');
    const blip = new Error('Request failed with status code 503');
    expect(failureKind(blip)).toBe('wait');
    expect(keepsRun(blip)).toBe(true);
  });
});
