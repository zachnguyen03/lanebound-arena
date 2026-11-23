# Lanebound Arena Sandbox — Engineering Plan v1

> **Status:** plan only. No production code in this pass.
> **Date:** 23 Nov 2026 (Asia/Seoul).
> **Sources:** `gdd/lanebound-arena-sandbox-spec-v1.md` (sandbox tooling wins on tooling disagreements) and `gdd/lanebound-arena-build-spec-v1.md` v1.1 (build spec wins on rules). Companion GDDs were not treated as additional sources of truth.
> **Audience:** Anh (stack and open technical choices), Game Designer (rule silences), Project Manager (QA shape).

This plan does not start implementation. Nothing is coded, no repo is created, and no preview is deployed until Anh agrees the stack and the decisions in §3.

---

## 1. Restatement

**Who.** Engineer builds. Project Manager QAs each milestone against sandbox spec §11 plus the proof bar in §8 of this plan. Chief Designer owns remaining art (gap list in §7). Anh settles stack, hosting, and the five decisions below. Game Designer owns rule silences.

**Problem.** The first shippable product is not the career game. It is a lab for the fight layer: a deterministic live sim and fight-layer AI, plus a sandbox where we can pin or randomise players and drafts, watch a match, and run batches to tune gameplay and decisions.

**What we build.** A pure, headless, deterministic sim core shared by Watch and Batch. Milestones in order: **S0** headless core and determinism; **S1** all 14 kits and combat tests; **S2** fight-layer AI, auto-peel, and the six attribute hooks; **S3** scoring, zone, claims, any-unit deny, orbs, buffs, respawn, XP, and a full match to `match_end`. After S3 is green, **S4** (Watch, real art, overlays, decision log) and **S5** (Batch, dashboard, tuning panel, isolation runner) may run in parallel. Same seed plus config must produce a byte-identical event-log digest. Overlays, interpolation, and art must not change it. Named constant presets are local. Official lab bands that fail are reported, not silently patched.

**What we will not build.** Cards, rating, manager / season / roster / awards UI, accounts, a database, audio, multiplayer, netcode, items, gold, shops, a 29-champion roster, fog of war as a camera rule, or the 60×40 MOBA map as a playable mode. We will not delete parked MOBA-map code, restore a tank-only zone deny, or pre-nerf kits to pretty a lab. Mid-match constant edits never apply to a running match.

**Assumptions (until Anh or Game Designer says otherwise).**

- Implement flagged design proposals as written (XP table, OVR weights, mastery curve, hook coefficients, quick draft, player generation, windup / missile / assist windows, W-radii = 0, Tolle W AI, `CLAIM_DENY_DWELL_S` = 0). Keep the flag in code comments and in each milestone report. Do not treat a proposal as more sacred than a locked constant.
- Sandbox matches are Bo1 (extra 15 s, then the `tiebreak` coin). No series, no Bo3/Bo5 replay-on-draw.
- Card loadouts stay empty. The `cards` RNG stream may exist so a later M4 does not reshape the hasher. Card events do not fire. `CONTROL_COEF` stays retired.
- Art working source is the unpacked `champions/` tree, not a second copy from the zip. Placeholders only for missing files, and they must be logged.
- TIME_XP is 11.5 (do not “fix” the paper model that ran at 10).
- A new private GitHub repo is created only after Anh approves the name and stack. Free tiers only.

---

## 2. P0 / P1 / out of scope, and definition of done

### P0 — required to call the sandbox done

- Deterministic headless core, 10 Hz, locked tick order, seeded named RNG streams, Layout B collision, sanctuary as blocked tiles, event log, SHA-256 digest.
- All 14 authored kits and the M1 combat fixtures, with no silent kit edits.
- Fight-layer AI (L1 Fight Call, planner, Unit Brain, Motor, targeting), auto-peel with a recorded denominator, the six attribute hooks plus mastery, tactics presets.
- A complete match: hybrid score, capture, ticks, claims, **any-unit** deny, orbs, buffs, respawn, catch-up XP, first-to-10 / clock / sudden death / Bo1 tiebreak.
- Watch: Layout B at 2×, real champion art (or a logged placeholder), transport 0.5×–8×, pause, single-tick step, overlays that do not change the digest, config export / replay, decision-log death jump (last 5 s of killer and victim).
- Batch 100–5,000, cancel, dashboard with pass/fail and sample sizes, CSV/JSON export, tuning panel over every §15 constant (range-validated, apply on next run only), named presets, isolation runner.
- Proof under `lab/s0` … `lab/s5` in the shape required by §8, and the QA checklist in sandbox spec §11.

### P1 — wanted, not a done-bar

- Snapshot ring for instant scrub (resimulate-from-seed is the acceptable minimum).
- In-browser web workers *in addition* to the Node CLI.
- Packed champion atlas (per-folder `atlas.json` is enough for S4).
- Mid-match tactic change at the next legal reset (nice if cheap).
- Full 4-ban + 10-pick AI draft (`draft: full`). Quick draft is the S3 default.
- Chief Designer P1/P2 chrome: overlay styling, dashboard visual system, setup/tuning polish, arena-specific banners, big-ult slow-mo (viewer-only), minimap.

