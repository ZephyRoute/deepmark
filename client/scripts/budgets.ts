/**
 * Performance budgets, the single source for the numbers written in
 * docs/performance.md. The harness imports this to fail a run that goes over.
 */

export const BUDGETS = {
  /** Encoded bytes transferred on a cold load, in KB. */
  transferKB: 1200,
  /** Cumulative layout shift during load. */
  layoutShift: 0.05,
  /** Longest task allowed during load, in ms. The Long Tasks API only reports tasks over 50 ms. */
  longTaskMs: 50,
  /** 99th percentile frame time in play with the CPU throttled 4 times, in ms. */
  frameP99Ms: 20,
} as const;

/** CPU throttle factor the frame budget applies to. */
export const BUDGET_THROTTLE = 4;

export interface BudgetInput {
  load: { bytesKB: number; clsScore: number; longTasks: { count: number; totalMs: number; maxMs: number } };
  frames: { throttle: number; p99: number }[];
}

export interface Violation {
  metric: string;
  actual: number;
  limit: number;
  message: string;
}

/** Compares a measured report with the budgets and returns one entry per breach. */
export function checkBudgets(report: BudgetInput): Violation[] {
  const out: Violation[] = [];
  const over = (metric: string, actual: number, limit: number, unit: string, hint: string): void => {
    if (actual > limit) {
      out.push({ metric, actual, limit, message: `${metric} is ${actual}${unit}, budget is ${limit}${unit}. ${hint}` });
    }
  };

  over('Cold load transfer', report.load.bytesKB, BUDGETS.transferKB, ' KB', 'Check for a new or unoptimized asset.');
  over('Cumulative layout shift', report.load.clsScore, BUDGETS.layoutShift, '', 'Reserve space for late content or load styles before first paint.');
  if (report.load.longTasks.count > 0) {
    over('Longest task during load', report.load.longTasks.maxMs, BUDGETS.longTaskMs, ' ms', 'Split or defer the work that blocks the main thread.');
  }
  const throttled = report.frames.find((f) => f.throttle === BUDGET_THROTTLE);
  if (!throttled) {
    out.push({ metric: 'Frame time', actual: 0, limit: BUDGETS.frameP99Ms, message: `No frame sample at ${BUDGET_THROTTLE}x CPU throttle was recorded.` });
  } else {
    over(`Frame time p99 at ${BUDGET_THROTTLE}x throttle`, throttled.p99, BUDGETS.frameP99Ms, ' ms', 'Profile the render loop for per frame allocations.');
  }
  return out;
}
