export interface Progress {
  bestFloor: number;
  bestRelics: number;
  runsPlayed: number;
}

const STORAGE_KEY = 'deepmark:progress:v1';
const EMPTY: Progress = { bestFloor: 0, bestRelics: 0, runsPlayed: 0 };

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Progress>) };
  } catch {
    return { ...EMPTY };
  }
}

function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // localStorage unavailable (private mode, quota, etc). Progression just
    // won't persist across reloads this session; the run itself still works.
  }
}

export function recordRun(floorReached: number, relicsKept: number): { progress: Progress; isNewBest: boolean } {
  const previous = loadProgress();
  const isNewBest = floorReached > previous.bestFloor || relicsKept > previous.bestRelics;
  const progress: Progress = {
    bestFloor: Math.max(previous.bestFloor, floorReached),
    bestRelics: Math.max(previous.bestRelics, relicsKept),
    runsPlayed: previous.runsPlayed + 1,
  };
  saveProgress(progress);
  return { progress, isNewBest };
}
