# Lanebound Arena sandbox art — CD-12

Status: **all P0 items (1–5) are done and checked**, plus a generic **training-dummy body sheet** for the Engineer's Watch view (§9). P1 is untouched. Pillar faces are 11 px.
Layout B Four Pillars, flank buffs at tiles (7,7) and (16,7). All art is 2× fs1440 (tile 44×32), integer nearest-neighbour only. Champion bodies are untouched (18×24 cell, anchor (9,23), 36×48 at 2×).

## 1. Files

| Path | What |
|---|---|
| `terrain/layoutB-terrain-2x.png` | **1056×580**, opaque. Floor 1056×512 (rows 0–511) + plinth (rows 510–579, overlaps the floor by 2 px as in CD-11). Pillars, shadows and decor props baked in. **No** units, orbs, buffs, zone rim, sanctuary wash. |
| `terrain/layoutB-terrain-bare-2x.png` | same, without decor props |
| `terrain/layoutB-props-overlay-2x.png` | transparent, decor only (torches, braziers, moss, rocks, cracks, rune ring, spawn glyphs/crests/banners, pillar lanterns). Already inside the terrain PNG; ship it only if you want a decor toggle. |
| `terrain/layoutB-pillars-2x.png` | the four pillars as separate RGBA sprites for y-sorting (see §3) |
| `terrain/layoutB-tiles.json` | tile kinds (24×16), pillar collision tiles, pad/spawn/sanctuary/zone numbers, pillar sort data |
| `props/world-props.png` + `props/world-props.json` | world-prop sheet 1008×566 + atlas (§2) |
| `status/status-plates-1x.png`, `-2x.png`, `status-plates.json` | **P0.3** 27 status plates + `+1..+9` chips + 14×14 glyph grid, atlas (§5) |
| `telegraphs/telegraphs.png` + `telegraphs.json` | **P0.5** generic telegraph reference art + atlas + the pixel rule (§6) |
| `hud/arena-hud-1080.png`, `arena-hud-720.png` | **P0.4** composed HUD frames |
| `hud/hud-states-1080.png`, `hud-states-720.png` | HUD component states (top bar ×3, frames ×8 states per team, zone ×5, pickups ×3, fight call ×3, transport ×2, banner family, kill feed, toast slot) |
| `hud/hud-spec.md`, `hud/hud-layout.json` | short spec with positions / sizes (§7) |
| `dummy/dummy.png`, `dummy/dummy-2x.png`, `dummy/atlas.json` | **training dummy** body sheet at 1× and 2×, later-champion atlas (§9) |
| `dummy/contact-sheet.png`, `dummy/scene-scale.png`, `dummy/sheets/` | dummy contact, layout-B scale scene, per-anim strips |
| `checks/` | `results.json` (terrain + props), `results-p0.json` (status, telegraphs, HUD), CVD + greyscale sheets for all of them |
| `contact/` | `contact-1` … `contact-6`, `contact-7-dummy`, plus composed scenes (incl. `scene-status-plates`, `scene-telegraphs`, `scene-dummy-scale`) |
| `gen/` | generators. They import `../arena-map/build_arena.py`, which is unchanged (`build_terrain.py` overrides the pillar face locally). Run from `gen/`: `python3 build_terrain.py && python3 build_props.py && python3 build_status.py && python3 build_telegraphs.py && python3 scenes.py && python3 scenes_p0.py && python3 build_hud.py && python3 build_hud_states.py && python3 build_dummy.py && python3 build_dummy_contact.py && python3 checks_world.py && python3 checks_p0.py && python3 contact.py && python3 contact_p0.py` |

## 2. Atlas key format (`props/world-props.json`)

Same shape as the later champion atlases (Maelis style). A loader that already reads `animations[name]["blue-right"]` needs no change: the key is simply a variant name.

