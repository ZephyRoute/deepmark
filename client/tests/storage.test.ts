import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { readItem, readJson, removeItem, writeItem, writeJson } from '../src/storage';
import { installMemoryStorage } from './storage';

function installBrokenStorage(): void {
  const fail = (): never => {
    throw new Error('storage blocked');
  };
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: fail, setItem: fail, removeItem: fail };
}

describe('safe storage with working storage', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installMemoryStorage();
  });

  test('writes and reads raw strings', () => {
    expect(writeItem('k', 'v')).toBe(true);
    expect(readItem('k')).toBe('v');
    expect(store.get('k')).toBe('v');
  });

  test('a missing key reads as null', () => {
    expect(readItem('absent')).toBeNull();
    expect(readJson('absent')).toBeNull();
  });

  test('round trips JSON', () => {
    expect(writeJson('j', { a: 1, b: [2, 3] })).toBe(true);
    expect(readJson('j')).toEqual({ a: 1, b: [2, 3] });
  });

  test('corrupt JSON reads as null instead of throwing', () => {
    store.set('bad', '{not json');
    expect(readJson('bad')).toBeNull();
  });

  test('removes a key', () => {
    writeItem('k', 'v');
    expect(removeItem('k')).toBe(true);
    expect(readItem('k')).toBeNull();
  });
});

describe('safe storage when storage throws', () => {
  beforeEach(installBrokenStorage);
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  test('reads give null and writes report failure', () => {
    expect(readItem('k')).toBeNull();
    expect(readJson('k')).toBeNull();
    expect(writeItem('k', 'v')).toBe(false);
    expect(writeJson('k', { a: 1 })).toBe(false);
    expect(removeItem('k')).toBe(false);
  });

  test('a missing storage object is handled the same way', () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(readItem('k')).toBeNull();
    expect(writeItem('k', 'v')).toBe(false);
  });
});
