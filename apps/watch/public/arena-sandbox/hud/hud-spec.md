# Arena HUD — positions and rules (CD-12 P0.4)

Direction C (HUD v2) adapted for the Arena sandbox Watch view and fight lab. Top bar + two team rails + bottom dock; the dock holds objective status, Fight Call and Watch transport. Frames: `arena-hud-1080.png` (1920×1080), `arena-hud-720.png` (1280×720). Component states: `hud-states-1080.png`, `hud-states-720.png`. Machine-readable numbers: `hud-layout.json`. Reference renderer: `gen/hud_lib.py` + `gen/build_hud.py`. All values are screen px, origin top-left, `[x, y, w, h]`.

Tokens (HUD v2, unchanged): field `#0B0E14`, panel `#121722` / `#1A2130`, line `#252E40` / `#3A4660`, text `#EEF2F8`, dim `#A1ACBF`, faint `#8792A6`, blue `#4DA3FF` (dark `#0E1C30`), red `#F5477A` (dark `#2A101C`). Type: Barlow / Barlow Condensed only. Corner radius 0.
**Not used here on purpose:** HUD v2 warn amber `#FFB547` (reads as gold) and bad red `#FF5C6C` (reads as the red team). State is carried by paper-white outline, shape and text. Gold `#F2C14E` appears only in the zone-neutral icon/label and the buff pad icons / "UP" text.

## Regions

| | 1920×1080 | 1280×720 |
|---|---|---|
| top bar | `[0,0,1920,56]` | `[0,0,1280,44]` |
| left rail / right rail | `[0,56,200,856]` / `[1720,56,200,856]` | `[0,44,112,528]` / `[1168,44,112,528]` |
| dock | `[0,912,1920,168]` | `[0,572,1280,148]` |
| playfield region | `[200,56,1520,856]` | `[112,44,1056,528]` |
| **arena map** (terrain PNG 1:1, 2× art) | `[432,194,1056,580]` | `[112,48,1056,520]` (bottom 60 px of the plinth cropped) |
| banner slot (kill banners) | `[804,64,312,44]`, centred x=960, y=66 | `[544,48,192,36]`, centred x=640, compact banners |
| card-toast slot (empty in v1) | `[750,800,420,72]` | `[510,90,260,44]` |
| kill feed (takedown log) | `[1496,194,216,136]` | dock panel `[566,578,220,136]` |

Map to screen: sim point `(x,y)` → `(mx + x*44, my + y*32)` with `(mx,my)` the arena-map origin above. Floor is 1056×512 at both sizes; at 720 the bottom plinth is cropped to 8 px (nothing gameplay-relevant is drawn there). At 720 the banner and the toast slot sit over the north strip of the map between the two north orb pads (x 510–770); both are transient.

## Top bar
Left: crest 32 px at x=16 (mirrored right at x=W-48), team tag (Barlow Condensed Bold 22 / 16 px) and full name (13 / 11 px dim). Centre: blue score (right-aligned at cx-150 / cx-112), clock (cx, 30 / 22 px), red score (left-aligned at cx+150 / cx+112). First-to-10 pips: 10 per side, 14×8 (10×6 at 720), 3 px gap, filling outward from the score. Caption under the clock: `FIRST TO 10 · 4:00`; final minute `FINAL MINUTE · 4:00`; sudden death (4:00–4:30) is an outlined chip `SUDDEN DEATH` in paper white. No tower, Titan, Shrine or gold elements.

## Team frames (ten, five per rail, flush to the rail edge)
Order top to bottom: Top, Jungle, Mid, Carry, Support. Blue on the left rail (team cap on the left edge), red on the right (cap on the right edge).

