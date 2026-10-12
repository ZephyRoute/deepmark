import { dotDiagram } from '../diagram';
import { ZONES, cluster, edge, graph, recordLabel, type Zone } from '../style';

function record(id: string, title: string, note: string, fields: readonly string[], zone: Zone): string {
  const style = ZONES[zone];
  return `${id} [label=${recordLabel(title, fields, note, zone)}, shape=box, style="rounded,filled", fillcolor="${style.fill}", color="${style.line}"];`;
}

export default dotDiagram(
  {
    name: '06-data-model',
    title: 'Contract data model',
    description:
      'What the Deepmark contract stores. Persistent storage holds player records, the player index, two leaderboards of the best 100 runs and the earned delvers. start_run also renews the player counter, the delver counter, both leaderboards and the veteran delver it uses. Temporary storage holds one open run ticket per player that expires after two days. Instance storage holds the admin and the relic token addresses.',
  },
  () =>
    graph('LR', [
      cluster('persistent', 'Persistent storage: TTL extended on every write (to 120 days when under 30), counters, boards and a veteran renewed by start_run', 'contract', [
        record('rec', 'PlayerRecord', 'Record(Address), one per player', [
          'best_key, best_floor, best_score',
          'best_hp_left, best_actions',
          'total_runs, extractions, deaths',
          'forfeits, relics_banked',
          'last_start_ledger',
          'vet_best_*, veteran_runs',
        ], 'contract'),
        record('index', 'Player index', 'PlayerCount, PlayerAt(n)', ['n -> player address', 'paged by players(start, limit)', 'at most 50 per call, no cap'], 'contract'),
        record('top', 'TopFresh and TopVeteran', 'Vec<TopEntry>, best 100', ['one row per player', 'player, rank_key, floor, score', 'hp_left, actions, name, emblem'], 'contract'),
        record('hero', 'Hero', 'Hero(id), HeroCount', ['id, owner, look', 'base, weapon, charm', 'clears (rank)', 'proof_score, proof_hp_left, proof_actions', 'minted_ledger'], 'contract'),
        record('owned', 'HeroesOf', 'HeroesOf(Address)', ['delver ids per owner', 'at most 64 per owner'], 'contract'),
      ]),
      cluster('temporary', 'Temporary storage: expires on its own', 'warn', [
        record('run', 'RunTicket', 'Run(Address), 2 days', ['seed, start_ledger', 'base, weapon, charm, rank', 'look, veteran: Option<id>', 'removed by finish_run'], 'warn'),
      ]),
      cluster('instance', 'Instance storage: TTL extended on start_run and finish_run, and at deploy', 'asset', [
        record('admin', 'Admin', 'Admin', ['Option<Address>', 'removed by renounce_admin'], 'asset'),
        record('tokens', 'RelicTokens', 'Relics, set once in the constructor', ['common, rare, core', 'Stellar Asset Contract addresses'], 'asset'),
      ]),
      edge({ from: 'index', to: 'rec', text: 'address', zone: 'contract' }),
      edge({ from: 'top', to: 'rec', text: 'player', zone: 'contract', dashed: true }),
      edge({ from: 'owned', to: 'hero', text: 'ids', zone: 'contract' }),
      edge({ from: 'run', to: 'hero', text: 'veteran id', zone: 'warn', dashed: true }),
    ]),
);
