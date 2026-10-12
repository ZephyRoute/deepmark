export const STELLAR_CONFIG = {
  networkPassphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  friendbotUrl: 'https://friendbot.stellar.org',
  explorerUrl: 'https://stellar.expert/explorer/testnet',
  contractId: 'CDEAFSBG7JBN6XMP4HRL7LFBL7L67K4RJK3CIRBV23W3TJQCEADZ7R6N',
};

export type RelicKind = 'common' | 'rare' | 'core';

/**
 * The three relic assets. Each is a classic Stellar asset wrapped by a Stellar
 * Asset Contract whose admin is the game contract. The issuer account is locked
 * (master weight zero, no other signer), so only a verified extraction can
 * mint one. Verified on Horizon when this deployment was made.
 */
export const RELIC_ASSETS: Record<RelicKind, { code: string; contractId: string }> = {
  common: { code: 'DMCOMMON', contractId: 'CAAFYL2QZU274NLA2IFDB4L6SUNVQKT6OLB6UXGL5L5LMQCFJXSUYFO3' },
  rare: { code: 'DMRARE', contractId: 'CC4RQ4HLTPTXMCZ3OKDL546XXJGOQ5PI2ET6U33C2XTO4BTS6AJV4ANA' },
  core: { code: 'DMCORE', contractId: 'CC27JVKNDSUM5FDGP4JZDZTKGHJ5RJV7XHJGITTUGOUFE4DVPN6PGLMI' },
};

export const RELIC_ISSUER = 'GAD752QFRTNEMQW2SELGHQ5VAMIV3O7H4XRLJN2K2TQFGGXKNFG7CQUK';

/** Classic assets carry seven decimals. The contract mints whole relics. */
export const RELIC_UNIT = 10_000_000n;
