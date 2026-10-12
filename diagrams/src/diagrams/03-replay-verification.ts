import { dotDiagram } from '../diagram';
import { cluster, edge, graph, node } from '../style';

export default dotDiagram(
  {
    name: '03-replay-verification',
    title: 'Replay verification and trust model',
    description:
      'The contract never trusts a claimed result. It takes the issued run ticket and the action log, rejects malformed logs, replays the run with a Rust port of the TypeScript game and derives the result itself. 600 golden vectors played by the TypeScript game keep the two implementations identical in cargo test.',
  },
  () =>
    graph('TB', [
      cluster('inputs', 'Inputs', 'client', [
        node({ id: 'ticket', title: 'Run ticket', lines: ['issued by start_run', 'seed, base, weapon, charm, rank'], zone: 'contract' }),
        node({ id: 'actions', title: 'Action log', lines: ['sent by the client', 'one byte per action, at most 2048'], zone: 'client' }),
        '{ rank=same; ticket; actions; }',
      ]),
      cluster('replay', 'finish_run on chain', 'contract', [
        node({ id: 'guards', title: 'Guards', lines: ['player signed, open run exists', 'TooFast: at least actions / 16 ledgers since start', 'veteran still owned by the player'], zone: 'contract' }),
        node({ id: 'replay', title: 'sim::replay', lines: ['Mulberry32 rng, three fixed floors,', 'enemies and delver stats (Rust port)', 'applies the actions one by one'], zone: 'contract' }),
        node({ id: 'checks', title: 'Log checks', lines: ['InvalidAction: unknown byte', 'RunIncomplete: log ends before extraction or death', 'TrailingActions: actions after the end'], zone: 'contract' }),
        node({ id: 'result', title: 'Derived result', lines: ['floor, score, relics, HP left, rank key', 'nothing is read from the client'], zone: 'ok', shape: 'box' }),
      ]),
      cluster('lane', 'Keeping Rust and TypeScript identical', 'client', [
        node({ id: 'ts', title: 'TypeScript game', lines: ['client/src/game'], zone: 'client' }),
        node({ id: 'golden', title: '600 golden vectors', lines: ['bun run golden', 'tests/golden.txt'], zone: 'client' }),
        node({ id: 'cargo', title: 'cargo test', lines: ['replays every vector in Rust', 'any mismatch fails the build'], zone: 'contract' }),
      ]),
      node({ id: 'verify', title: 'verify_run', lines: ['same replay, no writes', 'anyone can audit a run:', 'delver, seed from run_started, log'], zone: 'network' }),
      node({ id: 'rejected', title: 'Rejected', lines: ['the transaction fails with a contract error', 'nothing is written, the open run is kept'], zone: 'danger' }),
      node({ id: 'legit', title: 'Legitimate run', lines: ['consumes the open run (no second claim)', 'profile, leaderboard, delver, relics'], zone: 'ok' }),
      edge({ from: 'ticket', to: 'guards' }),
      edge({ from: 'actions', to: 'guards' }),
      edge({ from: 'guards', to: 'replay' }),
      edge({ from: 'replay', to: 'checks' }),
      edge({ from: 'checks', to: 'result' }),
      edge({ from: 'result', to: 'legit', zone: 'ok' }),
      edge({ from: 'checks', to: 'rejected', text: 'any guard or check fails', zone: 'danger', dashed: true, extra: 'constraint=false' }),
      edge({ from: 'replay', to: 'verify', text: 'same code', zone: 'network', dashed: true }),
      edge({ from: 'ts', to: 'golden', text: 'plays', zone: 'client' }),
      edge({ from: 'golden', to: 'cargo', zone: 'client' }),
      edge({ from: 'cargo', to: 'replay', text: 'proves it\nmatches', zone: 'contract', dashed: true, extra: 'constraint=false' }),
    ]),
);