```jsonc
{
  "sheet": "world-props.png", "scale": 2, "tile_px": [44, 32],
  "animations": {
    "<name>": {                       // orb | buff | zone | buff-holder-ring
      "<variant>": {                  // up | down | pickup | respawn | held-blue | neutral | contested ...
        "n": 4, "ms": 150, "fps": 6.67, "loop": true, "note": "...",
        "frames": [ { "i": 0, "rect": [x, y, w, h], "anchor": [ax, ay], "hit": false } ]
      } } },
  "sprites": {                        // static art, same entry shape as Huntress `vfx`
    "zone-centre-mark": { "rect": [x,y,w,h], "anchor": [ax, ay], "place_terrain_px": [px, py], "note": "..." } },
  "placements": { "orb_pads": [{"tile":[2,4],"ground_px":[110,144]}, ...], "buff_pads": [...], "zone": {"centre_px":[528,256], "radius_tiles":3.0} },
  "draw_order": [...], "zone_recipe": {...}
}
```

* Anchors are in 2× sheet px, relative to the frame rect. Blit at `(world_px - anchor)`. All rects, sizes and anchors are even (2× grid), checked.
* The anchor is the **ground point** (pad centre, zone centre), not the visual centre. The orb and the buff plus hover above it.
* Tinted variants use `blue` / `red` (zone) or `held-blue` / `held-red` (buff), so a loader that builds `"{tint}-{facing}"` keys can map them without a fork.
* Asset ids for the missing-asset badge are `<name>.<variant>` for animations (`orb.up`, `buff.held-red`, `zone.contested`) and the key itself for sprites (`zone-centre-mark`, `sanctuary-wash-blue`). Fallbacks per spec 5.4 stay procedural.
* `sprites.zone-*`, `sanctuary-*` carry `place_terrain_px`: where the sprite's top-left goes in the 1056×580 terrain space (they are fixed-position overlays).

### Contents

| Id | Frames | Use |
|---|---|---|
| `orb.down` | 1 | empty pad decal (etched ring, no dark fill). **Always draw it**, so a collected orb never leaves a hole. |
| `orb.up` | 4 @150 ms loop | cream-ice orb hovering 7 px (1×) over the pad, baked soft shadow |
| `orb.pickup` | 4 @80 ms | burst on `orb_pickup` |
| `orb.respawn` | 4 @120 ms | optional pre-spawn telegraph (viewer-only), ends on the `up` pose |
| `buff.down` | 1 | empty / cooling pad. Not gold. Base for every buff state. |
| `buff.up` | 4 @160 ms loop | gold plus hovering over gold-studded pad (the 1:30 buff) |
| `buff.held-blue` / `held-red` | 1 | pad while the buff is held and the pad cools. Hollow plus + studs in the taker's team colour |
| `buff.spawn` / `buff.pickup` | 5 / 4 | 1:30 spawn flare, take burst |
| `buff-holder-ring.gold` | 2 @300 ms | **optional** dotted gold ring under the holder (off by default; the status plate is the main cue) |
| `zone.neutral` / `blue` / `red` / `contested` | 1 / 1 / 1 / 2 @400 ms | 264×192 rim + wash overlay for the zone. Neutral: white rim + gold rim + gold wash. Owned: white + team + thin gold. Contested: white + blue/red 2×2 checker (swaps), gold wash. |
| `zone-centre-mark` | 1 | 12×12, on the exact pixel corner (528,256); draw above the rim |
| `sanctuary-wash-blue/red` | 1 | 88×512 flat team wash (α 28) |
| `sanctuary-threshold-blue/red` | 1 | 2×512 dotted line, 4 on / 4 off, inside each sanctuary at its inner edge so the pair mirrors exactly (CD-11 drew them one px off) |

Zone rim is authored at `ZONE_RADIUS = 3.0`. For another radius, regenerate with `build_props.py:zone_overlay()` or port the rule in `zone_recipe` (peel 2 px bands inward from the stepped pit tile mask). The sim zone is a true circle; the art is the tile-stepped cross from CD-11.

## 3. Draw order and coordinates (what S4 needs)