### Out of scope

- Cards (build spec §10, M4). Reserve an empty HUD card-toast slot only.
- Rating (§11), manager / season / roster / awards / Signature UI (§13, §16, M5).
- Accounts, cloud persistence, a server database, multiplayer, netcode, audio, production motion design.
- Items, gold, shops, a 29-champion roster, user-controlled champion play, fog of war as a camera rule, the 60×40 MOBA map as a playable mode.
- Deleting parked MOBA-map code. Changing locked tunables silently. Restoring `class == Tank` deny. Pre-nerfing kits to force a lab pass.

### Definition of done (one sentence)

The sandbox is done when a human can Watch a seeded Layout B match of the 14 authored champions with speed, pause, step, and AI overlays, replay the same `MatchConfig` to a byte-identical event-log digest, run a 100–5,000 game Batch whose dashboard marks every balance target, edit every §15 constant in a named preset that applies only to the next run, jump from a death to the last 5 s of killer and victim decisions, and every milestone S0–S5 has saved proof that Project Manager can re-run.

---

## 3. Stack proposal

Directional, for Anh to agree. The sandbox spec does not lock a stack. The choice below is the simplest option that keeps a **pure deterministic headless core** shared by Watch and Batch, matches Anh's existing preferences (polished dark-mode UI, Vite + React + TS + Tailwind + shadcn, private `zachnguyen03` repo, Cloudflare Workers free static previews), and makes Project Manager's reruns a one-liner.

### 3.1 Recommendation

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript**, strict, one core library with no DOM, no `node:` APIs, no wall-clock | One typed module imports into Watch, the Node CLI, and tests. Alternatives (Rust/WASM, Python lab + TS viewer) add a second language before S0 is proven. |
| Numeric contract | **Integer milli-units in the core**, not IEEE-754 in the inner loop | See §3.2. Stronger than the build spec's binary64 wording, and safer for byte-identical digests across Node, browsers, and Workers. |
| Seeded PRNG | **PCG32** (or splitmix32) per named stream, counter-based as in build spec §4.1 | Streams: `combat`, `skillshot`, `ai`, `draft`, `tiebreak`, `player`, unused `cards`, viewer-only `cosmetic` (never read in the core). Compare integer thresholds; do not map to a JS float in `[0, 1)` if that float would decide a rule. |
| Tick model | **10 Hz**, `DT` locked at 0.1 s, `t = tick * 0.1` with `tick` as the source of truth | Phases in build spec §4.3, units in stable order (Blue Top…Support, then Red). Projectiles sorted by `(land_tick, spawn_seq)`. Speed controls only change how fast the viewer consumes ticks. |
| Watch UI | **Vite + React + TS + Tailwind + shadcn**, tokens from `mockups/site/tokens.css`, self-hosted Barlow / Barlow Condensed | Matches Anh's earlier product UIs and the existing design language. Dark field `#0B0E14`. |
| Watch renderer | **Canvas2D**, integer nearest-neighbour blit at 2× (44×32 tiles, 36×48 bodies) | Ten units plus props is a small blit list. Pixel art must never be bilinear. PixiJS is optional later if batching hurts; it is not needed for S4. |
| Batch runner | **Node CLI first** | Easier for PM to QA unattended 2,000-game labs. Same `simulate(config)` as Watch. In-browser workers can be added later; they are not required to finish S5. |
| Presets / exports | **`lab/presets/*.json` in the repo** plus UI download/upload; `localStorage` only as a cache | Versionable, second-machine replay works (T3). No database. |
| Preview host | **Cloudflare Workers free (static assets)**, after S4, not blocking S0 | Same pattern as prior previews. The repo must run Watch and the CLI locally without a URL. |
| Test runner | **Vitest** plus the npm scripts in §8 | Same toolchain as Vite. Authority digests always come from the Node CLI, not from a browser. |
| Repo | New **private** GitHub repo under `zachnguyen03` (suggested name `lanebound-arena`), after Anh approves | This box's `/workspace/lol-manager` has no git today. Do not commit the 600 MB art zip pile. Runtime art is pointed at, or copied as needed, from the existing trees. |

Suggested on-disk shape (names can move, the boundaries cannot):

```
sim/            # pure core: tick, rng, combat, kits, AI, scoring, digest
data/           # champion kits, Layout B collision / tile-kind JSON, default constants
apps/watch/     # Vite + React shell, Canvas2D renderer, overlays, log, tuning UI
apps/lab/       # Node CLI: digest, batch, isolation, purity grep helper
lab/s0 … lab/s5 # committed proof (digests, logs, CSV, reports, screenshots)
lab/presets/    # versioned constant presets
assets/         # pointers or trimmed runtime copies; do not fork Chief Designer's trees
scripts/        # npm wrappers documented in §8
```

### 3.2 Determinism and why not JS floats in the core

Build spec §4.1 asks for binary64 and forbids `Math.random()`, wall-clock, unordered map iteration, and “float accumulation that differs by compiler flags.” JavaScript `Number` is binary64, but:

