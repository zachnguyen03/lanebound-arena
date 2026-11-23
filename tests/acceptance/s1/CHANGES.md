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
