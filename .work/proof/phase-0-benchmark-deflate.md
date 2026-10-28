# Phase 0 benchmark (T-10)

Machine: Intel(R) Xeon(R) Processor @ 2.10GHz, 4 cores, 16.9 GB RAM, load at start 4.31 3.03 1.98
Node v22.22.0; 4000 rows; 3 runs per size (alternating), one warm-up per kind not reported.
Word: contract of 120 paragraphs, a table, header and footer, 8 tags. Image: 1600x1000 JPEG (quality 85), 4 text boxes, font Liberation Sans.

| Kind | Pool size | Median s | Range s | Rows/s | Failed | ZIP MB | Main-thread lag p99 ms | Lag max ms | Peak RSS MB |
|---|---|---|---|---|---|---|---|---|---|
| word | 1 | 42.4 | 41.3-43.6 | 94 | 0 | 11 | 13 | 99 | 389 |
| word | 3 | 15.0 | 14.9-15.3 | 267 | 0 | 11 | 14 | 69 | 565 |
| word | 4 | 13.1 | 13.1-14.6 | 305 | 0 | 11 | 16 | 70 | 481 |
| image | 1 | 115.5 | 111.4-123.0 | 35 | 0 | 190 | 13 | 100 | 695 |
| image | 3 | 41.7 | 40.7-45.1 | 96 | 0 | 190 | 16 | 75 | 779 |
| image | 4 | 35.5 | 34.9-42.6 | 113 | 0 | 190 | 17 | 90 | 815 |
