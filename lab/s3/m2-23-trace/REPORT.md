# M2-23 trace — tip `9b579e0` (S3-R5-12 / S3-R5-13)

**Branch:** `cursor/s3-m2-23-trace-1498` (scratch; not `s3`)  
**Setup:** `ai_enabled: true`, `forced_clock_end: false`, both teams same preset, `defaultEvenConfig` picks/attrs.  
**Metric (S3-R5-13):** zone-time = `control_time` (seconds owned, exclusive). `zone_tick` and deny-time reported ungated.

## Batch (N=40, seeds 20261122…61) — direction preview

| Preset | mean control_time (blue) | SE | zeros | mean orbs (blue) | SE | zeros | mean zone_tick (blue) | SE |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Hold the Pit | 54.41 | 2.86 | 0/40 | 0.10 | 0.05 | 36/40 | 4.18 | 0.27 |
| Hunt | **0.00** | 0 | **40/40** | **0.00** | 0 | **40/40** | 0.00 | 0 |
| Starve | 0.00 | 0 | 40/40 | 20.35 | 0.91 | 0/40 | 0.00 | 0 |

Matches the PM shape (Hold ≫ Hunt = Starve on zone proxy; Starve ≫ Hold ≥ Hunt on orbs). **Hunt at 0 control_time and 0 orbs is a defect under S3-R5-13 / L1111.**

---

## Per-preset objective timeline

### Hold the Pit (`planObjective` → `HoldZone` @ zone centre / friendly rim)

**Spec:** §9.2 L1109 — ≥2 bodies occupy or walk to the zone when capturable/owned; Marksmen/Enchanters hold the rim.

**What the planner does:** Frontliners (Tank/Fighter + top holders) waypoint `(12,8)`; Marksman/Enchanter rim at `±(ZONE_RADIUS+0.5)` → blue rim x=8.5 (just outside r=3).

**Sample seed 20261122**
| t | Event |
|---|---|
| 0.1 | All blue → `HoldZone` @ (12,8) or rim (8.5,8) |
| 2.1–2.3 | First Fight Call; Chase/Kite through the pit |
| 42.7 | `zone_capture` blue (after exclusive occupation windows) |
| 54.6, 66.6 | blue `zone_tick` (+1 score each; 12 s exclusive) |
| 75.5 | `zone_capture` red |
| 87.4…123.4 | red `zone_tick` ×4 → red first_to_10 |

control_time blue 29.2 / red 48; orbs blue 0. End `first_to_10`.

**Cause of low zone_tick (~4/match) while control_time is ~50s:**  
`ZONE_TICK_S = 12` → one `zone_tick` per 12 s of owned-exclusive time. 50/12 ≈ 4. **Not a planner defect** — scoring cadence (L270–274 / §5.5). Classify **(b)** for “zone_tick looks low”; the gated metric is control_time.

**Orbs:** Hold almost never leaves the pit for edge pads → mean orbs ~0.1. Spec-conformant for Hold; Starve ≫ Hold is expected. Classify **(b)** for Hold’s low orbs (knob would be “divert to orb on path”, but Hold’s job is the pit — L1109).

---

### Hunt (`planObjective` → `Approach` @ nearest non-sanctuary enemy)

**Spec (S3-R5-13 / L1111):** Hunt contests the zone, sometimes owns it after a won fight, and takes orbs on its path. **Hunt at 0 control_time or 0 orbs is a defect.**

**What the planner actually does:** `huntWaypoint` only returns the nearest living enemy (else enemy pad). No zone waypoint. No orb divert.

**Sample seed 20261122 (and 23, 30 — identical shape)**
| t | Event |
|---|---|
| 0.1 | All blue → `Approach` @(22.5, 7.5) (red pad) |
| 2.1 | Chase toward red line |
| 2.2+ | Fight Call; teams lock at **hold_dist across the pit** |
| 10…240 | blue cluster ≈ (8.1–8.8, 6.6–9.1), red ≈ (15.6–15.9, …) — **both outside ZONE_RADIUS 3** (d≈3.16 from centre) |
| — | `blueIn=0`, `redIn=0` every sampled tick; **0 captures, 0 zone_tick, 0 orbs** |
| end | `coin_flip` at 0–0 |

Combat positioning (hold_dist / kite) parks both sides on opposite rims **without entering** the zone. 1132 fight_calls, zero occupation ticks.

