# S1 acceptance suite v4 — L1899 cascade fixture fixes

Date: 2026-11-23 (Asia/Seoul). Verifier-owned overlay on official v1+v2+v3. This tarball contains only the files changed in v4, plus this note (v3 history is preserved below). No assertion was loosened or dropped. No sim code is included. Aims of follow-up skillshots are unchanged.

## Why

At 419dbf1 the sim implements Appendix R L1899 correctly: the hex centroid is every living same-team unit except the hexed unit, with no radius, from phase-start poses recomputed each tick; alone, the unit walks to its own spawn pad centre. Direct loop checks confirm self-exclusion, dead-ally exclusion, per-tick recompute, and pad walk at MS×0.65.

Nine official tests then went red. Adjudication: all nine are **SUITE / HARNESS**, not sim bugs. Their intents (Mirren W CD 15 s; assist credit, XP, 6.0 s window, dead assistants; kiln amp drop) are independent of hex motion. `_harness.ts` `run()` invents idle fillers for every unnamed 5v5 slot and parks them as living default champs at the team spawn. A mid-lane hex victim therefore walks toward that spawn-filler centroid, and fixed-aim follow-ups at the pre-hex tile miss.

**Not a global harness change in v4.** Parking fillers at spawn is a harness invention (it keeps unused defaultEvenConfig units from autoing and contaminating hp/xp/assist asserts). Globally omitting unnamed slots would be cleaner now that L1899 makes every living ally load-bearing, but the blast radius is every `run()` scenario: ally separation toward spawn, implicit 10-man assumptions, and any test that currently relies on those idle bodies. That belongs in a dedicated pass with a full-suite rerun, not a silent global change bundled with these nine fixes. v4 occupies unused *same-team* slots in the hexed-victim fixtures only, so the centroid stays on the victim and the original aims still land.

## Fixes

1. `08-casting-rules.test.ts` — mirren W CD 15 s (spec L747, L523).
   - **Bug:** the generic CD fixture recasts W at t≈16.5 s. Mirren W hexes the foe, who walks toward red spawn fillers and leaves W range 6, so `casts.length` is 1 not 2 (the late recast is out of range, not on CD).
   - **Fix:** when the ability hexes the foe, `occupyTeamAt("red", foe pose)` pins the living-ally centroid on the foe. CD asserts unchanged (`casts.length === 2`, late cast after CD).
   - **Spec:** §7 'CD x s', L523, L747; L1899 only explains the yank, not the behaviour under test.

2–8. `09-assists-xp.test.ts` — seven tests (CC assist death / XP; heal+shield+damage assists and XP; 6.0 s window in and out; dead assistants).
   - **Bug:** `team()` hexes `red:mid` at (9,8) and fires Huntress Q / Maelis Q at aim [9,8]. Unused red slots are living at RED_SPAWN, so V walks off the aim and the death event is missing (`assists` of undefined).
   - **Fix:** `occupyTeamAt("red", [9, 8], …)` in `team()`. All seven share that helper. Aims stay [9,8]. Assist / XP / window / dead-assistant asserts unchanged.
   - **Spec:** L525–527, L229–230, L231, L146; L1899 as above.

9. `kiln-cured.test.ts` — amp drops when the hex ends (late Maelis Q at ≈4.5 s and Huntress R at ≈6 s).
   - **Bug:** V walks off aim [9,8] after the hex; the late Maelis hit is missing.
   - **Fix:** same `occupyTeamAt("red", [9, 8], …)` in `scn()`. Aims unchanged. Amp-drop numbers (`mq`, Huntress R) unchanged. In-hex tests in the same `scn()` are unaffected because V now stays put.
   - **Spec:** L743, L397.

## Support edits (no weaker asserts)

- `_harness.ts`: adds `occupyTeamAt`. Does not change the default filler loop.
- `_scenarios.ts`: `abilityRun` now *merges* `extra.units` / `extra.casts` instead of letting `...extra` replace the whole `units` object. Required so the CD test can pass pin units. Existing callers that do not pass `units` are unchanged.

## L214 spawn slots (ruled after 419dbf1; not yet in this tip)