1. `layoutB-terrain-2x.png` at (0,0).
2. `sanctuary-wash-*`, `sanctuary-threshold-*` at their `place_terrain_px`.
3. `zone.<state>` at `sprites.zone-neutral.place_terrain_px` = (396,160), then `zone-centre-mark`.
4. For each orb pad: `orb.down`; if up, `orb.up`. For each buff pad: `buff.down|up|held-*`.
5. Units, shadow ellipse and team ring (renderer), **y-sorted against the pillars**: draw a pillar sprite after every unit whose `foot_y_px < pillars.<id>.sort_y_px`, and before units at or beyond it. Sprite goes at `blit_at_terrain_px`. `sort_y_px` is the pillar footprint's south edge (NW/NE 128, SW/SE 448).
6. Pickup / flare animations, `buff-holder-ring` under its unit, then HUD.

Positions: sim point → terrain px is `px = x*44, py = y*32` (y down, row 0 at top). Pad ground point for tile index (tx,ty) is `((tx+.5)*44, (ty+.5)*32)`; the atlas `placements` list them. Collision: `layoutB-tiles.json → collision.pillar_tiles` (16 tiles). Props never block.

### Questions / decisions for the Engineer and Anh
* **Pad coordinates.** Art draws named pads `(2,4)`, `(7,7)`, `(1,7)`… at the **tile centre** (+0.5), which keeps left/right mirror (x ↔ 23−x). Build spec 5.1 says named points are centres but the zone is `(12, 8)`, a geometric centre. If the sim uses the integers raw, orbs and buffs would sit a half tile off and the right side would not mirror the left. Recommend the sim use `(x+0.5, y+0.5)` for pads.
* **Y axis.** Build spec 5.1 says `y` is north with origin south-west. The art is y-down with row 0 at the top. The map is mirror-symmetric in y except the spawn pads and buffs (row 7): y-flipping the art would move them to row 8. Recommend the renderer treat sim `y` as screen-down (no art change).
* **Pillar face overhang (fixed in this pass).** Faces are now 11 px tall, equal to the raise of the top, so the face ends at the collision footprint. Pixels only: collision and `sort_y_px` (128 / 448) unchanged. Pillar sprites are 88×75 (were 88×108); `blit_at_terrain_px` unchanged (NW [220,53], NE [748,53], SW [220,373], SE [748,373]); `layoutB-tiles.json` has `pillar_face_px: 11`. The CD-11 PNGs in `arena-map/` still have the old tall faces (not touched). Pillar lanterns were re-fitted to the shorter face.

## 4. Check results

Tools: `gen/checks_world.py` (full numbers in `checks/results.json`).

* **WCAG contrast** (graphical objects need 3:1; small text 4.5:1). Worst case over jungle/lane/plaza/pit/bases: orb body 7.82, buff gold 6.01, zone white rim 8.82, zone gold rim 6.01, blue on its floors 4.67, red 3.54. All pass 3:1. Orb and plus also carry a 1 px `#0E1018` outline (14.7:1 to the orb, 11.3:1 to gold). The empty buff pad plate is deliberately about 1:1 with the lane in luminance: it is read by its outline, lip and studs, not brightness.
* **CVD** (Machado 2009, severity 1.0; ΔE ≥ 20 = distinct). Blue/red 48.4 min (protanopia). Blue/gold 70.5 min. Red/gold 47.9 min. Orb/gold 42.9 min, orb/blue 35.5, orb/red 36.7 min. Only orb vs white rim is under 20 (4–9): orbs never touch the zone rim and differ in shape and outline. Sheets: `checks/cvd-grey-*.png`.
* **Greyscale.** Blue and red are only 1.32:1 in luminance, so in greyscale team identity relies on shape (facing, ring, banner, dotted threshold), as in the map spec. The contested rim keeps its white outer rim and checker. Red sanctuary wash nearly vanishes under deuteranopia and protanopia, but the dotted threshold and spawn banners stay.
* **Colour budget.** Gold pixels appear only in `zone.*`, `zone-centre-mark`, `buff.up`, `buff.spawn`, `buff.pickup`, `buff-holder-ring`. Zero in terrain, orbs, `buff.down`, `buff.held-*` and sanctuaries. Team colour pixels appear only in sanctuary, zone and `buff.held-*`. Scripted, no violations.
* **Salience** (on four composed scenes with 10 champions, orbs and buffs; `measure_salience` from CD-11 plus bright-pixel counts):
  * zone white rim Y 0.868 > orb body ≈ 0.77 > zone gold rim 0.576 > pillar tops 0.273 mean (peak 0.418) > decor props 0.05 mean (peak 0.187). Zone rims are above the walls and decor props are below them in every scene.
  * bright-pixel mass (Y > 0.45): zone region 3672 / 2068 / 3660 / 3418 (neutral+start / contested / blue / red scenes) vs all orbs 1200–1920 and buffs 0–232. The zone is the largest bright mass in every state. Tightest case is the contested zone (about 1.7× the orbs), because the gold half of its rim becomes blue/red.
  * An orb is brighter than the gold half of the rim but about 15× smaller than the whole zone ring. That is the CD-11 cream-ice orb, unchanged.
