# Benchmark (T-10, T-33)

Machine: Intel(R) Xeon(R) Processor @ 2.10GHz, 4 cores, 16.9 GB RAM, load at start 4.87 4.13 2.61
Node v22.22.0; 4000 rows; 2 runs per size (alternating), one warm-up per kind not reported.
Word: contract of 120 paragraphs, a table, header and footer, 8 tags. Image: 1600x1000 gradient PNG background, 4 text boxes, font Liberation Sans; image = JPEG quality 85, jpg = JPEG quality 90, png = PNG output.

| Kind | Pool size | Median s | Range s | Rows/s | Failed | ZIP MB | Main-thread lag p99 ms | Lag max ms | Peak RSS MB |
|---|---|---|---|---|---|---|---|---|---|
| jpg | 3 | 37.9 | 36.9-37.9 | 106 | 0 | 221 | 16 | 48 | 722 |
| jpg | 4 | 31.8 | 31.3-31.8 | 126 | 0 | 221 | 17 | 51 | 781 |
| png | 3 | 88.2 | 87.9-88.2 | 45 | 0 | 375 | 16 | 44 | 713 |
| png | 4 | 71.0 | 70.1-71.0 | 56 | 0 | 375 | 16 | 38 | 767 |
