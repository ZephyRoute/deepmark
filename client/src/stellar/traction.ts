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
import { fetchPlayerCount, fetchPlayers, type PlayerRecord } from './contract';

const EVENT_PAGE = 100;
const EVENT_PAGES = 40;

const PLAYER_PAGE = 50;

function playerMark(address: unknown, raw: PlayerRecord | null | undefined): PlayerMark | null {
  if (!isAddress(address) || !raw) return null;
  const bestFloor = count(raw.best_floor, 3);
  const bestScore = count(raw.best_score, 6);
  const extractions = count(raw.extractions);
  const deaths = count(raw.deaths);
  const forfeits = count(raw.forfeits);
  const relicsBanked = count(raw.relics_banked);
  if (
    bestFloor === null ||
    bestScore === null ||
    extractions === null ||
    deaths === null ||
    forfeits === null ||
    relicsBanked === null
  ) {
    return null;
  }
  const finishedRuns = extractions + deaths;
  if (finishedRuns < 1) return null;
  return { address, bestFloor, bestScore, extractions, deaths, forfeits, relicsBanked, finishedRuns };
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
  if (name !== 'run_finished') return null;
  const address = event.topic[1] ? scValToNative(event.topic[1]) : null;
  if (!isAddress(address)) return null;
  const value = scValToNative(event.value) as
    | { floor_reached?: unknown; score?: unknown; extracted?: unknown }
    | null;
  if (!value || typeof value !== 'object') return null;
  const floorReached = count(value.floor_reached, 3);
  const score = count(value.score, 6);
  const at = isoTime(event.ledgerClosedAt);
  if (floorReached === null || score === null || typeof value.extracted !== 'boolean') return null;
  if (!at || !isTxHash(event.txHash)) return null;
  return { at, address, floorReached, score, extracted: value.extracted, txHash: event.txHash };
}

function runFinishedTopic(): string {
  return nativeToScVal('run_finished', { type: 'symbol' }).toXDR('base64');
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
      topics: [[runFinishedTopic(), '*']],
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

/** Reads every player through paged calls, 50 profiles per request. */
async function loadPlayers(): Promise<{ marks: PlayerMark[]; opened: number; capped: boolean }> {
  const opened = await fetchPlayerCount();
  const target = Math.min(opened, PLAYER_CAP);
  const marks: PlayerMark[] = [];
  for (let start = 0; start < target; start += PLAYER_PAGE) {
    const page = await fetchPlayers(start, PLAYER_PAGE);
    for (const entry of page) {
      const mark = playerMark(entry.player, entry.record);
      if (mark) marks.push(mark);
    }
  }
  return { marks, opened, capped: opened > PLAYER_CAP };
}

export async function loadTraction(): Promise<TractionSummary> {
  const server = new rpc.Server(STELLAR_CONFIG.rpcUrl);
  const players = await loadPlayers();
  const events = await loadRuns(server);
  return summarize(players.marks, events.runs, events.window, events.truncated, players.opened, players.capped);
}