* **Structure.** Terrain 1056×580 opaque, 0 gold px. Every atlas rect inside the sheet; all sizes and anchors even (2× grid). Pillar y-sort verified on a test scene.

## 5. Status-icon set (P0.3)

`status/status-plates-2x.png` (256×328) and `status-plates-1x.png` (128×164); the 2× sheet is the 1× sheet scaled ×2 nearest-neighbour. Plate language of `spectator/spec.md §2`: 16×18 plate at 1× (16×16 content, 1 px rim `rgb(110,122,148)`, fill `#121722` α230, 14×14 glyph at (1,1), 2 px duration bar in rows 16–17 whose accent runs x 1..15 with x 0 as the track; the runtime clips the remaining fraction).

Layout: 8-column plate grid (27 plates, order below), nine `+1..+9` chips, then a 14×14 glyph grid. Atlas key shape (`status-plates.json`): `sprites["status-<kind>"] = {rect (2× px), rect_1x, anchor [16,36] (bottom-centre), anchor_1x, group, category, sim_kind, priority, bar_rgb, source}`; `status-<kind>-glyph` (28×28 @2×) and `status-plus-N` for chips. Asset id = the sprite key. `head_rule` in the JSON documents the display rule: **one plate per unit** = strongest disable (lowest priority number, ties by longest remaining); everything else folds into `+N` (capped +9); no disable → mark, then buffs by priority (spawn-shield first); ground CC (root loop, slow chevrons) stays at the feet. Plate block centred on the unit's foot x, bar bottom 2 px above the initial tag, no leader lines. Demo: `contact/scene-status-plates.png`.

Kinds (priority bands): 1 hard lock `stun, knockup, petrify, timestop, banish, hex` · 2 `sleep` · 3 `fear, taunt, silence, disarm, blind, mute` · 4 `root, leash` · 5 `break, slow` · 6 `mark` · buffs 7–15 `spawn-shield, shield, arena-buff, zone-aura, spellward, mitigation, regen, amp, haste`.
* **Reused** (copied, nothing redrawn): stun, slow (Brannoch), fear (Calder), break, leash (Kerrig), taunt (Torun), silence (Ysol), hex, petrify, banish, timestop (batch3 plate-0), mark (HUD v2 `plate-mark-2x`, asserted to be an exact 2× and halved).
* **Drawn new** in the same language: sleep, root, knockup, disarm, mute, blind, shield, spawn-shield, mitigation, arena-buff, zone-aura, regen, amp, haste, spellward.
* **Decision:** the reused batch3 `timestop` and `hex` plates carried gold-ish pixels. Gold is zone/buff only, so exactly those pixels are re-mapped to ivory at the same luminance (same shapes). Gold now appears only in `arena-buff` and `zone-aura` (bar + glyph), which are zone/buff signals.

## 6. Telegraphs (P0.5)