- Transcendental ops and some lib implementations can differ across engines (Node/V8 vs Safari/JSC vs a future Worker runtime).
- Watch will run in a browser; the authority digest and the 2,000-game lab will run in Node. Those must agree.
- Associative reductions (`a+b+c`) and long XP/position integrals are easy to get slightly wrong, and a 1 ULP drift can change a hit roll or a zone occupancy and then the whole log.

**Proposal:** the core stores and steps in **integers**.

- Positions and lengths: **milli-tiles** (1 tile = 1000). Body radius 400, map clamp `[400, 23600] × [400, 15600]`, zone radius 3000, pickup 900.
- Time: **ticks** internally; displayed `t` is `tick / 10`, formatted to one decimal in the event log.
- HP: floor into integer HP after each applied (mitigated) packet, as the build spec already requires, never before.
- XP: milli-XP (11.5 XP/s = 1150 milli-XP per tick).
- RNG: each stream is `hash(seed, stream_id, unit_id or 0, counter++)` → u32; Bernoulli tests are `u32 < floor(p * 2^32)` with a documented mapping, or a fixed 24-bit extract. No `Math.random()`.

The renderer may use floats only to interpolate between two already-committed tick poses. Interpolation must not write sim state. If Anh prefers literal binary64, the fallback is: binary64 in one documented Node version as the *authority*, and Watch must either call that same core via a documented engine or replay an event/snapshot tape produced by the CLI — never treat a Safari digest as canonical.

**Forbidden in `sim/` (enforced by `npm run purity`):** `Math.random()`, `Date.now()`, `performance.now()`, `new Date`, `crypto.getRandomValues`, unordered `Object.keys` / `Map` iteration that affects results (iterate arrays with a locked order instead).

### 3.3 Engineer defaults (not asked of Anh unless he objects)

These are the “pick the simplest option” answers from sandbox spec §14, to be written into the S0 report:

1. **Playfield:** emit or hand-author a **terrain-only Layout B PNG** plus a tile-kind / collision JSON (from `arena-map/build_arena.py` / `metrics.json` rules). Do not use `B-four-pillars-clean.png` as the live floor. A full tile engine is optional and not in S0.
2. **Asset loading (S4):** read `champions/{slug}/` + each `atlas.json` in place. One loader normalises Huntress's nested `animations.idle.blue.right` and later champs' `animations.idle["blue-right"]`. Pack an atlas only if load time hurts.
3. **Timeline:** resimulate-from-seed is the S4 minimum. Add a snapshot ring (every tick, or every 5 ticks) if memory is fine, because death-click should feel instant.
4. **Do not block S0** on a preview URL, a packed atlas, or a database.

---

## 4. Architecture sketch

### 4.1 Boundary

```
+------------------------------+     MatchConfig      +------------------------------+
| apps/watch  (React shell)    | --------------------> | sim/  (pure, headless)       |
|  Canvas2D renderer           | <-------------------- |  tick, combat, kits, AI,     |
|  overlays, log, tuning UI    |   snapshots, events,  |  scoring, rng, digest        |
|  preset import/export        |   decisions, digest   |  no renderer, no I/O,        |
+------------------------------+                       |  no wall-clock               |
                                                       +------------------------------+
+------------------------------+                                 ^
| apps/lab  (Node CLI)         | ---------------------------------+
|  digest / batch / isolation  |   N × MatchConfig → summaries, CSV, JSON, digests
+------------------------------+
```

`simulate(config) -> { result, events, decisions, digest, snapshots? }`. Watch either steps the core live (pausable) or jumps to tick `T` by resimulating (or by reading a snapshot). Batch never imports the renderer or loads canvas assets (acceptance B3).

Decision records are a **separate** stream. They must be deterministic (`decisions_digest`) but are **not** part of the §4.4 event digest, so a richer later log does not break stored digests.

### 4.2 Core data types (logical; storage is JSON / TS types)

From build spec §14 and sandbox spec §8, minus live cards:

- `Champion`, `Skill`, `Effect` — data in `data/`, numbers from build spec §7 and the class growth table (exact fractions such as `200/6`, not `33.3333` decimals in source).
- `Player` — six attributes, mastery map, no required card fields at runtime.
- `SideConfig` / `MatchConfig` — seed, constants (full table or default + overrides), two sides (five resolved players, five slugs, tactics), `draft_mode`, optional notes (ignored by the sim).
- `MatchState` — tick, scores, phase, ten `UnitState`s, projectiles, zone, claim, eight orbs, two buff pads, fights, empty `cards[]`, tactics + pending change, `rng_counters`.
- `Event` — `t`, `tick`, `seq`, `type`, payload as in build spec §4.4. Default log omits per-tick `move`. A parallel deterministic `pos` stream (or lab-verbose `move`) is required for the S0 sanctuary test.
- `DecisionRecord` — as in sandbox spec §6.6.
- `Constants` / `ConstantsPreset` — the §15 table; presets are named diffs.
- `BatchConfig` / `MatchSummary` / `BatchResult` — as in sandbox spec §8.2. `started_at` is file metadata only, never a sim input.

IDs: `team` is `"blue"` | `"red"`; `unit_id` is `"{team}:{slot}"` with slots `top|jungle|mid|adc|support`.

### 4.3 Core modules (`sim/`)

