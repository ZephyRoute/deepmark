import { beforeEach, describe, expect, test } from 'bun:test';
import { Keypair } from '@stellar/stellar-sdk';
import { getRecoveryCode, isRecoveryCode, recoveryCodeAddress, restoreRecoveryCode } from '../src/stellar/account';
import { installMemoryStorage } from './storage';

describe('recovery code', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  test('accepts a real secret seed and rejects other text', () => {
    expect(isRecoveryCode(Keypair.random().secret())).toBe(true);
    expect(isRecoveryCode(Keypair.random().publicKey())).toBe(false);
    expect(isRecoveryCode('not a code')).toBe(false);
  });

  test('restoring stores the code and rejects invalid input', () => {
    const code = Keypair.random().secret();
    restoreRecoveryCode(`  ${code}\n`);
    expect(getRecoveryCode()).toBe(code);
    expect(() => restoreRecoveryCode('nope')).toThrow();
  });

  test('a rejected code leaves the current account untouched', () => {
    const current = Keypair.random().secret();
    restoreRecoveryCode(current);
    for (const bad of ['', '   ', 'nope', Keypair.random().publicKey(), `${current}x`, current.slice(1)]) {
      expect(() => restoreRecoveryCode(bad)).toThrow();
    }
    expect(getRecoveryCode()).toBe(current);
  });

  test('the shown address matches the code and never contains the secret', () => {
    const pair = Keypair.random();
    const address = recoveryCodeAddress(` ${pair.secret()} `);
    expect(address).toBe(pair.publicKey());
    expect(address).not.toContain(pair.secret());
    expect(() => recoveryCodeAddress('nope')).toThrow();
  });
});
