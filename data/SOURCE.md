# Data provenance

## What is here

| File | Coverage | Rows |
|---|---|---|
| `atp_matches_1991.csv` … `atp_matches_2024.csv` | 34 seasons, ATP main-tour singles | 108,375 matches (98,050 with serve statistics) |
| `atp_players.csv` | Player reference table | 65,989 |
| `atp_rankings_current.csv` | Weekly ranking snapshots, 2024 only | 92,341 |

Serve statistics (`w_ace`, `w_bpSaved`, `w_bpFaced`, …) begin in **1991**. Earlier
seasons exist upstream but carry no stat block, so they are not vendored here.
Roughly 10% of rows across the range have an empty stat block and are excluded by
the Clutch Index pipeline.

## Where it came from

Fetched from an independent mirror on 2026-08-26:

    https://raw.githubusercontent.com/farhadGithub/tennis-atp-data/main/data/raw/

The original upstream repository, `github.com/JeffSackmann/tennis_atp`, **has been
removed from GitHub**. That is why these files are vendored into this repository
rather than fetched at build time: the build must not depend on a source that has
already disappeared once.

All 34 files were verified on fetch to carry a header identical to the 2024
reference and exactly 49 comma-separated fields per row.

## Licence

Originates from **Jeff Sackmann** (github.com/JeffSackmann), published as
`tennis_atp` under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0**
(CC BY-NC-SA 4.0).

Anyone reusing this data must credit Jeff Sackmann, keep the same licence, and
**not use it commercially** without permission from the original author. This
project is non-commercial and shares alike.

## Regenerating

    npm run data:fetch      # re-download (skips existing files unless --force)
    npm run build:clutch    # recompute src/data/clutch/*.json