| Module | Responsibility |
|---|---|
| `rng` | Named streams, counters, integer draws. |
| `hash` | `constants_hash`, event-log digest (SHA-256 of canonical JSONL, keys sorted, no `move`, no whitespace variance), `decisions_digest`. |
| `tick` | Phase runner in §4.3 order. The only function that advances time. |
| `map` | 24×16 Layout B: pillars, sanctuaries, bounds, collision, clip. |
| `combat` | Autos, missiles, mitigation, crit, shields, heals, CC / DR / Lock budget, Spellward rule (no v1 source), sanctuary clip. |
| `kits` | The 14 champions as data-driven skills + a thin hook table for unique effects. |
| `ai` | L1 Fight Call, planner, Unit Brain, Motor, targeting, auto-peel. Off or stubbed in S0–S1. |
| `attributes` | Mastery → effective Aim/Execution, the six hooks. |
| `scoring` | Zone capture / ticks / aura, claims and any-unit deny, orbs, buffs, XP / levels, respawn, win conditions. Stubbed in S0 (forced 4:00 end). |
| `log` | Append-only events and optional decisions, canonical serialization. |
| `config` | Validate constants against ranges, resolve pins, freeze exported `MatchConfig`. |

### 4.4 UI / IO (outside the core)

- Watch renderer blits terrain, bodies, props, telegraphs, HUD chrome. Anim frame indices are a pure function of `(unit, anim, t_started, facing)` — no wall-clock.
- Tuning panel stages edits and applies them only by building the *next* `MatchConfig`.
- Lab CLI reads/writes files under `lab/`. It is allowed to use `Date.now()` for ETA and `started_at` on result files, never as a sim input.

### 4.5 Existing code to park (do not delete, do not port into the arena core)

There is **no** existing TypeScript arena sim and **no** git repo under `/workspace/lol-manager`. What exists:

| Path | What it is | Action |
|---|---|---|
| `map/` (`layout.json` 60×40, `map/assets/tileset.png`, `sprites.png`, `atlas.json`, `map/gen/*.py`, `map/archive/`) | MOBA Direction C art generator and walkability grid | **Park.** Reuse only the tileset atlas as a source of floor tiles if we blit a terrain PNG from the arena generator. Do not port the 60×40 grid or minions. |
| `mockups/site/05-live-sim.html`, `05c-live-fullscreen.html`, career pages | Career / MOBA HUD mockups | Park as screens. Reuse `tokens.css` and `fonts/`. |
| `gdd/lanebound-combat-model-v*.py`, `lanebound-arena-model-v1.py`, card models | Paper / balance models, not a runtime | Reference only. Do not translate into the live tick loop. |
| `arena-map/build_arena.py` | Layout A/B/C art generator | **Keep and may reuse** to emit a terrain-only Layout B floor and collision JSON. This is arena art, not the parked MOBA sim. |
| `champions/gen/`, `hud-v2/build_*.py`, other `*/gen/` | Art pipelines | Leave in place. |

---

## 5. S0 acceptance criteria (as the specs state them)

S0 is build spec **M0**. Scope: match state, 10 Hz tick in §4.3 order, seeded RNG (including `skillshot` and `player`), 24×16 movement, pillars, sanctuary as blocked tiles, time XP hook, dummy autos, event log, determinism digest. Champions may be dummy marksmen with only autos. Orbs and full kits are not required, but the XP hook exists.

**Tests (build spec §17 M0, restated in sandbox spec §9 S0 and §11 S0):**

1. **Determinism.** The same `MatchConfig` (seed, lineups, tactics, cards, constants) produces a **byte-identical** event-log digest across two processes and two runs. A third run with `seed+1` differs. Digest = SHA-256 of the canonical event log: JSONL, one event per line, keys sorted, no `move` events, no whitespace variance.
2. Tick count at a 4:00 forced end (no early win) is **2400** (±0, because `DT` is exact).
3. A unit commanded into the enemy sanctuary records **0** positions with centre inside that pad; a `sanctuary_clip` or a blocked path is logged instead.
4. Time XP: a living dummy at 11.5 XP/s, no other income, reaches the authored L2 threshold at the predicted tick.

Lab default seed is `20261122` unless a test says otherwise. Proof: the test command, passing digest files for a documented seed pair, a short report. The PM-shaped wrapper around that proof is in §8.

S0 also starts the purity grep and the “no silent constant edits / no invented unflagged rules” bar, even though those are written under “every milestone.”

---

## 6. Spec silences, ambiguities, and contradictions that block S0–S3

Only items that would force an invention in the core before the relevant milestone is honest. Flagged design proposals that already say “implement this, keep the flag” are *not* listed as blockers. They will be implemented as written and listed in the milestone report.

### For Anh

These are the five decisions that should be settled before (or with) S0. Recommended options are in §3 and repeated in the handover summary.

1. **Language and repo.** Approve TypeScript core + Vite/React/Tailwind/shadcn Watch, new private repo `zachnguyen03/lanebound-arena`? (Recommended: yes.)
2. **Numeric contract.** Integer milli-units in the core vs literal binary64 as written in build spec §4.1? (Recommended: integer milli-units; flag the deviation.)
3. **Batch runner.** Node CLI, web workers, or both? (Recommended: Node CLI first.)
4. **Preset storage.** Repo JSON + download/upload, with `localStorage` as a cache only? (Recommended: yes. No database.)
5. **Preview host.** Cloudflare Workers free static assets once S4 exists, not blocking S0? (Recommended: yes.)

