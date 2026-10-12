export const STELLAR_CONFIG = {
  networkPassphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  friendbotUrl: 'https://friendbot.stellar.org',
  explorerUrl: 'https://stellar.expert/explorer/testnet',
  contractId: 'CDQDI2SNKQHPC7YW7YCW7USYLHXW2XTV5JBXWC24K53KDMY43DBHH7RX',
};

export type RelicKind = 'common' | 'rare' | 'core';

/**
 * The three relic assets. Each is a classic Stellar asset wrapped by a Stellar
 * Asset Contract whose admin is the game contract. The issuer account is locked
 * (master weight zero, no other signer), so only a verified extraction can
 * mint one. Verified on Horizon when this deployment was made.
 */
export const RELIC_ASSETS: Record<RelicKind, { code: string; contractId: string }> = {
  common: { code: 'DMCOMMON', contractId: 'CDK5SL4OP6CAFZPFJ2YOTSBN3NDHCJ4A23UA4TXIZP5DFO7RT6IH4S5R' },
  rare: { code: 'DMRARE', contractId: 'CCQFEYZR3D4XHTMLV3XJZBTZUT4WXZS2LUXHPFTH7DRRZENZNU2NVZ5L' },
  core: { code: 'DMCORE', contractId: 'CAHKK75BOXGBKSXBB3EFPWS6C3IZIXIFLYI3A74GYCRSI4U6NKVZTLIM' },
};

export const RELIC_ISSUER = 'GAEZFWDURKH2UF5DF5S26AXHLTUE4NNQ4YDDROFRXNTDO46THSXJFA7Q';

/** Classic assets carry seven decimals. The contract mints whole relics. */
export const RELIC_UNIT = 10_000_000n;
