import { describe, expect, test } from 'bun:test';
import { isRetryableTxFailure, readSentResult, TxOutcomeError, type SentLike } from '../src/stellar/txOutcome';

/** Mimics the SDK, whose `result` getter parses `returnValue` without checking it. */
function sentWith(response: SentLike<string>['getTransactionResponse']): SentLike<string> {
  return {
    getTransactionResponse: response,
    get result(): string {
      if (response && 'returnValue' in response) {
        const value = response.returnValue as { type: string };
        return value.type; // throws "Cannot read properties of undefined (reading 'type')"
      }
      throw new Error('no result');
    },
  };
}

describe('readSentResult', () => {
  test('returns the parsed result of a successful transaction', () => {
    expect(readSentResult(sentWith({ status: 'SUCCESS', returnValue: { type: 'scvVec' } }))).toBe('scvVec');
  });

  test('a failed transaction with an undefined return value is a retryable typed error, not a TypeError', () => {
    const sent = sentWith({ status: 'FAILED', returnValue: undefined });
    expect(() => sent.result).toThrow(TypeError);
    let caught: unknown;
    try {
      readSentResult(sent);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(TxOutcomeError);
    expect(isRetryableTxFailure(caught)).toBe(true);
  });

  test('a success without a return value is a typed error that is not retried', () => {
    let caught: unknown;
    try {
      readSentResult(sentWith({ status: 'SUCCESS', returnValue: undefined }));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(TxOutcomeError);
    expect(isRetryableTxFailure(caught)).toBe(false);
  });

  test('other errors are never retryable', () => {
    expect(isRetryableTxFailure(new Error('boom'))).toBe(false);
    expect(isRetryableTxFailure(undefined)).toBe(false);
  });
});