The XP_TO_LEVEL table, OVR weights, hook coefficients, and similar **(P)** values do not need a new call before S0. They will be implemented as written and confirmed in a design pass if the S5 lab misses its flavour timings.

### For Game Designer

**G1. Coordinate convention vs pillar labels (blocks S0 movement and S4 blit).** Build spec §5.1 says “`y` north, origin at the south-west corner,” which would put `y = 0` on the south edge. The same section labels the `y 2–3` pillars **NW** and the `y 12–13` pillars **SW**. The art generator (`arena-map/build_arena.py`) places those exact tiles — `(5,2)`, `(5,12)`, then mirrored — but draws `y = 0` at the **top** of the PNG and calls the `y = 2` cluster north-west (`layout_C` even says “NW L: bar along y=2 and stem down”). `arena-map/notes.md` treats `(8, 1)` / `(8, 14)` as north/south flanks, matching `y = 0` at the top. Tile *numbers* agree; the axis *prose* does not.

*Recommended default if we must unblock:* keep every numeric table as written, treat `y = 0` as the top / north of the 2× playfield image (same as the generator), and treat “origin SW, y north” as a mis-label. Confirm or correct.

**G2. Which phase grants time XP? (blocks S0 test 4.)** Tick order (§4.3) never names a “grant time XP” phase. Phase 10 says units “grant no time XP on the tick they are dead,” which implies a grant happens, but not when relative to clock, deaths, and level-up. Please name the phase and whether a unit that dies this tick gets time XP (the text says no XP while dead; clarify “already dead at the start of the tick” vs “dies during this tick”). Also confirm the L2 predicted tick under the §5.3 table: 140 XP at 1.15 XP/tick → first tick with XP ≥ 140 is tick **122** (XP 140.3) *if* one grant happens after each of 122 clock steps from `t = 0`. That depends on G3.

**G3. Clock start and the 2,400-tick end (blocks S0 tests 2 and 4).** Phase 1 is “`t += 0.1`.” Is the first tick's clock step going from `0.0 → 0.1`, and is `match_start` logged at `t = 0` before any step? After 2,400 such steps `t = 240.0`. Does the forced 4:00 end stop after the tick that *reaches* 240.0, and is that tick included in the 2,400? Please confirm, including when `match_end` is emitted relative to that tick's other phases.

**G4. When do clock-flagged events apply? (blocks S3; the hook is mentioned in S0.)** Phase 1 says scheduled triggers (first orb spawn, match-end times) are *flagged*, “do not apply yet.” It does not say which later phase actually spawns orbs/buffs or evaluates the 4:00 / 4:30 / 4:45 clocks. Please name the phase.

**G5. How is the S0 sanctuary test observed? (blocks S0 test 3.)** Default event logs omit per-tick `move`. Test 3 requires “0 positions with centre inside that pad.” May we record a deterministic parallel `pos` stream (sandbox spec already allows this) or lab-verbose `move`, without including those lines in the §4.4 digest? Also: S0 has no AI, so a scripted motor command into the enemy pad is assumed — please confirm.

**G6. Unit–unit collision (blocks S0 movement if we invent it).** Collision is specified for pillars, map bounds, and enemy sanctuary. Body radius 0.4 is used for bounds and zone distance. There is no rule for unit–unit blocking or stacking, except a 0.3-tile ±y spawn jitter when two would overlap on the pad. Do living units block each other, or may they overlap?

**G7. Orb / buff pickup under Lock and Bind (blocks S3).** §5.7 literally asks “not locked in a way that prevents movement?” then answers: allowed if slowed; not allowed if time-stopped, banished, or dead. May a stunned, knocked up, slept, feared, rooted, or leashed unit still pick up? Recommendation to confirm: **no** if the disable prevents movement or acting (Lock, Bind, time-stop, banish, death); **yes** if only slowed or otherwise handicapped.

**G8. Same-tick zone progress when occupation flips (blocks S3).** Capture progress “pauses while contested, decays at 1.0/s while empty or while the other team has exclusive occupation (the other team also accumulates their own progress).” On a tick that goes from Blue-exclusive to Red-exclusive: does Blue decay and Red accumulate in the same tick, and in what order? Are the two progress bars independent (each 0–3) or a single signed bar?

**G9. Fight centroid and 2v2 “within 6 tiles of each other (max pairwise to centroid)” (blocks S2).** A fight exists when at least two living units per side are within 8 tiles of “the fight centroid (the mean position of all candidate units that have an enemy within 8 tiles).” That set depends on the centroid if we are not careful. Please confirm an evaluation order (for example: candidate = any living unit with an enemy within 8 tiles; centroid = mean of that set; then filter by distance to centroid). For 2v2 escalation, is “max pairwise to centroid ≤ 6” the intended reading?

