import { dotDiagram } from '../diagram';
import { cluster, edge, graph, node } from '../style';

export default dotDiagram(
  {
    name: '05-client-architecture',
    title: 'Client architecture',
    description:
      'The TypeScript client has a game layer with the deterministic simulation, a render and audio layer, an input layer and a stellar layer. render and stellar depend on game and game imports from neither. The Stellar SDK chunk loads lazily when the browser is idle. A separate stats page reads the chain.',
  },
  () =>
    graph('TB', [
      node({ id: 'entry', title: 'main.ts and game-app.ts', lines: ['wires input, game, render and stellar', 'one game loop, no router'], zone: 'client' }),
      node({ id: 'input', title: 'input/', lines: ['keyboard.ts: keys to actions'], zone: 'client' }),
      node({ id: 'render', title: 'render/', lines: ['canvas, camera, particles, motion', 'title, creator, descent, result', 'audio.ts: sound'], zone: 'client' }),
      node({ id: 'game', title: 'game/ (the simulation)', lines: ['state, combat, floor, enemies, heroes, items', 'rng.ts: Mulberry32, mirrored in Rust', 'progress, savedRun, draft: localStorage', 'imports nothing from render, input or stellar'], zone: 'contract' }),
      cluster('chain', 'client/src/stellar', 'asset', [
        node({ id: 'lazy', title: 'lazy.ts', lines: ['loads the SDK chunk when idle', 'the title paints without it'], zone: 'asset' }),
        node({ id: 'sdk', title: 'api.ts: account.ts, contract.ts', lines: ['keypair in localStorage, Friendbot, trustlines', 'start_run, finish_run and reads through RPC', 'the lazily loaded Stellar SDK chunk'], zone: 'asset' }),
        node({ id: 'traction', title: 'traction.ts', lines: ['reads contract events and players'], zone: 'asset' }),
        node({ id: 'cfg', title: 'config.ts and relics.ts', lines: ['network urls, contract and relic ids', 'relic balances from Horizon'], zone: 'asset' }),
      ]),
      node({ id: 'stats', title: 'stats/ (second page)', lines: ['traction page, separate entry'], zone: 'network' }),
      edge({ from: 'entry', to: 'input', zone: 'client' }),
      edge({ from: 'entry', to: 'render', zone: 'client' }),
      edge({ from: 'entry', to: 'lazy', text: 'warms when idle', zone: 'asset' }),
      edge({ from: 'render', to: 'game', text: 'draws state', zone: 'contract' }),
      edge({ from: 'entry', to: 'game', text: 'applies actions', zone: 'contract', extra: 'constraint=false' }),
      edge({ from: 'lazy', to: 'sdk', text: 'dynamic import', zone: 'asset' }),
      edge({ from: 'sdk', to: 'cfg', zone: 'asset' }),
      edge({ from: 'traction', to: 'cfg', zone: 'asset' }),
      edge({ from: 'stats', to: 'traction', zone: 'network' }),
      edge({ from: 'render', to: 'cfg', text: 'ids and types only', zone: 'asset', dashed: true, extra: 'constraint=false' }),
    ]),
);