GD L214: a unit's spawn/respawn is pad centre + role×SPAWN_SLOT_SPACING (default 1.0, tunable 0.8–1.2, hashed). Offsets: Top −2, Jungle −1, Mid 0, ADC +1, Support +2. `SPAWN_JITTER_Y` is deleted. The agent will land this after 419dbf1.

v4 fixtures do **not** depend on fillers sitting at the pad centre or on 0.3 jitter. `occupyTeamAt` places living same-team allies at explicit coordinates (`at` ± 5 in y). The 08 / 09 / kiln fixes stay green under either the current jittered pad or the new per-role slots.

Those tests are **robust to** L214 but they do **not assert** it — their intents are CD, assists/XP, and kiln amp drop, with the victim held still. Coverage of the new slots themselves belongs in a later additive file (spawn/respawn coordinates per role, `SPAWN_SLOT_SPACING` in `constants_hash`, `SPAWN_JITTER_Y` removed from the table). Among already-shipped tests, `13-gd-rulings.test.ts` "walks toward the own spawn pad (1.5, 7.5)" hexes `blue:mid`, whose L214 slot is still the pad centre, so it keeps testing L1899's "pad centre" fallback but would **not** catch an ADC/Support walking to the centre instead of their own slot. If L1899's "own spawn pad centre" and L214's "own slot" ever disagree for non-mid roles, that needs a Game Designer line before changing that test.

## Not in this overlay


- Gold pins, kiln readings B/C (still retired), and the official L1899 pad-walk / centroid tests in `13-gd-rulings.test.ts` (those already name all same-team slots or kill them).
- No global filler omission.

---

# S1 acceptance suite v3 — fixture fixes only


Date: 2026-11-23 (Asia/Seoul). Verifier-owned additive overlay. Apply over official v1 (`s1-acceptance.tar.gz`, sha256 `9c692b25…`) plus v2 (`s1-acceptance-v2.tar.gz`, sha256 `9fdee5e0…`), or over the suite already in a tree.

This tarball contains only the four test files that had fixture bugs among the 11 failures at daa6387, plus this note. No assertion was loosened or dropped. No sim code is included.