`telegraphs/telegraphs.png` (1100×538) + `telegraphs.json`. Same key shape as the champion atlases: `sprites["telegraph-<shape>-<params>-<blue|red>"] = {rect, anchor, shape, params, team, note}` (anchor = caster origin point inside the rect); `animations.impact.blue|red = {n:4, ms:60, frames:[{i, rect, anchor:[16,16], hit:false}]}`. Sprites: circle r 1.0 / 1.5 / 2.0 / 3.0, line (w 0.45 L 6; w 1.0 L 4), cone (half 30° L 3; half 45° L 2.5), each in blue and red; dash L 3 (blue, red, ivory); impact; 8×12 team pin. All rects, sizes and anchors even.
The sheet is reference art. The **rule** is in `recipe` and implemented in `gen/telegraph.py` (`render`, `dash_streak`, `impact_frames`, `pin`), so any radius / width / length / angle gives the same look: shapes are defined in world tiles and mapped through the 44×32 tile (a circle of radius r is an ellipse r·44 × r·32). Fill = 2×2-px checker (50%) in the caster's team colour, α 80. Rim = 2 px inside the edge, dotted 4-on/4-off, team colour +30% lightness, α 230. Dash = 3 chevrons, 3 px thick, α 255/190/110, team tint or ivory, never gold, fades over 200 ms. Impact = cream `#FFF0C8` 8-point star with white core, 4 frames, then the pin. **Sanctuary clip:** every telegraph is clipped to the board minus the *enemy* sanctuary columns (blue casts clip at x ≥ 22·44, red at x < 2·44); verified in `contact/scene-telegraphs.png` (blue r3 circle ends at the red sanctuary, red r2 at the blue one). Per-champion VFX win when present. Telegraphs are viewer-only and never touch sim state.

## 7. Arena HUD (P0.4)

See `hud/hud-spec.md` for every position and size. Summary: direction C (top bar, side rails, bottom dock) at 1920×1080 (56 / 200 / 168) and 1280×720 (44 / **112** / 148). The 2× map is 1056 px wide, which does not fit HUD C's 960 px 720p playfield, so the 720 layout narrows the rails to 112 px and uses 32 px portraits (2×-down of the 64 painted ones, never 48). Contents: score and clock bar with first-to-10 pips and a sudden-death state; ten team frames (portrait, name, level, HP, Q/W squares and R diamond with ready / cooldown / locked-until-L5, respawn clock, head-plate status); zone / claim / orb / buff status; kill feed using the existing kill banners plus a takedown log; empty card-toast slot; Fight Call (`A_true`, commit); Watch transport (speed, pause, step, seed). None of: gold currency, towers, Titan, Shrine, mana, items, CS. The HUD v2 warn amber and bad red tokens are deliberately not used (they collide with gold and the red team).

## 8. Check results (this pass)

Terrain/props checks re-run on the short-face terrain with identical results to section 4 (zone leads every scene; no gold or team-colour violations; every rect inside the sheet and on the 2× grid). New, from `gen/checks_p0.py` → `checks/results-p0.json`:

