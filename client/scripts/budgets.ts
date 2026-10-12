/**
 * Performance budgets, the single source for the numbers written in
 * docs/performance.md. The harness imports this to fail a run that goes over.
 */

export const BUDGETS = {
  /** Encoded bytes transferred on a cold load, in KB. */
  transferKB: 1200,
  /** Cumulative layout shift during load. */
  layoutShift: 0.05,
  /** Frame time in play at the profile's percentile, in ms. */
  frameMs: 20,
} as const;

/**
 * What differs between the machine the budgets were set on and a shared CI
 * runner. Bytes and layout shift do not depend on the CPU, so they are the same
 * everywhere. Timing does. The `laptop` profile is the reference: an Apple
 * silicon laptop, with the CPU throttled 4 times to stand in for a mid range
 * phone. A GitHub runner is already several times slower than that laptop and
 * has no GPU, and the same 4 times throttle on top of it measured a 49.9 ms
 * frame and a 126 ms load task for a build that holds 16.8 ms and no long task
 * on the laptop. The `ci` profile therefore applies no throttle and allows a
 * longer task during load. A shared runner also hiccups: one run of 705 frames
 * had 4 frames over 33 ms, which moves the 99th percentile to 33.2 ms while the
 * 95th stayed at 16.8 ms. The `ci` profile therefore judges the 95th percentile,
 * which still fails a build that is slow in more than 1 frame in 20, and leaves
 * the 99th percentile to the laptop profile.
 */
export const PROFILES = {
  laptop: { throttle: 4, longTaskMs: 50, percentile: 'p99' },
  ci: { throttle: 1, longTaskMs: 200, percentile: 'p95' },
} as const;

export type ProfileName = keyof typeof PROFILES;

export function isProfileName(value: string): value is ProfileName {
  return value in PROFILES;
}

export interface BudgetInput {
  load: { bytesKB: number; clsScore: number; longTasks: { count: number; totalMs: number; maxMs: number } };
  frames: { throttle: number; p95: number; p99: number }[];
}

export interface Violation {
  metric: string;
  actual: number;
  limit: number;
  message: string;
}

/** Compares a measured report with the budgets of a profile and returns one entry per breach. */
export function checkBudgets(report: BudgetInput, profile: ProfileName): Violation[] {
  const { throttle, longTaskMs, percentile } = PROFILES[profile];
  const out: Violation[] = [];
  const over = (metric: string, actual: number, limit: number, unit: string, hint: string): void => {
    if (actual > limit) {
      out.push({ metric, actual, limit, message: `${metric} is ${actual}${unit}, budget is ${limit}${unit}. ${hint}` });
    }
  };

  over('Cold load transfer', report.load.bytesKB, BUDGETS.transferKB, ' KB', 'Check for a new or unoptimized asset.');
  over('Cumulative layout shift', report.load.clsScore, BUDGETS.layoutShift, '', 'Reserve space for late content or load styles before first paint.');
  if (report.load.longTasks.count > 0) {
    over('Longest task during load', report.load.longTasks.maxMs, longTaskMs, ' ms', 'Split or defer the work that blocks the main thread.');
  }
  const sampled = report.frames.find((f) => f.throttle === throttle);
  if (!sampled) {
    out.push({ metric: 'Frame time', actual: 0, limit: BUDGETS.frameMs, message: `No frame sample at ${throttle}x CPU throttle was recorded.` });
  } else {
    over(`Frame time ${percentile} at ${throttle}x throttle`, sampled[percentile], BUDGETS.frameMs, ' ms', 'Profile the render loop for per frame allocations.');
  }
  return out;
}