The 11 failures at daa6387 (949/960 on the agent's tree) are all **SUITE BUG** — the sim behaviour under test was correct; the fixtures contradicted the same spec lines they cited.

## Fixes

1–2. `02-ability-numbers.test.ts` — "R is locked until level 5" at L1 and L4 for Kerrig (and any `needsMark` R).
   - **Bug:** `abilityRun` scripts a prelude Q at tick 2 for Kerrig so a later marked R can be tested. The locked-R case then asserted `skillHits(caster).length === 0` and `status(foe).length === 0`, which fail on the prelude Q's hit and leash, even though `casts(R)` is already 0 (R correctly refused).
   - **Fix:** keep `casts(R) === 0`, and filter hits and foe status with `skillIs(..., "R")` so only a leaked locked R would fail. Same spec behaviour, not weaker.
   - **Spec:** §5.2 L211; §7 "R (L5)".

3–4. `05-status-engine.test.ts` — M1-10 Ysol W strong-dispels sleep; Saelo W basic-dispel does not (two tests).
   - **Bug:** healers sat at (7,11) and (7,5), distance 3.0 from Sedge R's aim [7,8]. That is inside r=3.8 + body 0.4, so both are asleep and cannot cast W.
   - **Fix:** move Ysol to (10,13) and Saelo to (10,3): distance 5.83 from the land point (outside the sleep circle) and distance 5.0 from the sleeper at (10,8), inside Ysol/Saelo W range 6.5 (L812, L833). Dispel assertions unchanged.
   - **Spec:** L619, L498–500, L1711; Ysol W L812; Saelo W L833; Sedge R radius.

5. `05-status-engine.test.ts` — sleep + Torun W shield absorb (L442).
   - **Bug:** sleeper `V` was enemy `red:mid`. Torun W is `circle_ally` (L638), so the shield was refused; Maelis Q then did full HP damage (`hp_after` 1549 vs 1720; `shield_absorbed` 0).
   - **Fix:** sleep an allied Torun (`blue:mid`), have allied Torun W that ally, and deal the packets from enemy Maelis (`red:mid`) and enemy Huntress (`red:adc`). Keep the numbers: shield fully absorbs Maelis Q (mitigated ≈ 171, `hp_after` 1720), Huntress Q then exceeds the remainder and breaks sleep.
   - **Spec:** L442; Torun W L638.

6–8. `13-gd-rulings.test.ts` — Brannoch Bedrock, three tests (owner Break / attacker Break / no Break).
   - **Bug:** shooter `H` was module-level `blue:adc`, same team as Brannoch `blue:top`. Huntress Q cannot hit an ally, so the packet was missing and mitigation could not be checked.
   - **Fix:** hostile shooter `red:adc`. Mitigation checks (88 vs 68) and the owner/attacker pairing are unchanged. (07-petrify already used a red Brannoch.)
   - **Spec:** L787; Appendix R #2 L1897 (Break on the passive **owner**).

9. `13-gd-rulings.test.ts` — Saelo Rewound Moment owner-off / attacker-on.
   - **Bug:** Huntress `H` was `blue:adc`, same team as Saelo `blue:support`. No hostile packet, so HP never crossed 30% and the paired "attacker Break still grants 270" assertion could not fire.
   - **Fix:** hostile Huntress `red:adc`. Keep the paired owner-off / attacker-on assertions so a sim that never shields cannot pass. Amount 270 unchanged.
   - **Spec:** L829; Appendix R #2 L1897.

10. `13-gd-rulings.test.ts` — hex walk to own pad when no living allies.
    - **Suite bug:** module `V` and describe-local `SRC` were both `"red:mid"`, so Torun overwrote Mirren; no hex was applied. Fix: distinct ally-killer id `red:jungle`. Title and comments updated from pad (1,7) to (1.5, 7.5) per L1906; direction asserts (`−x`, `−y` from (8,10), thresholds 0.8 / 0.2) unchanged.
    - **Residual sim bug (not a fixture issue):** after the id-clash fix, hex is applied but the unit stays at (8,10) for the whole hex. `sim/motor.ts` `integrateSteering` returns hold when `allyCentroid` is null (`HEX_ALLY_RADIUS = 10`, and the comment says pad fallback was skipped so mid-lane fixtures would not be yanked). That contradicts L1899: with no living allies the unit must walk toward its own spawn pad at MS×0.65. The v3 fixture keeps the original asserts so this sim bug stays red until the agent implements the pad fallback (BLUE_SPAWN / RED_SPAWN, currently (1.5,7.5)/(22.5,7.5)).
    - **Spec:** Appendix R #2 L1899 (hex walks to living-ally centroid or own pad at MS×0.65); Appendix R L1906 (tile-index positions at centres; blue spawn (1.5, 7.5)).

11. `kiln-cured.test.ts` — amp drops when the hex ends: Maelis Q at ≈4.5 s is plain.
    - **Bug:** the same Maelis (`blue:jungle`) casts Q at tick 11 (inside the hex) and again at tick 45 (t=4.5 s). Maelis Q CD is 7 s (L703), so the second cast is refused. Huntress R at tick 60 already lands and was already asserted plain. `T: 7` is too short to wait out the CD until t=8.1.
    - **Fix:** a second Maelis (`blue:top`) casts the late Q at tick 45. The original Maelis still covers the in-hex window. Keep `T: 7` and the existing Huntress R assertion. Do not drop the Maelis check.
    - **Spec:** L743, L397; §7 Maelis Q CD 7 s (L703).

## Not in this overlay

- **Readings B and C** in official `kiln-cured.test.ts` were deleted in commit `9a8fbc32` ("S1 acceptance v2") without the permission the v2 report reserved to Anh. They are superseded by Appendix R #2 L1897 (reading A, asserted in `kiln-cured-ruled.test.ts`). This overlay does not restore them: they assert the opposite of the binding ruling and would fail a correct sim. Official combined count is 962; the agent's tree and this overlay run at 960.
- **Gold pins** (`gold/s1-brawl-digests.json`) are the one acceptance file the agent may edit. Not part of v3.
- No HP-regen ±1.5 item was among the 11; none was loosened.

## How to apply

Copy the four `*.test.ts` files over `tests/acceptance/s1/` in the tree. Do not replace the rest of the suite.