| | 1080 | 720 |
|---|---|---|
| frame size / gap / first y | 200×120 / 8 / y=168 | 112×96 / 6 / y=56 |
| portrait | painted 64 px at (frame+11, +8) (blue) | 32 px (2×-down of the 64, never 48) at (frame+8, +6) |
| level badge | bottom-left of the portrait, 16 px numerals | 12 px |
| name / role + takedowns | x = portrait+72, y=+7 / +28 | portrait+38, y=+4 / +20 |
| HP bar | 112×8 at y=+50 + `hp / max` text | 100×6 at y=+36 |
| Q, W pips | 14×14 squares at y = bottom-26, 6 px gap | 11×11 |
| R pip | diamond, same row, third slot | same |
| status plate | head-plate for the strongest disable on the portrait's top-right, 2× plate (32×36); `+N` chip to its left | 1× plate (16×18) |

States (see `hud-states-*.png`): Q/W ready = paper fill with team inner square; on cooldown = dark with a rising grey fill (remaining fraction). R ready = team-filled diamond with paper outline + `R READY`; R cooldown = hollow, shrinking; **R locked below L5** = dashed outline + `R at L5`. Low HP (<30%) = team fill with paper diagonal stripes (shape cue, no hue change). Dead = greyed portrait, empty bar, `RESPAWN m:ss` with a grey progress bar. No mana, items, CS or currency anywhere.

## Dock panels

| panel | 1080 `[x,y,w,h]` | 720 |
|---|---|---|
| ZONE | `[16,920,440,152]` | `[8,578,266,136]` |
| PICKUPS (orbs + flank buffs) | `[464,920,480,152]` | `[282,578,276,136]` |
| kill feed | map margin, see above | `[566,578,220,136]` |
| FIGHT CALL | `[952,920,380,152]` | `[794,578,196,136]` |
| WATCH transport | `[1340,920,564,152]` | `[998,578,270,136]` |

* **Zone:** owner icon (stepped cross, rim in gold when unowned, team colour when owned), owner label, who is inside (`1 v 1 in pit`, contested/holding/empty), two capture bars to 3.0 s (blue, red), `NEXT TICK` countdown from 12 s (owned only) and a claim chip `CLAIM · TEAM · s` with an 8 s drain bar when a claim window is open.
* **Pickups:** 8 orb dots (cream-ice `#D2E6EC` = up, hollow with seconds = respawning, 18 s) in the pad order of the atlas, plus the two flank buffs (W pad (7,7), E pad (16,7)): `UP` (gold plus), `HELD` (team plus, holder team + seconds left of 45 s), `COOLING` (seconds to 90 s respawn).
* **Fight Call:** `A_true` split bar (blue | red at A_true), `A_true x.xx` left, `A_commit x.xx` right, state chip `ENGAGE` (2 px paper outline) / `DISENGAGE` / `NO FIGHT`. Note text at 1080 only.
* **Watch transport:** `PAUSE`/`PLAY`, `STEP >`, speed `0.5x 1x 2x 4x` (active = 2 px paper outline), scrub bar to 4:30 with a tick at 4:00 (sudden death), elapsed time and `SEED n`.

## Kill feed / banners
Use only the kill family from `banners/final/isolated/` (`first-blood`, `double-kill`, `triple-kill`, `quadra-kill`, `pentakill`, `legendary`, `streak`, each `-blue`/`-red`), standard size at 1080 and `compact/` at 720. One at a time in the banner slot; the takedown log keeps recording dropped events. `first-tower-*` and `shrine-taken-*` are never used. The names printed inside the banner PNGs are the placeholders from the banner pass; the runtime should render its own text if that matters (not changed here).

## Open questions
1. The 2× map (1056 wide) does not fit HUD C's 720 playfield (960); the 720 layout therefore uses 112 px rails (not 160) and drops the minimap. Confirm that rail width.
2. The takedown log at 1080 lives in the right map margin; at 720 it moves into the dock. Confirm or ask for a different home.
3. The banner PNGs carry placeholder names. If the runtime must show real player names, the banner needs a text-free variant (not in this pass).