* **Status.** 27 kinds, all rects inside the sheet, all sizes/anchors even, no identical plates. Closest silhouettes: `shield`/`mitigation` (same outline, hollow + chevron vs solid, mean grey diff 72), `shield`/`spawn-shield` (solid vs checker, 44), `zone-aura`/`spellward` (28); no pair is indistinguishable in greyscale (IoU > 0.95 and grey diff < 4: none). Glyph key strokes (75th percentile) vs plate fill: min 3.88:1 (leash), petrify 4.27, slow 5.53, all others ≥ 7.5. Plate rim vs floors 2.3–3.9:1 (plaza lowest), so the plate reads by its dark fill and rim together, as in the spectator spec. Bar colours are informational only (glyph is the primary cue): min ΔE 6.3 normal, 3.3 deut, 1.4 prot, 1.8 trit. Gold only in `arena-buff` and `zone-aura`; no team-colour pixels. Sheets: `checks/cvd-grey-status-sheet.png`, `cvd-grey-status-plates.png`.
* **Telegraphs.** Rim vs floor ≥ 3.6:1 worst case (red on plaza), 4.3–7.3 elsewhere; fill is a tint only (1.3–1.8:1, by design). Blue vs red rim ΔE 66.8 / 48.1 / 31.0 / 93.4 (normal / deut / prot / trit), blue/red rim luminance ratio 1.28, so team in greyscale leans on the caster's ring and side. 0 gold pixels. Sanctuary clip: 0 blue-cast px inside the red sanctuary and 0 red-cast px inside the blue one on the demo scene. Salience: telegraph rims are Y 0.49 (blue) / 0.38 (red) vs zone white rim 0.87; with six telegraphs, two dash streaks and impacts over the contested scene the zone window goes from 2068 to 2433 bright px, telegraphs add 32 bright px outside the zone, so the zone is still the largest bright mass. Sheet `checks/cvd-grey-telegraphs.png`.
* **HUD.** Text contrast (WCAG): text 15.96:1 on panel, dim 7.83, faint 5.71 (5.13 on panel 2), team blue 6.83, team red 5.18 (4.65 on panel 2), gold 10.68; every combination ≥ 4.5:1. Smallest text: 13 px at 1080, 11 px at 720 (Barlow). Gold outside the zone panel, pickups panel and the arena map (art-free chrome scan, portraits/crests/banners masked): 0 px at both sizes. Banned-word scan over all 625 text strings drawn (tower, titan, shrine, mana, item, cs, gold, minion, …): none. Banners used are the kill family only. Salience over the whole frame (264×192 window, Y > 0.45): zone window 2068 px vs strongest other window 1427 (1080) / 1187 (720), ratio 1.45 / 1.74, so the zone still leads once the HUD is on. Layout: map inside the playfield region, dock panels inside the canvas, none overlap. CVD + greyscale sheets: `checks/cvd-grey-hud-1080.png`, `cvd-grey-hud-720.png`. The red/blue difference in greyscale is as weak as in the map (1.28–1.32:1), so each team frame also carries a left (blue) or right (red) cap and the rails sit on opposite sides.

## 9. Training dummy (Watch-view follow-up)

A generic straw-and-wood post dummy that replaces the Engineer's labelled placeholder circles. It is not one of the 14 champions: X-stitched sack head, bone (not gold) chest target, stick arms with straw tufts, a wooden post in a heavy iron-bound base. No face, no legs. Team colour is only on a waist sash and a 1 px ring on the base.

| Path | What |
|---|---|
| `dummy/dummy.png` | 1× master sheet, 153×401. Four bands (blue-right, blue-left, red-right, red-left), one row per animation (idle, move, hit, death), frames left to right, 1 px gap and 1 px margin — same pack as Sedge / Maelis / Ysol. |
| `dummy/dummy-2x.png` | exact ×2 nearest-neighbour of the 1× sheet (306×802). Cell becomes 36×48, anchor (18, 46). |
| `dummy/atlas.json` | later-champion key shape (see below) |
| `dummy/sheets/{idle,move,hit,death}-{blue,red}.png` and `@2x` | canonical-facing strips (blue=right, red=left), 1× and 2× |
| `dummy/contact-sheet.png` | 4× animation strips, 1×/2× scale row against Brannoch and Huntress, plus the layout-B scene |
| `dummy/scene-scale.png` | layout B, dummy states (idle, move, hit, death) next to Brannoch (blue) and Huntress (red) |

**Atlas keys.** Same shape as the later champion atlases (Maelis / Sedge style):

```jsonc
{
  "cell": [18, 24], "anchor": [9, 23], "sheet": "dummy.png", "sheet_2x": "dummy-2x.png", "scale": 1,
  "bands": ["blue-right", "blue-left", "red-right", "red-left"],
  "animations": {
    "<name>": {                    // idle | move | hit | death | walk
      "<variant>": {               // blue-right | blue-left | red-right | red-left
        "n": 4, "ms": 125, "fps": 8, "loop": true, "note": "...",
        "frames": [ { "i": 0, "rect": [x, y, 18, 24], "anchor": [9, 23], "hit": false } ]
      } } }
}
```

