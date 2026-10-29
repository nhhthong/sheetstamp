# T-24 report: image background limits

Evidence: `prototypes/phase2/image-limits/output.md` (rerun: `node prototypes/phase2/image-limits/run.mjs`, needs a build of the worker). The agent that ran it was stopped before writing this file; the decision below is the orchestrator's reading of its output.

## Facts (measured, 4 cores, Node 22, Liberation Sans)
- EXIF orientation 1-8: applied by the engine, output upright (sizes swap for 5-8). No normalisation needed on import.
- CMYK, grey, progressive, 16-bit PNG, indexed PNG, alpha PNG: all draw with right colours.
- Animated GIF/PNG/WebP: first frame only. BMP, WebP also draw; TIFF is rejected by the engine.
- Empty file and random bytes: rejected cleanly (`render-failed`).
- A truncated JPEG is accepted without error and the missing half is not drawn.
- 1600x1000 photo JPEG, 4,000 rows, JPEG output: 54 s (3 workers), 44 s (4 workers), 716-822 MB. Estimate 79 s from marginal cost.
- 3000x2000 (6 MP): 0.074 s/img with 3 workers; 1,000 rows took 42.8 s, so 4,000 rows is about 171 s (table A estimates 295 s). Peak 1.05 GB for 1,000 rows.
- 6000x4000 (24 MP): 0.158 s/img marginal, 4,000 rows about 631 s, peak RSS 2.4 GB. 8000x6000: 4.3 GB. 12000x8000: 3.6 GB.
- PNG output costs 3-10x more time than JPEG at the same size (0.46 s vs 0.04 s at 1600x1000 from a JPEG background) and 1-3 MB per image.

## Decision (values for T-28 and T-33)
- Accept by file signature only PNG and JPEG (spec R4.1). Reject GIF, WebP, BMP, TIFF and anything else with "Chỉ nhận ảnh PNG hoặc JPG."
- Limits: file at most 20 MB (same as the data file) and at most 25 megapixels (6000x4000). Above that: reject with the fix ("Ảnh lớn hơn 25 megapixel. Thu nhỏ ảnh rồi thử lại.") because memory reaches 2.4 GB at 24 MP and 4 GB beyond.
- Warn (not block) above 4 megapixels: "Ảnh lớn, mỗi file có thể mất vài giây"; the Step 4 estimate shows time as well as size. The provisional 120 s target for 4,000 images (M3) is met at about 2 MP and below; at 6 MP it is about 170-300 s, at 24 MP about 10 minutes. M3 must be restated as per-image time by size when T-33 records the result.
- Detect a truncated JPEG cheaply on import: the file must end with the EOI marker (FF D9), else reject "Ảnh bị cắt dở."
- PNG output: tell the user in Step 4 that PNG is slower and larger than JPG (the choice stays theirs).
