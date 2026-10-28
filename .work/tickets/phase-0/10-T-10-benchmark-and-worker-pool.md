# T-10: Benchmark and worker pool

**Type:** task
**Parent:** E-0
**Requirements:** R0.8, R11.1, R14.1
**Blocked by:** T-3, T-6, T-7
**Status:** done
**New infrastructure:** none
**Files:** src/worker/pool, src/main/export, tests/bench
**Proof:** `npm run bench` prints timings for 4,000 Word and 4,000 image rows on a 4-core machine, with event-loop lag measured on the main process.
**Step:** close
**Base:**
**Baseline:**

**What to build:** Run generation in a worker pool sized to the CPU cores (default), with cancel and progress, for both Word and image output, and measure it. Targets: Word at most 60 s, images at most 120 s, the UI never blocked. Report the result as `test-benchmark` asks: what limits it, repeat runs, end-to-end share. Settle the final targets after the measurement.

- [x] 4,000 Word rows produce a ZIP and finish within the target, or the measured figure is recorded as the new target.
- [x] 4,000 image rows likewise.
- [x] Main-process event-loop lag stays low during the run (measured and recorded).
- [x] Cancel stops all workers and leaves nothing behind.
- [x] The result is written to `.work/notes.md` with the machine description.

## Test plan (added by /dev:implement-ticket)

## Result

Goal: a worker pool for Word and image generation with cancel and progress, measured on 4,000 rows.
Proof: `node scripts/bench.mjs` (see `.work/proof/phase-0-benchmark-deflate.md`): Word 15.0 s and images 41.7 s with 3 workers on 4 cores, 0 failed rows, main-thread lag p99 16 ms; `npm test` includes pool tests (workers, crash, terminate), a real-worker batch test and cancel cleanup.
Verdict: VERIFIED for the targets on 4 cores; the renderer's responsiveness under load is not measured (follow-up).
Decisions: see `.work/phase-0-report.md` (T-10).
Applied: test-benchmark checklist (limiter, tuning of pool size, errors, repeats, end-to-end, work happened); skip: review: typed.
