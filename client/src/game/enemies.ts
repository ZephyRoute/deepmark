export type EnemyKind = 'warden' | 'skitter' | 'adept' | 'wardenPrime';

export interface EnemyArchetype {
  kind: EnemyKind;
  name: string;
  maxHp: number;
  dmgMin: number;
  dmgMax: number;
  color: string;
  size: number;
  shape: 'square' | 'triangle';
  isBoss: boolean;
}

export const ENEMIES: Record<EnemyKind, EnemyArchetype> = {
  warden: {
    kind: 'warden',
    name: 'Warden',
    maxHp: 6,
    dmgMin: 1,
    dmgMax: 3,
    color: '#ef5350',
    size: 40,
    shape: 'square',
    isBoss: false,
  },
  skitter: {
    kind: 'skitter',
    name: 'Skitter',
    maxHp: 4,
    dmgMin: 1,
    dmgMax: 2,
    color: '#ab47bc',
    size: 30,
    shape: 'triangle',
    isBoss: false,
  },
  adept: {
    kind: 'adept',
    name: 'Adept',
    maxHp: 9,
    dmgMin: 2,
    dmgMax: 4,
    color: '#d84315',
    size: 42,
    shape: 'square',
    isBoss: false,
  },
  wardenPrime: {
    kind: 'wardenPrime',
    name: 'Warden Prime',
    maxHp: 16,
    dmgMin: 3,
    dmgMax: 5,
    color: '#7e57c2',
    size: 56,
    shape: 'square',
    isBoss: true,
  },
};