**Root cause — (a) planner/behaviour bug against L1111:**  
Hunt never has a zone-contest or orb-on-path objective. Chasing alone + hold_dist leaves bodies at d>3 from `(12,8)` forever, so they never capture, never accrue control_time, never walk edge pads.

**Proposed fix (do not apply on this scratch branch):**  
In `sim/ai/planner.ts` / brain out-of-fight path for `hunt`:
1. Contest: when the zone is empty or enemy-owned and the unit is not in an active local melee, waypoint through / into the zone (centre or a point on the path to the enemy that lies inside `ZONE_RADIUS`) so Hunt actually occupies and can capture after a won fight.
2. Orbs on path: if an up orb lies near the unit’s current path to its hunt target (within a geometry derived from `ORB_PICKUP_R` / movement, not a gate-tuned constant), divert with `CollectOrb` then resume hunt.
3. Do **not** add per-preset score thresholds aimed at M2-23.

---

### Starve (`planObjective` → rim before `ORB_FIRST_SPAWN_S`, then nearest own-side orb pad)

**Spec:** §9.2 L1111 — a body walks in to pause the enemy tick timer, then out; L1117 orb assignment. Orbs are Starve’s primary farm.

**What the planner does:**
- t < 8 s: waypoint rim `±(ZONE_RADIUS+0.2)` → blue x=8.8 — **outside** the zone (need ≤3.0).
- t ≥ 8 s: nearest own-side orb pad ([2.5,4.5], …).

**Sample seed 20261122**
| t | Event |
|---|---|
| 0.1 | All → `HoldZone` @(8.8,8) (mislabeled intent; rim outside zone) |
| 2–4 | Brief mid skirmish |
| 10+ | Bodies at orb pads (e.g. jungle @(2.5,4.8)); blueIn=0 entire match |
| match | 25 blue / 12 red orb pickups; 0 captures; clock end |

**Why 0 control_time / 0 zone_tick:** never exclusive-owns (never even enters for capture). Directionally Starve should be lowest on control_time — OK for the inequality — but the pre-orb “contest” rim is **outside** the zone, so it also never pauses an enemy tick timer.

**Classification:**
- **(a)** for the “dip in to pause” job (L1111): rim at `ZONE_RADIUS+0.2` never occupies; fix = waypoint inside the radius (e.g. centre or `ZONE_RADIUS - ε`) for a short contest, then resume orb pads. Not a gate-tuned duration — follow “pause then out”.
- Starve’s high orbs: **spec-conformant** (L1117). **(b)** only if separation vs Hunt fails after Hunt is fixed — then knobs would be orb-router / assignment, not applied here.

---

## Cross-cutting answers

### Why Hunt and Starve never get a zone_tick?
They **never enter** (Hunt: hold_dist standoff outside r=3; Starve: rim outside r=3 then orb pads). Not “enter but fail 12 s exclusive.” Zero occupation ⇒ no capture ⇒ no owned-exclusive timer ⇒ no `zone_tick`.

### Why Hunt never picks orbs while Hold occasionally does?
Hunt freezes mid-lane outside the pit and never walks edge pads. Hold lives in the pit; rare paths/respawns brush a pad → ~0.1 mean. Starve camps pads → ~20.

### Is Hold’s zone_tick (~4) low because of capture rules or planner defect?
**Capture/tick rules (b).** control_time ≈ 50 s with `ZONE_TICK_S=12` yields ~4 ticks. Planner does capture and hold; the ungated `zone_tick` count is the 12 s cadence, not a Hold defect. Gated metric is control_time (S3-R5-13).

---

## Cause summary

| Observation | Class | Action |
|---|---|---|
| Hunt 0 control_time / 0 orbs | **(a)** vs L1111 / S3-R5-13 | Fix Hunt planner: contest zone + orbs on path |
| Starve never pauses tick timer (rim outside zone) | **(a)** vs L1111 dip | Fix Starve contest waypoint to inside `ZONE_RADIUS`, then orbs |
| Hold zone_tick ≈ 4 with healthy control_time | **(b)** | No change; 12 s tick cadence |
| Hold orbs ≈ 0 | **(b)** | Spec-OK for Hold; no gate knob |
| Starve orbs high | OK | Keep |

**Primary root cause for the hard gate failure:** Hunt’s planner is enemy-chase only and never contests the zone or walks orb pads — a behaviour bug against L1111, not a tuning miss.

Artifacts: `samples.json`, `batch-n40.json`, `trace.mjs`, `trace.log`.
