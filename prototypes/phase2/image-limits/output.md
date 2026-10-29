# Spike T-24: image background limits (raw run output)
Machine: Intel(R) Xeon(R) Processor @ 2.10GHz, 4 cores; Node v22.22.0; font Liberation Sans
Pool = the real WorkerPool + src/worker/generate-worker (built); 4 text boxes scaled from the Phase 0 certificate.

## A. Time and memory by pixel size (photo-like JPEG q85 background, JPEG q85 output)
1 worker = pure per-image time (includes ZIP write). 3 workers = default pool on 4 cores (cores minus one).
4,000 rows is extrapolated from the marginal 3-worker cost (two batch sizes, difference / rows). Peak MB = peak process RSS (all worker threads included).

| Size | MP | Background KB | 1 worker s/img | 3 workers s/img (marginal) | Peak RSS MB (3 workers) | 4,000 rows est. s | Failed |
|---|---|---|---|---|---|---|---|
| 1600x1000 | 1.6 | 108 | 0.045 | 0.020 | 555 | 79 | 0  |
| 3000x2000 | 6.0 | 270 | 0.140 | 0.074 | 840 | 295 | 0  |
| 6000x4000 | 24.0 | 701 | 0.615 | 0.158 | 2444 | 631 | 0  |

## B. Output format at the same pixel size (1 worker, s per image)

| Size | Background | Output JPEG q85 | Output PNG | PNG output KB/img |
|---|---|---|---|---|
| 1600x1000 | jpeg (106 KB) | 0.042 | 0.462 | 1257 |
| 1600x1000 | png (750 KB) | 0.045 | 0.167 | 793 |
| 3000x2000 | jpeg (267 KB) | 0.151 | 1.061 | 2982 |
| 3000x2000 | png (1614 KB) | 0.166 | 0.448 | 1691 |

## C. Bytes against pixels, and probes beyond 6000x4000

| Case | Background MB | MP | s/img (1 worker) | Peak RSS MB (3 workers) | Result |
|---|---|---|---|---|---|
| 1600x1000 noise PNG (incompressible) | 5.6 | 1.6 | 0.292 | 795 | 0 failed |
| 8000x6000 photo JPEG | 0.9 | 48.0 | 1.24 | 4350 | 0 failed  |
| 12000x8000 photo JPEG | 1.4 | 96.0 | 2.83 | 3571 | 0 failed  |

## D. Input variants through the real worker (400x300 landscape; RED block = raw top-left, BLUE = raw bottom-right)

| Fixture | Bytes | Result | Output size | Red at | Blue at | Verdict |
|---|---|---|---|---|---|---|
| alpha.png | 1163 | ok | 400x300 | TL | BR | ok, colours as expected |
| animated.gif | 2357 | ok | 400x300 | TL | BR | first frame only |
| animated.png | 3499 | ok | 400x300 | TL | BR | first frame only |
| animated.webp | 2002 | ok | 400x300 | TL | BR | first frame only |
| cmyk.jpg | 6609 | ok | 400x300 | TL | BR | draws, colours right |
| exif-1.jpg | 2925 | ok | 400x300 | TL | BR | orientation APPLIED (upright) |
| exif-2.jpg | 2925 | ok | 400x300 | TR | BL | orientation APPLIED (upright) |
| exif-3.jpg | 2925 | ok | 400x300 | BR | TL | orientation APPLIED (upright) |
| exif-4.jpg | 2925 | ok | 400x300 | BL | TR | orientation APPLIED (upright) |
| exif-5.jpg | 2925 | ok | 300x400 | TL | BR | orientation APPLIED (upright) |
| exif-6.jpg | 2925 | ok | 300x400 | TR | BL | orientation APPLIED (upright) |
| exif-7.jpg | 2925 | ok | 300x400 | BR | TL | orientation APPLIED (upright) |
| exif-8.jpg | 2925 | ok | 300x400 | BL | TR | orientation APPLIED (upright) |
| gray.jpg | 1954 | ok | 400x300 | - | - | draws (greyscale, no colour check) |
| indexed.png | 22529 | ok | 400x300 | TL | BR | ok, colours as expected |
| plain.bmp | 360054 | ok | 400x300 | TL | BR | ok, colours as expected |
| plain.jpg | 2889 | ok | 400x300 | TL | BR | ok, colours as expected |
| plain.png | 1088 | ok | 400x300 | TL | BR | ok, colours as expected |
| plain.tiff | 360140 | error render-failed | - | - | - | rejected by the engine |
| plain.webp | 80 | ok | 400x300 | TL | BR | ok, colours as expected |
| progressive.jpg | 1469 | ok | 400x300 | TL | BR | ok, colours as expected |
| rgb16.png | 2140 | ok | 400x300 | TL | BR | ok, colours as expected |
| empty file | 0 | error render-failed | - |  |  | rejected cleanly |
| random bytes | 500 | error render-failed | - |  |  | rejected cleanly |
| truncated JPEG (half) | 1444 | ok | 400x300 | TL | - | accepted, no error (blue block MISSING: the missing half is not detected) |

## E. Full 4,000-row run, 1600x1000 photo JPEG, JPEG q85 output

| Pool | Wall s | Failed | Peak RSS MB |
|---|---|---|---|
| 3 | 54.0 | 0 | 716 |
| 4 | 43.8 | 0 | 822 |

## F. 3000x2000, 4,000 rows is estimated in table A; measured here for the default pool
1,000 rows at 3000x2000, 3 workers: 42.8 s (x4 = 171 s for 4,000), failed 0, peak RSS 1050 MB