The 1× sheet is canonical (as with the champion atlases). Multiply `rect` and `anchor` by 2 to index `dummy-2x.png`. Blit at `(round(sx)-9, round(sy)-23)` at 1×, or `(round(sx)-18, round(sy)-46)` at 2×. Blue faces right and red faces left on the live map; both facings are in the sheet so the engine can face movement. Asset id is `<name>.<variant>` (e.g. `idle.blue-right`, `death.red-left`).

* **idle** — 4 frames @125 ms, 8 fps, loop. Straw tufts and the sash end sway 1 px; the post stays planted.
* **move** — 6 frames @100 ms, 10 fps, loop. The whole dummy is scooted: the base slides 1 px, the post wobbles; there are no legs. `walk` is a copy of `move` for loaders that share the champion walk key.
* **hit** — 3 frames @83 ms, 12 fps, one-shot. Recoil lean, straw puff, 1 px cream flash (not gold).
* **death** — 8 frames @125 ms, 8 fps, one-shot; last frame holds. Wobble, straw bursts, the post tips to the facing side, the sack slumps onto the ground.

Generator: `gen/build_dummy.py` + `gen/build_dummy_contact.py`.

**Checks** (`gen/build_dummy_contact.py` → `checks/results-dummy.json`, sheets `checks/cvd-grey-dummy-scene.png` and `cvd-grey-dummy-sprites.png`):

* Structure: every frame is an 18×24 cell with anchor (9,23), all rects inside the sheet. The 2× sheet is an exact nearest-neighbour scale of the 1× sheet.
* Gold: 0 gold-ish pixels on any frame.
* Team colour is present on every frame and is at most 2.1% of the body (sash + base ring only).
* Contrast (graphical 3:1): lit burlap 3.69, straw 4.64, bone target 6.51, sash blue 3.84, all vs the key floors. Sash red vs plaza is 2.91 (just under); the sash is read against the dark sack, not the floor. Lit wood vs plaza/lane is 2.25–2.74; mid wood is a volume shadow (1.4–2.3). The dummy is read by its `#0E1018` outline, straw tufts, bone target and sash, the same way champion mid-tones rely on the outline.
* CVD (ΔE ≥ 20): every watched pair (wood/straw/burlap/bone vs gold; blue sash vs red sash; wood vs either sash) is ≥ 20 in normal, deuteranopia, protanopia and tritanopia. Straw was shifted slightly taupe so it does not collapse toward gold under tritanopia.
* Greyscale / CVD sheets as above. Blue and red sashes still lean on luminance plus the side of the map and the team ring under the feet, as with the champions (blue/red luminance is ~1.3:1).
* Salience on `scene-scale.png` (zone owned by blue, two champions, six dummy states including a corpse): zone region 3406 bright px (Y > 0.45) vs 1736 in the rest of the frame. A 264×192 window around the zone is 8.43× the strongest other window. Zone white-rim Y is 0.868 vs the dummy's bone 0.507 and lit wood 0.184. The zone stays the most salient element.
* Silhouette: mask IoU of the idle dummy vs all 14 champion idle bodies, both canonical facings. Closest is Isra at 0.70, then Huntress 0.67 — expected for any two mid-width 18×24 bodies that share a torso overlap. The dummy still reads as a post (T-arms, no legs, X head, round base) and is not mistakable for a champion in the scale scene.

## 10. Open questions

1. **Pad coordinates** and 2. **Y axis**: as in §3, unchanged; engineer decision.
3. **720 rails.** Rails are 112 px (HUD C used 160) because the 2× map is wider than C's 720 playfield. Confirm, or ask for a 1× map at 720 (that needs separate art, so it is not done).
4. **Takedown log home**: right map margin at 1080, dock at 720.
5. **Banner PNGs** carry placeholder names; a text-free variant would be needed for real names.
6. **Gold-looking pixels in reused plates** (timestop, hex) were remapped to ivory; if you want the original batch3 art back for champion kits, the original plates are untouched in `champions/batch3/`.
7. **Telegraph pin** is 4×6 (1×) as in the spectator spec; it is small by design.

## Not done
P1 items (untouched, as asked). No spectator-view minimap, no Fight Call replay, no text-free banners.
