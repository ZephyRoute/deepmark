export const MAX_TRACKED_FLOOR = 3;
export const PLAYER_CAP = 500;
export const DAY_CAP = 14;

const COUNT_LIMIT = 1_000_000;
const ADDRESS = /^G[A-Z2-7]{55}$/;
const TX_HASH = /^[a-f0-9]{64}$/;

export interface PlayerMark {
  address: string;
  bestFloor: number;
  bestRelics: number;
  totalRuns: number;
}

export interface RecordedRun {
  at: string;
  address: string;
  floorReached: number;
  relicsKept: number;
  txHash: string;
}

export interface DayCount {
  day: string;
  runs: number;
}

export interface EventWindow {
  from: string;
  to: string;
}

export interface TractionSummary {
  players: PlayerMark[];
  playerCount: number;
  recordedRuns: number;
  bestFloorThree: number;
  bankedRelic: number;
  floorCounts: number[];
  days: DayCount[];
  recentRuns: RecordedRun[];
  recentRunCount: number;
  eventWindow: EventWindow | null;
  eventsTruncated: boolean;
  listCapped: boolean;
}

export function isAddress(value: unknown): value is string {
  return typeof value === 'string' && ADDRESS.test(value);
}

export function isTxHash(value: unknown): value is string {
  return typeof value === 'string' && TX_HASH.test(value);
}

export function count(value: unknown, max = COUNT_LIMIT): number | null {
  if (typeof value === 'bigint') {
    if (value < 0n || value > BigInt(max)) return null;
    return Number(value);
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) return null;
  return value;
}

export function utcDays(fromIso: string, toIso: string, cap = DAY_CAP): string[] {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return [];
  const start = new Date(from);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  const days: string[] = [];
  for (let time = start.getTime(); time <= end.getTime() && days.length < cap; time += 86_400_000) {
    const day = new Date(time).toISOString().slice(0, 10);
    days.push(day);
  }
  if (days.length === cap && end.getTime() > start.getTime() + (cap - 1) * 86_400_000) {
    const tail: string[] = [];
    for (let time = end.getTime(); tail.length < cap; time -= 86_400_000) {
      tail.push(new Date(time).toISOString().slice(0, 10));
    }
    return tail.reverse();
  }
  return days;
}

export function summarize(
  players: PlayerMark[],
  runs: RecordedRun[],
  eventWindow: EventWindow | null,
  eventsTruncated: boolean,
  listCapped: boolean
): TractionSummary {
  const sorted = [...players].sort(
    (a, b) =>
      b.bestFloor - a.bestFloor ||
      b.bestRelics - a.bestRelics ||
      b.totalRuns - a.totalRuns ||
      (a.address < b.address ? -1 : a.address > b.address ? 1 : 0)
  );
  const floorCounts = [0, 0, 0, 0];
  let recordedRuns = 0;
  let bestFloorThree = 0;
  let bankedRelic = 0;
  for (const player of sorted) {
    recordedRuns += player.totalRuns;
    if (player.bestFloor === MAX_TRACKED_FLOOR) bestFloorThree += 1;
    if (player.bestRelics > 0) bankedRelic += 1;
    const bucket = floorCounts[player.bestFloor];
    if (bucket !== undefined) floorCounts[player.bestFloor] = bucket + 1;
  }
  const recent = [...runs].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const byDay = new Map<string, number>();
  for (const run of recent) {
    const day = run.at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const days = eventWindow
    ? utcDays(eventWindow.from, eventWindow.to).map((day) => ({ day, runs: byDay.get(day) ?? 0 }))
    : [];
  return {
    players: sorted,
    playerCount: sorted.length,
    recordedRuns,
    bestFloorThree,
    bankedRelic,
    floorCounts,
    days,
    recentRuns: recent.slice(0, 20),
    recentRunCount: recent.length,
    eventWindow,
    eventsTruncated,
    listCapped,
  };
}