**G10. Canonical event JSON (blocks S0 digest stability, unless Engineer is allowed to freeze a recipe and flag it).** `t` is “one decimal.” How are integers vs floats written (`8` vs `8.0`)? Are `unit_id` and enums always lowercase? What algorithm is `constants_hash` (recommendation: SHA-256 of canonical JSON of the effective §15 table, keys sorted)? If you do not want to specify this, Engineer will freeze a recipe in the S0 report and treat it as an invention.

**G11. Pending claim on deaths (blocks S3 if we invent a clear).** Phase 10 says to “clear the pending claim only as §5.6 specifies,” but §5.6 only cancels a pending claim when the *other* team opens a new qualifying win. Confirm: deaths do not themselves clear a claim; occupancy at `resolve_at` is what denies.

**G12. Dumping / overlapping displacements (S0–S1).** Knockback, pull, and dash displacements land after ordinary steering, in queue order. If two land on the same unit in one tick, are they applied sequentially in `(land_tick, spawn_seq)`? If a displacement would enter a pillar or enemy sanctuary, is it clipped like a dash (stop at last legal point)?

Items G2, G3, G5, G6, and G1 are the S0 gates. G4, G7–G12 can be answered during S1–S3, but G4 and G7–G9 should not be invented silently.

---

## 7. Art survey and gaps

Inventory checked 23 Nov 2026 (Asia/Seoul) on `/workspace/lol-manager`. This agrees with sandbox spec §5.1. Zips were listed, not unpacked.

### What already exists (list only)

**Champions — all 14 art-complete for a 2D top-down body.** Working source: `champions/{slug}/` for `brannoch`, `calder`, `helvar`, `huntress`, `isra`, `kerrig`, `maelis`, `mirren`, `rhedan`, `saelo`, `sedge`, `tolle`, `torun`, `ysol`. Each has `atlas.json`, sheets, blue/red strips, 64×64 portraits at 1×/2×/4×, 24×24 icons at 1×/2×, and `vfx/`. Huntress atlas keys are nested (`idle.blue.right`); the later 13 use `idle["blue-right"]`. Shared body contract: 18×24 cell, foot anchor (9, 23), 2× display 36×48, integer nearest-neighbour only. Painted 64 px portraits: `champions/portraits/painted/{slug}/`. About 1,339 PNGs and 928 GIFs under `champions/`.

**`Lanebound-champions-all-14.zip`:** packaged copy, 1,131 files under `Lanebound-champions/` (sprites for all 14, portraits, status-glyphs, `art-spec.md`). Do not maintain a second working tree from it. Older split zips (`Lanebound-all-champions*.zip`, batch1–3, portraits, mockups, etc.) are archives, not the S4 source.

**`arena-map/`:** Layout B presentation and references — `B-four-pillars-clean.png` (1128×624), `-grid`, `-legend`, `-sightlines`, `-buff-options`; layouts A and C as reference only; `props-legend.png`, `checks/`, `build_arena.py`, `metrics.json`, `notes.md`. Play size at 2×: 24×16 → 1056×512 floor plus plinth.

**`map/assets/`:** `tileset.png` (966×171), `tileset-guide-3x.png`, `sprites.png`, `sprites-guide-3x.png`, `atlas.json`. MOBA tileset reused for arena floor tiles. Do not use placeholder unit stills once an authored body exists. Minions are out of this mode.

**`hud-v2/`:** Direction C mockups at 1080 and 720 (`C-default`, `C-start`, `C-fight-focus`, `C-event`, `C-edge-dead`, plus A/B experiments), playfield crops, 14 painted 64 px portraits, 28 idle stills (2× blue/red), misc plates (`plate-hex|mark|slow-2x.png`), team crests, `handoff-spec.md`. This is a **MOBA spectator** HUD (gold, towers, Titan/Shrine, ~18:00 clocks). Adapt layout and tokens; do not drop it in.

**Also reusable, not surveyed as a primary tree here:** `mockups/site/tokens.css` and `mockups/site/fonts/` (Barlow, Barlow Condensed, SIL OFL) — required; `banners/final/` kill-family banners — reusable in the Watch feed; `spectator/spec.md` status packing; `cards/` art — out of sim scope, toast slot only.

### Gaps (Chief Designer P0, with Engineer fallbacks)

1. **`arena-map/B-four-pillars-clean.png` is a presentation composite, not a live floor.** Sample units and orbs are baked in. Using it as the Watch playfield would leave ghost orbs and stuck sprites. **P0:** a terrain-only 24×16 floor at 2× (1056×512 plus plinth) and a matching collision / tile-kind map. Until then, blit tiles from `build_arena.py` / the tileset, or emit a PNG from the existing generator — do not pretend the clean composite is a stage.
2. **World-prop sheet** (integer scale, up/empty states): cream-ice XP orb, gold flank buff pad, zone rims (neutral / blue / red / contested) plus centre mark, blue/red sanctuary wash and dotted threshold. Optional empty-pad decals. Gold only on the zone and the 1:30 buff.
3. **A single packed status-icon set** in the spectator plate language (16×18 plate, 14×14 glyph, duration bar) covering every disable and common buff. Missing today as a unified set: sleep, root, knockup, disarm, mute, blind, shield, spawn-shield, and the arena buff. Existing per-kit plates and `champions/batch3/status-glyphs/` are the starting point, not a second language.
4. **Arena HUD frame** at 1920×1080 and a genuine 1280×720, adapted from HUD v2 direction C with MOBA-only elements removed: score/clock, ten team frames (no mana, no items, no CS), zone/claim/orb/buff status, kill feed, empty card-toast slot, Fight Call readout, transport.
5. **Generic telegraph shapes** (line, circle, cone, dash streak, impact spark), team-tinted; per-champ VFX in `{slug}/vfx/` wins when present. Procedural shapes are an accepted fallback and do not change hit math.

