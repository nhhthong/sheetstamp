# Phase 0 benchmark (T-10)

Machine: Intel(R) Xeon(R) Processor @ 2.10GHz, 4 cores, 16.9 GB RAM, load at start 4.70 3.93 2.63
Node v22.22.0; 4000 rows; 2 runs per size (alternating), one warm-up per kind not reported.
Word: contract of 120 paragraphs, a table, header and footer, 8 tags. Image: 1600x1000 JPEG (quality 85), 4 text boxes, font Liberation Sans.

| Kind | Pool size | Median s | Range s | Rows/s | Failed | ZIP MB | Main-thread lag p99 ms | Lag max ms | Peak RSS MB |
|---|---|---|---|---|---|---|---|---|---|
| word | 3 | 14.6 | 14.4-14.6 | 273 | 0 | 14 | 15 | 85 | 448 |
| word | 4 | 12.6 | 12.3-12.6 | 318 | 0 | 14 | 16 | 52 | 472 |
| image | 3 | 41.8 | 41.4-41.8 | 96 | 0 | 221 | 16 | 63 | 671 |
| image | 4 | 34.8 | 34.2-34.8 | 115 | 0 | 221 | 16 | 65 | 749 |
