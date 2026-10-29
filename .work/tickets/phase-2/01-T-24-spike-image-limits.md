# T-24: Spike: image background limits

**Type:** spike
**Parent:** E-2
**Requirements:** R4.1, R8.8
**Blocked by:** None (can start immediately)
**Status:** done
**New infrastructure:** none
**Files:** prototypes/phase2/image-limits
**Proof:** `node prototypes/phase2/image-limits/run.mjs` prints, for 1600x1000, 3000x2000 and 6000x4000 backgrounds, the render time per image and peak memory in a 3-worker pool, and whether a phone JPEG with EXIF orientation 6 and a CMYK JPEG draw upright and without error; the decision (limits) is written to `.work/notes.md`.
**Step:**
**Base:**
**Baseline:**

**What to build:** Question: which background images can the image engine take safely? Measure with the Phase 0 render function and worker pool: size in bytes and pixels against time and memory per image (4,000 rows must still meet the provisional 120 s on 4 cores for a typical 1600x1000 image), whether `@napi-rs/canvas` applies EXIF orientation (phone photos), and how it treats progressive, CMYK, 16-bit and animated inputs. Decide the limits and the behaviour (reject with a message, or normalise on import) that the import dialog (T-28) enforces. Close through `explore-decide`.

- [ ] The limits (bytes, pixels, accepted variants) are written as a decision with the measured numbers.
- [ ] EXIF orientation is either applied on import or rejected with a message; the choice has a measured reason.
- [ ] The prototype and its output are kept in `prototypes/phase2/image-limits` with the command to rerun it.

## Test plan (added by /dev:implement-ticket)

## Result