P1/P2 as in sandbox spec §5.2 (overlay styling, dashboard/log visual system, setup/tuning chrome, optional banners, big-ult slow-mo that must not change sim `t`, packed atlas, optional minimap). Engineer may ship token-correct austere chrome and procedural props while P0 art is open, but circles-as-champions are not the intended look.

---

## 8. Project Manager QA contract (binding, every milestone S0–S5)

This is in addition to sandbox spec §11. Balance results outside a band are **reported, not patched**. Do not change a default constant or a kit number to make a test green.

### 8.1 What every milestone report must contain

- The **commit** (full hash and short hash) of the code that produced the proof.
- **Exact, rerunnable box commands** for the tests (copy-paste, from the repo root, no hidden env).
- The **event-log digest** for the documented seed (lab default `20261122` unless the test says otherwise) **and** for `seed+1`.
- A **grep proving** there is no `Math.random` or wall-clock (`Date.now`, `performance.now`, `new Date`) in the core (`sim/`).
- The proof saved under **`lab/sN/`** (N = 0…5): digests, test logs, the report, plus that milestone's artefacts (fixture logs, CSV, screenshots as required).
- **Every invented rule or changed constant, flagged**, with before / after / reason. Unflagged inventions or silent retunes fail the milestone.

### 8.2 Repo scripts (so those commands stay simple)

Wired in S0 and kept stable. Suggested npm scripts (names may be bikeshed, the behaviour may not):

```bash
# Unit / fixture tests for the current milestone (and earlier ones that must stay green)
npm test

# Run one config, print the digest, write lab/sN/digest-<seed>.txt
npm run digest -- --seed 20261122
npm run digest -- --seed 20261123          # seed+1; must differ

# Two-process determinism check (same seed twice) + seed+1 differs
npm run digest:check -- --seed 20261122

# Purity grep over sim/ (exit 1 on a match in the core)
npm run purity

# Milestone bundle: tests + digest pair + purity + copy into lab/sN/
npm run lab:s0
npm run lab:s1
# … lab:s5
```

`npm run purity` is a fixed search over `sim/` (and only `sim/`), for example:

```bash
rg -n "Math\\.random|Date\\.now|performance\\.now|new Date" sim/
```

A documented allow-list (if any) lives in the script, not in a hidden comment. The Watch app and the CLI may use wall-clock for UI and `started_at`; that is why the grep is scoped to `sim/`.

`npm run digest` always uses the Node CLI, never a browser. Output includes seed, `constants_hash`, digest, tick count, and `match_end` if any. For S0, a forced 4:00 end is the default test config.

### 8.3 `lab/sN/` layout (minimum)

```
lab/sN/
  REPORT.md            # commit, commands, results, inventions, constants
  digest-20261122.txt
  digest-20261123.txt  # seed+1
  purity.txt           # captured grep (empty/no matches = pass)
  tests.log
  # plus milestone-specific files: event logs, CSV, screenshots, peel denominator, …
```

`REPORT.md` quotes the exact commands and their exit codes so PM can re-run without reading the chat.

### 8.3.1 Lab convention — parked unused pads (`isLabParked`)

Acceptance fixtures often park unused slots so a constructed mid-map scene stays quiet. **Convention (not a build-spec line):** a unit with `auto_next_start_t ≥ 900` is treated as lab-parked (`isLabParked` in `sim/ai/planner.ts`). Parked units stay `Idle` on the pad and are skipped by the §9.2 planner. Live match-start units must not use this sentinel — they follow Hold / Hunt / Starve from t=0. `defaultEvenConfig.ai_enabled` remains `false`; AI-on labs set it explicitly.

### 8.4 Milestone-specific extras (from the specs, not new gates)

- **S0:** commands green; 2,400 ticks at forced 4:00; sanctuary shove log; predicted L2 tick.
- **S1:** fixtures 5–19b green (Huntress Q 139.706 ± 0.02; Aim vs Reflexes 55 / 85 / 25% ± 2, identical replay).
- **S2:** `fight_call` 2v2; chase stops; peel ≥ 70% with denominator; Hold > Hunt > Starve on zone-time and the reverse on orbs (200 even games); digest still stable with AI on.
- **S3:** scripted `match_end.reason`s; any-class deny; empty zone pays; banished unit does not deny; tick pause; orb/buff timings; 0 sanctuary violations on the preview set; no XP on dead ticks; one random-seed full match with a digest.
- **S4:** W1–W5, L1–L4, R1–R4; screenshots; missing-asset list if any.
- **S5:** B1–B3, T1–T4, D1–D4; official lab numbers recorded; out-of-band edges reported with recommended knobs, **not applied**.

---

## 9. Implementation order (reminder, no code in this pass)

