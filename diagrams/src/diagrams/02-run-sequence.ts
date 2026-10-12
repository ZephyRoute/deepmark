import type { Diagram } from '../diagram';
import type { DiagramMeta } from '../style';
import { withAccessibility } from '../render';
import { renderSequence, type Lifeline, type Step } from '../sequence';

const LIFELINES: readonly Lifeline[] = [
  { id: 'player', title: 'Player', subtitle: 'in the browser', zone: 'client' },
  { id: 'client', title: 'Game client', subtitle: 'TypeScript, plays the run locally', zone: 'client' },
  { id: 'contract', title: 'Deepmark contract', subtitle: 'Soroban', zone: 'contract' },
  { id: 'sac', title: 'Relic SACs', subtitle: 'DMCOMMON, DMRARE, DMCORE', zone: 'asset' },
];

const STEPS: readonly Step[] = [
  { kind: 'phase', text: 'Transaction 1: start_run (while the descent animation plays)' },
  { kind: 'arrow', from: 'player', to: 'client', lines: ['forge a delver, press descend'] },
  { kind: 'arrow', from: 'client', to: 'contract', lines: ['start_run(player, choice)', 'player signs'], zone: 'contract' },
  { kind: 'note', over: ['contract'], lines: ['validate the delver', 'derive the seed on chain', 'store the open run'], zone: 'contract' },
  { kind: 'arrow', from: 'contract', to: 'client', lines: ['RunTicket (seed, delver)', 'event run_started'], zone: 'contract', dashed: true },
  { kind: 'phase', text: 'Play locally (no transaction, no waiting)' },
  { kind: 'arrow', from: 'player', to: 'client', lines: ['move, attack, retreat, descend, extract'] },
  { kind: 'note', over: ['player', 'client'], lines: ['simulation runs in the browser with the issued seed', 'one byte per action is appended to the action log', 'the result screen shows at once'], zone: 'client' },
  { kind: 'phase', text: 'Transaction 2: finish_run (after the result screen is showing)' },
  { kind: 'arrow', from: 'client', to: 'contract', lines: ['finish_run(player, actions)', 'player signs'], zone: 'contract' },
  { kind: 'note', over: ['contract'], lines: ['replay the log with the Rust port', 'derive floor, score, relics, HP', 'consume the open run', 'update profile and leaderboard'], zone: 'contract' },
  { kind: 'arrow', from: 'contract', to: 'sac', lines: ['mint(player, amount)', 'only after an extraction', 'rejected: MintFailed, run stays open'], zone: 'asset' },
  { kind: 'arrow', from: 'contract', to: 'client', lines: ['RunOutcome', 'event run_finished', 'hero_earned after a first full clear'], zone: 'contract', dashed: true },
  { kind: 'note', over: ['player', 'client'], lines: ['If Stellar is unreachable the game plays a labelled practice run.', 'A failed or slow finish_run never blocks play.'], zone: 'warn' },
];

const META: DiagramMeta = {
  name: '02-run-sequence',
  title: 'One run, two transactions',
  description:
    'Sequence of one Deepmark run. start_run issues the seed on chain while the descent animation plays. The player then plays locally with no transactions. finish_run sends the action log, the contract replays it, updates the profile and leaderboard and mints relics. A rejected mint reverts the whole finish_run and leaves the run open.',
};

export default {
  meta: META,
  svg: async () => withAccessibility(renderSequence(LIFELINES, STEPS), META),
} satisfies Diagram;
