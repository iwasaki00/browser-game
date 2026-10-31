# v1.8.0 Verified flight courses

All results: unchanged fixed step 1/120 s; real goal contact; speed 220; default planet positions. Each row: 1x = 100x exactly, preview = flight exactly. Angles in degrees, time in simulation seconds. Coordinates in world units.

| From | Target | Angle | Speed | Time | Terminal coordinate |
|---|---|---:|---:|---:|---|
| origin | DS01 | -45 | 220 | 11.075 | (2333.626, 7274.796) |
| DS01 | return | -41.06 | 220 | 47.208 | (10565.226, 1100.725) |
| origin | DS02 | -38.22 | 220 | 23.258 | (4729.946, 5895.411) |
| DS02 | return | -45.01 | 220 | 34.900 | (10523.739, 1117.629) |
| origin | DS03 | -17.15 | 220 | 34.233 | (7744.589, 6416.755) |
| DS03 | return | -64.65 | 220 | 28.242 | (10400.776, 1067.488) |
| origin | DS04 | -32.33 | 220 | 45.650 | (9475.774, 4097.021) |
| DS04 | return | -72.65 | 220 | 14.725 | (10458.141, 1112.462) |
| origin | DS05 | -48.08 | 220 | 39.242 | (6536.355, 2693.157) |
| DS05 | return | -24.23 | 220 | 19.442 | (10404.628, 1072.830) |
| origin | DS06 | -71.57 | 220 | 34.192 | (3041.214, 1891.112) |
| DS06 | return | -6.59 | 220 | 34.258 | (10449.186, 891.289) |
| origin | return | -37.69 | 220 | 57.108 | (10462.242, 1113.905) |
| DS01 | DS02 | -34.82 | 220 | 12.425 | (4689.557, 5899.453) |
| DS02 | DS03 | 17.16 | 220 | 14.192 | (7778.801, 6402.273) |
| DS03 | DS04 | -57.8 | 220 | 14.058 | (9434.181, 4075.285) |
| DS04 | DS05 | -151.93 | 220 | 14.983 | (6573.060, 2668.280) |
| return | DS06 | 175.43 | 220 | 33.850 | (3097.052, 1775.898) |

## Playable discovery sequence

origin > DS01 > DS02 > DS03 > DS04 > DS05 > return > DS06 > return. Each goal is legitimately available when selected; a complete physical playthrough, reward unlocks and checkpoint reloads are tested.

Direct return and six separate target/return routes are also verified. Individual geometry tests mark a target as known for that leg; they do not alter the physics or contact result. The full sequence above independently verifies discovery prerequisites. Not every arbitrary pair has been validated; DS05 > DS06 has no verified direct course, so use the return relay. Moving planets requires fresh prediction.
