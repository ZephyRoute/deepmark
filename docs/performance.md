# Performance

Measured on the production build, in a real headless Chrome driven over CDP, so paint timings and frame times come from a browser that actually paints. A tab in the background does not paint and gives meaningless numbers, which is why this harness exists.

## Method

```bash
cd client
bun run build
bun run preview --port 4173 &
bun run perf            # optionally: bun run perf http://localhost:4173/
bun run perf --json > perf.json
```

The harness exits with code 1 when a budget below is exceeded. With `--json` the report goes to stdout and the readable log to stderr, so the file stays parseable. Set `CHROME_PATH` to use a Chrome other than the default macOS install.

- **Cold load:** cache disabled, one navigation. Reports bytes by type, first contentful paint, largest contentful paint, cumulative layout shift, long tasks, and the time until the title is usable.
- **Frames:** a practice run with the Stellar hosts blocked, so it is independent of the network. The script walks into the guard, fights and wanders for 12 seconds while sampling every frame, once at normal CPU and once with the CPU throttled 4 times.
- **Environment:** an Apple silicon laptop, Chrome 1280 by 800 at device pixel ratio 1, local preview server. Network latency is not simulated, so absolute load times on a real connection are higher. Use the byte counts for that.

## Results

| Metric | Before | After |
|---|---|---|
| Transferred on a cold load | 3,954 KB | 937 KB |
| Of which images | 3,787 KB | 760 KB |
| Of which JavaScript | 160 KB | 169 KB, with the Stellar SDK (135 KB gzip) loaded when idle |
| Title usable | 385 ms | 73 ms |
| First contentful paint | not captured | 44 ms |
| Largest contentful paint | not captured | 96 ms |
| Cumulative layout shift | 0 | 0 |
| Long tasks during load | 1 (134 ms) | 0 |
| Frame rate in play, normal CPU | 59.2 fps, worst frame 166.7 ms | 59.8 fps, worst frame 50 ms |
| Frame rate in play, CPU throttled 4x | 60 fps | 60 fps |
| 99th percentile frame time | 16.8 ms | 16.8 ms |
| JS heap after load | 6.2 MB | 6.3 MB |

## What changed

1. **Art converted to WebP** with sizes matched to how each file is drawn (`client/scripts/optimize-art.sh`). The art folder went from 6.6 MB to 1.2 MB.
2. **The Stellar SDK loads when the browser is idle**, not before the title. The title no longer waits for 135 KB of cryptography it does not use yet. `client/src/stellar/lazy.ts` warms the chunk after first paint, so it is normally ready by the time a player presses Forge.
3. **The main stylesheet is a normal `<link>`**, not imported from a lazily loaded script. Loading it from script made the page paint unstyled and then jump, which measured a layout shift of 0.92 once everything else got fast.

## Budgets to keep

The numbers live in `client/scripts/budgets.ts`, which the harness imports, so the code and this table cannot disagree.

| Item | Budget | Enforced in CI |
|---|---|---|
| Cold load transfer | under 1.2 MB | yes |
| Cumulative layout shift | 0.05 or less | yes |
| Long tasks during load | none over 50 ms (200 ms in the CI profile) | yes |
| Frame time, 99th percentile, 4x CPU throttle | under 20 ms (measured at 1x in the CI profile) | yes |
| JavaScript before the title | under 60 KB gzip | no, read from the build output |
| Largest contentful paint (local) | under 200 ms | no, too noisy on shared runners |

## Continuous integration

The harness has two profiles, chosen with `--profile=laptop` (the default) or `--profile=ci`. Bytes and layout shift are the same in both. Timing is not: the first run on a GitHub runner measured a 49.9 ms frame at 4x throttle and a 126 ms task during load, for a build that holds 16.8 ms and no long task on the laptop, because the runner has no GPU and a CPU several times slower than the reference machine. The `ci` profile therefore samples frames at 1x, which is already a slow machine, and allows a 200 ms task during load. Both sets of numbers are in `client/scripts/budgets.ts`.

`.github/workflows/perf.yml` builds the client, serves the production preview, runs the harness in a pinned Chrome and fails the check when a budget is exceeded. The failure names the metric, the measured value and the limit. The full report is uploaded as the `perf-report` artifact and summarised on the run page, so two runs can be compared. A pull request that adds a 2 MB image fails with `Cold load transfer is 3091 KB, budget is 1200 KB`.

## Known limits

- Headless Chrome on a fast laptop is optimistic. Throttling the CPU 4 times approximates a mid range phone for scripting cost, not for GPU fill rate. A real device pass is tracked in the issues.
- The harness blocks Stellar, so it does not measure the transaction round trip. That is a 3 to 8 second wait by design, covered by the descent scene.
