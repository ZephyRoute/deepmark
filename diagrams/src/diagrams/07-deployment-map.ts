import { dotDiagram } from '../diagram';
import { edge, graph, node } from '../style';

export default dotDiagram(
  {
    name: '07-deployment-map',
    title: 'Deployment and verification map',
    description:
      'The testnet deployment: the Deepmark contract, three relic Stellar Asset Contracts that it administers, the issuer account that is locked, and the deployer admin account. Each node can be checked on the explorer or with the Stellar CLI.',
  },
  () =>
    graph('TB', [
      node({ id: 'admin', title: 'Deployer and admin account', lines: ['can upgrade until it renounces', 'check: admin() on the contract'], zone: 'warn' }),
      node({ id: 'game', title: 'Deepmark contract', lines: ['one instance on testnet', 'check: version(), relic_tokens(), admin()', 'check: wasm hash vs stellar contract fetch', 'instance and wasm TTL extended at deploy'], zone: 'contract' }),
      node({ id: 'events', title: 'Contract events', lines: ['run_started, run_finished, hero_earned', 'verify_run replays any run from them'], zone: 'ok' }),
      node({ id: 'common', title: 'DMCOMMON SAC', lines: ['admin: Deepmark contract'], zone: 'asset' }),
      node({ id: 'rare', title: 'DMRARE SAC', lines: ['admin: Deepmark contract'], zone: 'asset' }),
      node({ id: 'core', title: 'DMCORE SAC', lines: ['admin: Deepmark contract'], zone: 'asset' }),
      node({ id: 'issuer', title: 'Relic issuer account (locked)', lines: ['master weight 0, no other signer', 'its own key can no longer sign', 'check: the account on the explorer or Horizon'], zone: 'asset' }),
      '{ rank=same; common; rare; core; }',
      '{ rank=same; admin; events; }',
      edge({ from: 'admin', to: 'game', text: 'upgrade, set_admin,\nrenounce_admin', zone: 'warn', dashed: true }),
      edge({ from: 'game', to: 'events', text: 'emits', zone: 'ok' }),
      edge({ from: 'game', to: 'common', text: 'mint', zone: 'contract' }),
      edge({ from: 'game', to: 'rare', text: 'mint', zone: 'contract' }),
      edge({ from: 'game', to: 'core', text: 'mint', zone: 'contract' }),
      edge({ from: 'common', to: 'issuer', text: 'issued by', zone: 'asset', dashed: true }),
      edge({ from: 'rare', to: 'issuer', text: 'issued by', zone: 'asset', dashed: true }),
      edge({ from: 'core', to: 'issuer', text: 'issued by', zone: 'asset', dashed: true }),
    ]),
);
