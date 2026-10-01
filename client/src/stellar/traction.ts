import { nativeToScVal, rpc, scValToNative } from '@stellar/stellar-sdk';
import {
  count,
  isAddress,
  isTxHash,
  PLAYER_CAP,
  type EventWindow,
  type PlayerMark,
  type RecordedRun,
  summarize,
  type TractionSummary,
} from '../stats/summary';
import { STELLAR_CONFIG } from './config';
import { readClient } from './contract';

const EVENT_PAGE = 100;
const EVENT_PAGES = 40;

interface RawRecord {
  best_floor?: unknown;
  best_relics?: unknown;
  total_runs?: unknown;
}

function playerMark(address: string, raw: RawRecord | null | undefined): PlayerMark | null {
  if (!raw) return null;
  const bestFloor = count(raw.best_floor, 3);
  const bestRelics = count(raw.best_relics);
  const totalRuns = count(raw.total_runs);
  if (bestFloor === null || bestRelics === null || totalRuns === null || totalRuns < 1) return null;
  return { address, bestFloor, bestRelics, totalRuns };
}

function isoTime(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 10_000_000_000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === 'string' && value.length > 0) {
    if (/^\d+$/.test(value)) return isoTime(Number(value));
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  return null;
}

function parseRun(event: rpc.Api.EventResponse): RecordedRun | null {
  if (!event.inSuccessfulContractCall) return null;
  const name = event.topic[0] ? scValToNative(event.topic[0]) : null;
  if (name !== 'run_recorded') return null;
  const address = event.topic[1] ? scValToNative(event.topic[1]) : null;
  if (!isAddress(address)) return null;
  const value = scValToNative(event.value) as { floor_reached?: unknown; relics_kept?: unknown } | null;
  if (!value || typeof value !== 'object') return null;
  const floorReached = count(value.floor_reached, 3);
  const relicsKept = count(value.relics_kept);
  const at = isoTime(event.ledgerClosedAt);
  if (floorReached === null || relicsKept === null || !at || !isTxHash(event.txHash)) return null;
  return { at, address, floorReached, relicsKept, txHash: event.txHash };
}

function runRecordedTopic(): string {
  return nativeToScVal('run_recorded', { type: 'symbol' }).toXDR('base64');
}

async function loadRuns(server: rpc.Server): Promise<{
  runs: RecordedRun[];
  window: EventWindow | null;
  truncated: boolean;
}> {
  const latest = await server.getLatestLedger();
  const filters: rpc.Api.EventFilter[] = [
    {
      type: 'contract',
      contractIds: [STELLAR_CONFIG.contractId],
      topics: [[runRecordedTopic(), '*']],
    },
  ];
  const probe = await server.getEvents({ startLedger: latest.sequence, filters, limit: 1 });
  const from = isoTime(probe.oldestLedgerCloseTime);
  const to = isoTime(probe.latestLedgerCloseTime);
  const window = from && to ? { from, to } : null;

  const runs: RecordedRun[] = [];
  const seen = new Set<string>();
  let request: rpc.Api.GetEventsRequest = {
    startLedger: probe.oldestLedger,
    filters,
    limit: EVENT_PAGE,
  };
  let truncated = false;
  let previousCursor = '';

  for (let page = 0; page < EVENT_PAGES; page += 1) {
    const response = await server.getEvents(request);
    for (const event of response.events) {
      const run = parseRun(event);
      if (!run || seen.has(run.txHash)) continue;
      seen.add(run.txHash);
      runs.push(run);
    }
    // An empty page that repeats the same cursor is the end of the window,
    // not a signal that older runs were dropped.
    if (!response.cursor || (response.events.length === 0 && response.cursor === previousCursor)) {
      return { runs, window, truncated };
    }
    if (page === EVENT_PAGES - 1) {
      truncated = true;
      break;
    }
    previousCursor = response.cursor;
    request = { cursor: response.cursor, filters, limit: EVENT_PAGE };
  }

  return { runs, window, truncated };
}

async function mapLimited<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await fn(item);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

export async function loadTraction(): Promise<TractionSummary> {
  const server = new rpc.Server(STELLAR_CONFIG.rpcUrl);
  const client = await readClient();
  const board = await client.leaderboard();
  const addresses = (board.result ?? []).filter(isAddress).slice(0, PLAYER_CAP);
  const marks = await mapLimited(addresses, 8, async (address) => {
    const record = await client.get_record({ player: address });
    return playerMark(address, record.result as RawRecord | null | undefined);
  });
  const players = marks.filter((mark): mark is PlayerMark => mark !== null);
  const events = await loadRuns(server);
  return summarize(players, events.runs, events.window, events.truncated, addresses.length >= PLAYER_CAP);
}
