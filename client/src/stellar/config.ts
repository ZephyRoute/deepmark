import { Networks } from '@stellar/stellar-sdk';

export const STELLAR_CONFIG = {
  networkPassphrase: Networks.TESTNET,
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  friendbotUrl: 'https://friendbot.stellar.org',
  explorerUrl: 'https://stellar.expert/explorer/testnet',
  contractId: 'CBOYTAF2YADTF2FKHKMJHQCZW7EXHBQLCMLBX6FHMOE2WOQH5T3VQCCW',
};

export type RelicKind = 'common' | 'rare' | 'core';

/**
 * The three relic assets. Each is a classic Stellar asset wrapped by a Stellar
 * Asset Contract whose admin is the game contract, and the issuer is locked,
 * so only a verified extraction can mint one.
 */
export const RELIC_ASSETS: Record<RelicKind, { code: string; contractId: string }> = {
  common: { code: 'DMCOMMON', contractId: 'CBDQJOTRLE4VFJK253NN362AOTHL4N2I2ASFQ3MJJPC7HW2MTP4Z464L' },
  rare: { code: 'DMRARE', contractId: 'CD4IXDUY6AQX5BUR35WXDSRXZ52DGPWMRMMNWZX24POEJRFJNZBNS7MW' },
  core: { code: 'DMCORE', contractId: 'CCQ3MHOF7O6LDTSHYTSM6OJ6NBRSVQNJHGFZE22PN3B7JZX2QQ5VZP4M' },
};

export const RELIC_ISSUER = 'GCNNXQUEEOMU6K2I3MR7J3YVDWQSLSAPHX23BDMNPZHFJAJ4AUDYJBJ6';

/** Classic assets carry seven decimals. The contract mints whole relics. */
export const RELIC_UNIT = 10_000_000n;
