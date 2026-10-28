# T-10: Benchmark and worker pool

**Type:** task
**Parent:** E-0
**Requirements:** R0.8, R11.1, R14.1
**Blocked by:** T-3, T-6, T-7
**Status:** ready
**New infrastructure:** none
**Files:** src/worker/pool, src/main/export, tests/bench
**Proof:** `npm run bench` prints timings for 4,000 Word and 4,000 image rows on a 4-core machine, with event-loop lag measured on the main process.
**Step:**
**Base:**
**Baseline:**

**What to build:** Run generation in a worker pool sized to the CPU cores (default), with cancel and progress, for both Word and image output, and measure it. Targets: Word at most 60 s, images at most 120 s, the UI never blocked. Report the result as `test-benchmark` asks: what limits it, repeat runs, end-to-end share. Settle the final targets after the measurement.

- [ ] 4,000 Word rows produce a ZIP and finish within the target, or the measured figure is recorded as the new target.
- [ ] 4,000 image rows likewise.
- [ ] Main-process event-loop lag stays low during the run (measured and recorded).
- [ ] Cancel stops all workers and leaves nothing behind.
- [ ] The result is written to `.work/notes.md` with the machine description.

## Test plan (added by /dev:implement-ticket)

## Result
