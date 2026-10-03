import { Networks } from '@stellar/stellar-sdk';

export const STELLAR_CONFIG = {
  networkPassphrase: Networks.TESTNET,
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  friendbotUrl: 'https://friendbot.stellar.org',
  explorerUrl: 'https://stellar.expert/explorer/testnet',
  contractId: 'CDL7OO7MGCNMHZBF5QPJCMBLLY3ORR44TJ54ON44M25YUX6UZ7L46UZW',
};

export type RelicKind = 'common' | 'rare' | 'core';

/**
 * The three relic assets. Each is a classic Stellar asset wrapped by a Stellar
 * Asset Contract whose admin is the game contract, and the issuer is locked,
 * so only a verified extraction can mint one.
 */
export const RELIC_ASSETS: Record<RelicKind, { code: string; contractId: string }> = {
  common: { code: 'DMCOMMON', contractId: 'CCLLVBSEXPARVM6MP5HAXOSM3FGTUR3NHZSSRFRPNJSO4KWAPTMDZS7B' },
  rare: { code: 'DMRARE', contractId: 'CCMDNYSZMHBDV3XBSGSQ5QVSNCVYMAGGPF6SAK3QDARIBT246FFYOIBT' },
  core: { code: 'DMCORE', contractId: 'CDIYYZSMMSDXTTA5OA2C2QUJGMJRX4UP2UBR3QCUV44GJZTJBIS4BPDR' },
};

export const RELIC_ISSUER = 'GAH27KP7NDO7HSYGIUFT7O5ONGW7M6RKCXRXIHCTLWKBM2PNU6336YMP';

/** Classic assets carry seven decimals. The contract mints whole relics. */
export const RELIC_UNIT = 10_000_000n;
