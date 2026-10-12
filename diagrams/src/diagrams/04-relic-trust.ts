import { dotDiagram } from '../diagram';
import { cluster, edge, graph, node } from '../style';

export default dotDiagram(
  {
    name: '04-relic-trust',
    title: 'Relic and delver minting and the trust model',
    description:
      'Only a replay verified run can mint. finish_run mints through three Stellar Asset Contracts whose admin is the Deepmark contract, and the issuer account is locked. If a mint is rejected, for example because the player has no trustline, finish_run fails with MintFailed and reverts, so the run stays open and can be finished again. A full clear by a fresh delver also earns an owned delver record. The one remaining trust assumption is the contract admin who can upgrade the code until the role is renounced or moved to a multisig.',
  },
  () =>
    graph('LR', [
      cluster('mint', 'Minting path (only inside finish_run)', 'contract', [
        node({ id: 'verified', title: 'Verified run', lines: ['replay accepted', 'open run consumed'], zone: 'ok' }),
        node({ id: 'relics', title: 'Banked relics', lines: ['only when the run extracted', 'counts come from the replay'], zone: 'contract' }),
        node({ id: 'hero', title: 'Delver earned', lines: ['fresh delver, extracted from floor 3', 'veteran: one more victory, rank up to 3', 'stored in the contract, not a standard NFT'], zone: 'contract' }),
      ]),
      cluster('assets', 'Relic assets', 'asset', [
        node({ id: 'sac', title: 'Three Stellar Asset Contracts', lines: ['DMCOMMON, DMRARE, DMCORE', 'admin: the Deepmark contract'], zone: 'asset' }),
        node({ id: 'issuer', title: 'Issuer account', lines: ['master weight 0, no other signer', 'nobody holds a key that can mint'], zone: 'asset' }),
      ]),
      node({ id: 'player', title: 'Player account', lines: ['holds relics through a trustline', 'no trustline: the mint fails,', 'finish_run reverts (MintFailed)', 'the run stays open to retry'], zone: 'client' }),
      cluster('control', 'Control plane', 'warn', [
        node({ id: 'admin', title: 'Contract admin (the deployer)', lines: ['upgrade, set_admin, renounce_admin', 'trust assumption: could ship code that skips the replay', 'planned: renounce or multisig before mainnet'], zone: 'warn' }),
        node({ id: 'frozen', title: 'Frozen', lines: ['admin() is None', 'upgrade and set_admin fail', 'the deployed code is final'], zone: 'ok' }),
      ]),
      edge({ from: 'verified', to: 'relics', text: 'extracted', zone: 'ok' }),
      edge({ from: 'verified', to: 'hero', text: 'full clear', zone: 'ok' }),
      edge({ from: 'relics', to: 'sac', text: 'mint\n(rejected: MintFailed,\nwhole finish reverts)', zone: 'contract' }),
      edge({ from: 'sac', to: 'player', text: 'one whole unit\nper relic', zone: 'asset' }),
      edge({ from: 'sac', to: 'issuer', text: 'issued by', zone: 'asset', dashed: true }),
      edge({ from: 'admin', to: 'frozen', text: 'renounce_admin', zone: 'ok' }),
    ]),
);
