import { MAX_FLOOR } from './floor';
import type { HeroId } from './heroes';
import { readJson, writeJson } from '../storage';

export interface Progress {
  bestFloor: number;
  bestRelics: number;
  bestScore: number;
  runsPlayed: number;
  extractions: number;
  deaths: number;
  relicsKept: number;
  lanternRuns: number;
  cinderRuns: number;
}

const STORAGE_KEY = 'deepmark:progress:v1';
const COUNT_LIMIT = 1_000_000;

const EMPTY: Progress = {
  bestFloor: 0,
  bestRelics: 0,
  bestScore: 0,
  runsPlayed: 0,
  extractions: 0,
  deaths: 0,
  relicsKept: 0,
  lanternRuns: 0,
  cinderRuns: 0,
};

function count(value: unknown, max = COUNT_LIMIT): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) return 0;
  return value;
}

function sanitize(raw: Partial<Progress> | null): Progress {
  if (!raw || typeof raw !== 'object') return { ...EMPTY };
  return {
    bestFloor: count(raw.bestFloor, MAX_FLOOR),
    bestRelics: count(raw.bestRelics),
    bestScore: count(raw.bestScore),
    runsPlayed: count(raw.runsPlayed),
    extractions: count(raw.extractions),
    deaths: count(raw.deaths),
    relicsKept: count(raw.relicsKept),
    lanternRuns: count(raw.lanternRuns),
    cinderRuns: count(raw.cinderRuns),
  };
}

export function loadProgress(): Progress {
  const stored = readJson(STORAGE_KEY);
  if (!stored || typeof stored !== 'object') return { ...EMPTY };
  return sanitize(stored as Partial<Progress>);
}

function saveProgress(progress: Progress): void {
  // When storage is unavailable progression just does not persist; the run itself still works.
  writeJson(STORAGE_KEY, progress);
}

export interface FinishedRun {
  floorReached: number;
  relicsKept: number;
  score: number;
  extracted: boolean;
  heroId: HeroId;
  /** A practice run is not recorded anywhere, so it never counts toward this browser's bests. */
  practice: boolean;
}

function bump(value: number, amount: number): number {
  return Math.min(COUNT_LIMIT, value + amount);
}

export function recordRun(finished: FinishedRun): { progress: Progress; isNewBest: boolean } {
  const previous = loadProgress();
  if (finished.practice) return { progress: previous, isNewBest: false };
  const floorReached = count(finished.floorReached, MAX_FLOOR);
  const relicsKept = finished.extracted ? count(finished.relicsKept) : 0;
  const score = finished.extracted ? count(finished.score) : 0;
  const isNewBest = floorReached > previous.bestFloor || relicsKept > previous.bestRelics;
  const progress: Progress = {
    bestFloor: Math.max(previous.bestFloor, floorReached),
    bestRelics: Math.max(previous.bestRelics, relicsKept),
    bestScore: Math.max(previous.bestScore, score),
    runsPlayed: bump(previous.runsPlayed, 1),
    extractions: bump(previous.extractions, finished.extracted ? 1 : 0),
    deaths: bump(previous.deaths, finished.extracted ? 0 : 1),
    relicsKept: bump(previous.relicsKept, relicsKept),
    lanternRuns: bump(previous.lanternRuns, finished.heroId === 'lantern' ? 1 : 0),
    cinderRuns: bump(previous.cinderRuns, finished.heroId === 'cinder' ? 1 : 0),
  };
  saveProgress(progress);
  return { progress, isNewBest };
}
