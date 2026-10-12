import { dotDiagram } from '../diagram';
import { cluster, edge, graph, node } from '../style';

export default dotDiagram(
  {
    name: '01-system-context',
    title: 'Deepmark system context',
    description:
      'The browser game plays every run locally and talks to the Stellar testnet only to start and finish a run. The Deepmark contract replays the run and mints relics through three Stellar Asset Contracts whose issuer account is locked.',
  },
  () =>
    graph('LR', [
      cluster('browser', 'Browser (untrusted)', 'client', [
        node({ id: 'game', title: 'Canvas game', lines: ['render, audio, input', 'never waits on a transaction'], zone: 'client' }),
        node({ id: 'sim', title: 'Simulation and action log', lines: ['TypeScript, client/src/game', 'seeded, one byte per action'], zone: 'client' }),
        node({ id: 'key', title: 'Keypair', lines: ['generated in the browser', 'kept in localStorage'], zone: 'client' }),
        '{ rank=same; game; sim; key; }',
        'game -> sim -> key [style=invis];',
      ]),
      cluster('services', 'Stellar testnet services', 'network', [
        node({ id: 'friendbot', title: 'Friendbot', lines: ['funds a new account once'], zone: 'network' }),
        node({ id: 'rpc', title: 'Soroban RPC', lines: ['submits transactions', 'simulates and reads'], zone: 'network' }),
        node({ id: 'horizon', title: 'Horizon', lines: ['relic balances (read only)'], zone: 'network' }),
        '{ rank=same; friendbot; rpc; horizon; }',
        'horizon -> rpc -> friendbot [style=invis];',
      ]),
      cluster('chain', 'On chain', 'contract', [
        node({ id: 'contract', title: 'Deepmark contract', lines: ['start_run, finish_run, verify_run', 'replays every run itself', 'profiles, leaderboards, delvers'], zone: 'contract' }),
        node({ id: 'sac', title: 'Relic SACs', lines: ['DMCOMMON, DMRARE, DMCORE', 'admin: the Deepmark contract'], zone: 'asset' }),
        node({ id: 'issuer', title: 'Issuer account', lines: ['locked: master weight 0', 'no other signer, nobody can mint'], zone: 'asset' }),
        '{ rank=same; sac; issuer; }',
      ]),
      edge({ from: 'key', to: 'friendbot', text: 'fund once', zone: 'network' }),
      edge({ from: 'sim', to: 'rpc', text: 'start_run, then\nfinish_run(actions)', zone: 'client' }),
      edge({ from: 'horizon', to: 'game', text: 'balances', zone: 'network', dashed: true, extra: 'constraint=false' }),
      edge({ from: 'rpc', to: 'contract', text: 'invoke', zone: 'network' }),
      edge({ from: 'contract', to: 'sac', text: 'try_mint after a\nverified extraction', zone: 'contract' }),
      edge({ from: 'sac', to: 'issuer', text: 'assets issued by', zone: 'asset', dashed: true }),
    ]),
);