S0 → S1 → S2 → S3, each proven before the next sim-core milestone starts. After S3 is green, S4 and S5 may run in parallel. Scaffolding allowed earlier: Chief Designer P0 art and a renderer shell with dummy units after S0; scripted scoring fixtures after S1. Do not start S2 before S1 is green. Do not declare S4 done against a moving combat core.

---

## 10. Files

| Path | Role |
|---|---|
| `eng/sandbox-plan-v1.md` | This plan. |
| `gdd/lanebound-arena-sandbox-spec-v1.md` | Sandbox tooling and done-bar. |
| `gdd/lanebound-arena-build-spec-v1.md` | Rules, kits, AI, constants, M0–M3 tests. |

## GD rulings 23 Nov (binding, Game Designer; to be folded into build spec v1.2)

- **G1** Keep tile numbers. y=0 is top/north row (matches PNG and build_arena.py), x=0 is west. "Origin SW" prose is wrong; pillar names follow the numbers.
- **G2** Time XP in phase 10 (Deaths/respawn), after death checks: every unit alive at END of phase 10 gets 1.15 XP (11.5 × 0.1). Dies this tick: none. Respawns this tick: gets it. Kill/assist XP same phase, before time XP. Level-ups apply right after XP in phase 10; stats affect next tick's damage.
- **G3** Tick 0 = setup only: t=0.0, match_start logged at tick 0, no movement/AI. First step is tick 1 (t 0.0→0.1). t = tick/10; tick 2400 (t=240.0) IS simulated and runs the clock-end check. Integer ticks; t derived for logging (1 dp).
- **G4** Clock-flagged triggers apply in the earliest owning phase, same tick: orb/buff spawns in phase 11 (before pickup check), so a unit already on the pad picks up NEXT tick. Time-limit and sudden-death end evaluate in phase 14 after scoring; a point scored on tick 2400 counts.
- **G5** S0 uses a scripted motor (no AI) driving units at/along the enemy pad, plus a lab-only per-tick position assertion that emits `sanctuary_violation` only on failure (digest unchanged when clean). No pos stream in default logs. Optional debug `pos` stream behind a flag, excluded from the digest, for the S4 viewer.
- **G6** Living units don't collide; they overlap freely. Only pillars, bounds and the enemy sanctuary block. Motor adds soft separation steering (small repulsion within 0.6 tiles, allies only); steering only, never a hard block.
- **G7** Stunned/rooted/slept/knocked-up units still pick up orbs within 0.9 tiles (passive). Only dead, banished or time-stopped can't.
- **G8** Zone progress uses phase-11 occupancy of the current tick (after this tick's movement and deaths). On a flip tick the new state counts for the whole tick: new exclusive occupier starts progress this tick; contested freezes (no decay); decay only when empty. No partial-tick credit.
- **G9** Phase 2.3: (1) candidates = living, non-banished units with an enemy within 8 tiles; (2) centroid = mean of candidate positions (end of last tick); (3) participants = candidates within 8 tiles of centroid; (4) fight exists if ≥2 per side participate; (5) exactly 2v2 escalates if max distance of the four to centroid ≤6 and |A_true − 0.5| > 0.20; ≥3 on either side always issues the call. One centroid per tick; if two clusters qualify, take the one with more participants, ties to the lowest blue unit index.
- **G10** Engineer freezes the recipe and flags it in the S0 report (then it becomes spec): canonical JSON = UTF-8, sorted keys, no whitespace, shortest round-trip numbers, integers unadorned, physical floats (positions, HP) fixed to 4 dp; event lines in seq order joined by \n with trailing \n. constants_hash = SHA-256 of canonical JSON of the effective constants table (name→value, sorted).
- **G11** Deaths don't clear a pending claim. Only the opposing team's qualifying fight win cancels (and replaces) it. A leftover unit in the zone at resolve_at denies it (§5.6).
- **G12** Phase 6: ordinary steering first, then displacements in queue order (land_tick, spawn_seq), each applied and clipped individually against pillars, bounds and enemy sanctuary (stop at first blocking boundary, no slide); next starts from the clipped position. Into enemy sanctuary stops at the threshold; never pushed onto an enemy pad. Knock-up has no displacement.

Engineer note: G10 floats-at-4dp fits the integer milli-unit core (positions/HP stored in milli-units, rendered as 4 dp with a trailing 0) — the rendering rule will be documented in the S0 report.

## Anh's stack decision (23 Nov 11:33 KST)
Approved decisions 1, 3, 4, 5 as recommended. Decision 2 changed: the sim uses plain binary64 numbers, matching the build spec (no milli-units). Determinism rules that follow from this:
- Only +, -, *, /, Math.sqrt, Math.floor/ceil/round/trunc/abs/min/max/sign/fround in the core (IEEE-exact everywhere). No Math.sin/cos/atan2/exp/log/pow (implementation-defined across engines): use explicit deterministic helpers or avoid them.
- Fixed evaluation order: no reliance on Set/Map/object iteration of non-integer keys or on sort stability without a total tiebreak; no Array.sort without an explicit comparator ending in a unique id.
- Physical floats render to 4 dp in canonical JSON (G10).
- The purity grep also bans Math.random, Date, performance.now and the banned Math functions in sim/.
