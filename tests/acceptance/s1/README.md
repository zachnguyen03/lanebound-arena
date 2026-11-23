# S1 acceptance suite (independent of the implementing agent)

**Oracle:** `lanebound-arena-build-spec-v1.md` (the *build spec*). Every expected number in these tests is derived from a spec line (cited in the test title or a comment as `L<line>`), never from `kits.ts`, `data/`, or any sim code. The ability table in `_oracle.ts` is hand-transcribed from spec §7 (with the kit line of every entry); the L1/L7/L10 stat rows in `_oracle-stats.ts` are extracted mechanically by `tools/gen-oracle-stats.py` from the spec. If the spec changes, change the oracle and cite the line; never change an expectation to match the sim.

**Rules for the implementing agent**
1. Do **not** edit anything under `tests/acceptance/s1/` except `gold/s1-brawl-digests.json` (see "Gold digests").
2. A test you believe is wrong is a **spec question**, not an edit: write it down with the spec line and send it to the user. (Possible spec ambiguities are already listed below; those tests are labelled.)
3. The tests import only `sim/index.js` (`simulate`, `defaultEvenConfig`). They import no sim internals, no `kits.ts`, no `data/`.

Run: `npx vitest run tests/acceptance/s1` (the repo's `vitest.config.ts` already includes `tests/**/*.test.ts`). Drop the whole `tests/` tree into the repo root.

A failure that shows `TypeError: Cannot read properties of undefined (reading 't')` (or `'raw'`, `'hp_after'`...) means the event the test needs was never emitted (e.g. no `status_apply`, no `shield_apply`); the stack line shows which one.

---

## 1. Minimal public API the sim must expose

### 1.1 Entry points (`sim/index.js`)
- `defaultEvenConfig(seed: number): MatchConfig`
- `simulate(config: MatchConfig): { events: Event[]; state: { units: UnitState[] }; digest: string }` (final state + canonical digest; replay with the same config must give the same digest).

### 1.2 MatchConfig lab hooks (all exist in 1818765 unless marked NEW/CHANGED)
| hook | shape | required semantics |
|---|---|---|
| `seed` | u32 | named RNG streams (spec L109, L124-134) |
| `constants` | `{ MATCH_T }` | match length override in seconds (clock end at `MATCH_T`) |
| `debug_pos` | bool | **CHANGED:** emit a spec §4.4 `move` event per unit per tick (`unit_id,x,y,vx,vy`; spec L164 "optional / lab-verbose"). 1818765 calls it `pos`. |
| `unit_overrides[unitId]` | `{ champ, level, x, y, hp, spawn_shield_until, auto_next_start_t, range, as, attrs{aim,reflexes,execution,decision,positioning,teamwork} }` | applied at tick 0. `hp` is absolute. `auto_next_start_t` = sim-time the unit may first start an auto (the harness idles every unit it does not use with 999). Units not overridden stay at their spawn with the default AI. |
| `scripted_casts[]` | `{ tick, source_id, skill:'Q'\|'W'\|'R', target_id?, aim_x?, aim_y?, force_hit? }` | **CHANGED, central:** a scripted cast is a *request at that tick* and goes through the **same legality as any cast** (spec L142 phase 7, L506-507): caster alive; not Locked / time-stopped / banished; not Silenced (casts) ; not Taunted (L452 "cannot use skills"); skill off cooldown; **R only at level ≥ 5 (L211)**; a targeted skill needs a legal target in range at cast start (L507). An illegal request is **silently refused: no `cast_start`, no CD burn**. 1818765 skips all of this. A skillshot (line/cone/point-circle/mortar) is aimed with `aim_x/aim_y` only (no `target_id`), and hits whatever the geometry says. A targeted skill uses `target_id` (and `aim_*` are ignored). `force_hit:true` removes the Aim-vs-Reflexes roll for this cast (spec L513, L934); the harness defaults it to true. |
| `scripted_cc[]` | `{ tick, target_id, kind, duration, source_id? }` | CC injected **through the real status engine** at that tick (per-category DR, Lock budget, expiry, assist credit for `source_id`). kinds: every kind in spec L1475 incl. `break`, `timestop`, `hex`, `blind`, `taunt`. **Must emit `status_apply`** (1818765 emits nothing). |
| `scripted_damage[]` | `{ tick, source_id, target_id, raw }` | one physical, non-crit packet, `skill_id:"scripted"`, through the full damage pipeline (amps, petrify DR, shields, mitigation, sleep-break, assist credit, hit event). |
| `scripted_motor[unitId]` | `{ waypoints:[{x,y}], arrive_r, hold_at_end }` | steer at the unit's current MS (slows applied) along the waypoints; **must not move** a unit that is Locked / rooted-for-movement / time-stopped per §6.5. |
| `scripted_attack_reset[]` | `{ tick, unit_id, pending }` | sets/clears the attack-reset gate (spec L506: no auto starts while pending). |
| `scripted_skillshots[]` | `{ tick, source_id, target_id, count }` | fires `count` Aim rolls through the sim's RNG; emits `skillshot_roll` (`hit: bool`). |

### 1.3 MatchState fields read
`state.units[]`: `id, x, y, hp, max_hp, alive, level, stats{hp, regen, atk, pow, pres, mres, as, crit, range, ms}` (L355-377 stats at the unit's level).

### 1.4 Events read (spec §4.4 L156-185 names and fields exactly)
`cast_start{unit_id, skill_id, cast_time}` · `cast_cancel{unit_id, skill_id, reason: lock|death|silence|move}` · `hit{source_id, target_id, skill_id | auto, raw, mitigated, amp, crit, shield_absorbed, hp_after}` · `heal{source_id, target_id, skill_id, raw, applied, combat_scaled}` · `shield_apply{source_id, target_id, amount, expires_at, capped_to}` · `status_apply{source_id, target_id, kind, category, raw_duration, applied_duration, dr_factor, lock_taper}` · `status_expire{target_id, kind}` · `sleep_break{target_id, source_id}` · `dispel{source_id, target_id, strength: basic|strong, removed[]}` · `death{unit_id, killer_id, assists[], respawn_at}` · `xp_gain{unit_id, amount, source}` · `move` (debug_pos) · `mark_apply` is **not** read.
Lab events: `skillshot_roll{source_id, target_id, hit}` and `sanctuary_clip` (exists in 1818765).

- `hp_after` is the integer HP after the hit: **floor** after applied damage (spec L124 "floor after applied damage, not before").
- `skill_id` form is not fixed by the spec. Accepted: the ability name in any case/punctuation ("Keen Bolt"), `<champ><key>` with any separator ("huntress:Q"), or the bare key ("Q"). Autos are `skill_id: "auto"` (or an `auto` flag).
- `status_apply` must be emitted for **every** CC application (real casts and `scripted_cc`), also when DR reduces it. `raw_duration` is the authored duration; `applied_duration` the post-DR/taper value.
- Rejected application (Spellward, banished target, sanctuary) emits no `status_apply`.
- `shield_apply.amount` is the *added* shield after cap; `capped_to` the pool after the cap (spec L429).

---

## 2. S1 structural requirements (acceptance criteria, in addition to the tests)
These are the reason two rounds of agent-written tests missed bugs: kit behaviour lived in per-ability code branches with numeric literals. S1 is accepted only if all hold; a reviewer will check them by reading the diff:

1. **Abilities are structured data in `kits.ts`** (or `data/`): per ability `base` (L7), `ratios` (atk/pow/…), `range`, `shape` (`line | cone | circle_point | circle_target | circle_self | cone_target | target | ally_target | circle_ally | self | self_dash | streak`), `radius`/`width`/`angle`, `pierce` (`all | first`), `school`, `cd`, `cast_time`, `land_delay`, per-CC `{kind, category, duration, school}`, `slow {pct, duration}`, `heal {base, ratio}`, `shield {base, ratio, duration}`, `dash`/`knockback` distances, finisher / mark parameters. Every number the tests assert (all of §7 L539-838) must come from this data, not from code.
2. **One generic effect interpreter** reads those structs (target selection by shape, packet formula L385-408, CC/heal/shield/dash application). **No per-ability numeric literals** and no `if (champ === "x" && skill === "W")` numeric branching anywhere in `sim/` or in lab fixtures. (1818765's `cast.ts` has `(65 + 0.35 * pow)` for Ysol W / Saelo W, a Huntress/Kerrig/Saelo special case per skill, `duration: 4.0`, `2.8` etc.) Passives (§7 passive lines) are also data-driven hooks with a `off_under_break` flag.
3. **CC is enforced by the status engine in the loop** (spec §6.5 L432-460, §4.3 phases 6-9): `canCast`, `canAuto`, `canMove`, `canDash` are derived from the unit's status instances and checked by the generic cast/auto/motor stages. No "CC data exists but nothing reads it". The engine owns DR, the Lock budget, same-kind `max`, dispel rules, sleep-break-after-shields, time-stop pausing of every timer.
4. **Scripted casts are requests** through the identical legality path (§1.2) so that tests exercise the real code path the AI will use.

---

## 3. Test index (904 tests in 13 files)
| file | covers (spec lines) |
|---|---|
| `01-stats` (100) | **M1-5** L1/L7/L10 stat rows of all 14 vs §7 tables (L539-838), all intermediate levels from the growth formula (L355-377), eHP, crit cap |
| `02-ability-numbers` (447) | **every ability, L1 and L7 (R: L5 and L7)**, all 14 champions / 42 abilities: cast time, raw = (L7 base + ratios×stat(L))×skill_scale(L) (L359, L385-408), mitigated = raw×100/(100+res) (L335), hp_after, no crit, CC kind/category/raw/applied duration, slow %, heal, shield, dash/knockback distance, land delay; R refused at L1 and L4 (L211) |
| `03-marks-finishers` (15) | **M1-6, 7, 8, 15**: Huntress Q mark/consume/expiry, Maelis R and Kerrig R finishers (L390-392), Kerrig R commit, CD on windup, self-Break 2.8 s (L728, L456) |
| `04-cc-enforcement` (43) | Lock/silence/disarm/root/slow/blind/taunt enforced in the loop (L452-458, L142, L145, L506), cast_cancel reasons (L162) |
| `05-status-engine` (30) | **M1-10, 11, 12, 18, 19**: DR (L466-475), Lock budget (L477-487), same-kind max (L489), dispels (L498-500), Sedge R, Tolle W banish, Saelo R time-stop, sleep-break after shields (L442) |
| `06-heals-shields` (23) | **M1-16, 17**: shield cap 25% max HP (L429), absorb/expire, four no-op abilities, combat heal ×0.75 (L425), Calder W, Ysol W (95+45% POW and radius dispel), Saelo W, regen |
| `07-petrify-passives` (23) | **M1-13** petrify DR (L440, L793), Isra Long Sight (L396), Tolle Well-Fed (L655), Brannoch Bedrock (L787), Saelo Rewound Moment (L829) |
| `08-casting-rules` (51) | cooldowns of all 42 abilities, dead can't cast, auto cadence/windup (L506, L520), windup cancelled by a cast (L522), attack-reset gate, time-stop pauses autos/windups/casts/CD/CC/buffs/regen (L448) |
| `09-assists-xp` (8) | CC / heal / shield / damage assists from real casts to XP (L525-527, L229-231: kill 45, assist 20), 6.0 s window, dead assistant |
| `10-shape-range-geometry` (108) | cast range (targeted: ±0.15/0.25), shapes, radius (body 0.4, L508), pierce / stop-at-first (L509-510), cones, pillars, enemy sanctuary clip, **M1-9** Isra R vs the pad, Isra land delay, friendly fire with caster exclusion |
| `11-aim-skillshots` (35) | **M1-19b** Aim vs Reflexes (L929, L934), 6 attribute pairs × 5 seeds replay, rate over 400 seeds, per-target roll, targeted/self never roll |
| `12-brawl-gold` (7) | scripted 10-champion brawl per seed: casts, hits, statuses, deaths > 0; replay; digest pinned in `gold/` |
| `kiln-cured` (14) | Mirren Kiln-Cured: 9 unambiguous tests + 5 in an AMBIGUOUS block (OQ-1) |

Design note: "misses / no effect" assertions are paired with a "hits" assertion in the same describe so that a sim that does nothing cannot pass both; where a negative assertion stands alone (e.g. "no amp on a non-hexed unit") it first asserts that the packet exists.

### Gold digests
`gold/s1-brawl-digests.json` is the **only** file the agent may edit. The digest is an *output* of the sim, not a spec-derived expectation: after all other tests pass, run `12-brawl-gold`, copy the "PIN ME: seed N digest is X" value into the JSON, and commit it. Pinning a digest from a sim that still fails other tests proves nothing; the reviewer re-runs it.

---

## 4. Open questions (spec silent or ambiguous; **no invention**)
The tests are written so they do not depend on these unless stated. Send to the Game Designer / Anh.

**OQ-1 (needs GD ruling): whose Break turns off Kiln-Cured?** Tests: `kiln-cured.test.ts`, describe "AMBIGUOUS".
- L743: "Passive — Kiln-Cured (L1, off under Break). Enemies hexed by Mirren take +12% damage from all sources for as long as the hex lasts."
- L397 (packet formula): "Mirren Kiln-Cured: if the target is hexed by Mirren, raw *= 1.12 from ALL sources, off under Break"
- L456: "Break: disables passives listed as 'off under Break' (… Mirren Kiln-Cured …)" and "Kerrig R … a self-Break for 2.8 s (passives off; he has no such passive…)". L1719 (M1 test 14): "a hexed target takes +12% from a third party's packet; the amp drops when the hex ends; off under Break (unit test with a forced Break)."
- None says whether Break on **Mirren** (passive owner), on the **hexed victim**, or on the **attacker whose packet is amped** suppresses it. Reading A (Break on Mirren, consistent with L456's Kerrig sentence) is the default; B (victim) and C (attacker) are in the same block. After the ruling keep the chosen reading(s), delete the others. Unambiguous Kiln tests (amp +12% on third-party packets of all kinds incl. autos, drops when the hex ends, Mirren R hex also, own R damage not amped, not skill-scaled) are in the first describe.

**OQ-2: same-tick own damage vs own CC (Brannoch R petrify, Mirren R hex).** Spec §4.3 phase 8 (L143) resolves damage, phase 9 (L144) applies "new CC that landed this tick". I read that as: Brannoch R's *own* packet (L793) is **not** cut by the petrify it applies (it resolves before the status exists), and Mirren R's own packet is not amped by the hex it applies. Tests `07 "Brannoch R's OWN damage is NOT cut…"`, `02 Brannoch R mitigated`, `kiln "Mirren R's OWN damage is not amped"` assert this. If the GD intends the opposite, flip those three assertions.

**OQ-3: fear and hex movement.** L450 "Motor flees directly away from the source at MS" (fear) and L747 (Mirren W "also slows") do not say what a feared/hexed unit's *speed* is. Tests assert zero movement only for stun, knockup, sleep, banish, time-stop (L145). Fear/hex movement is not asserted.

**OQ-4: cone angle meaning.** "70°" (Rhedan Q) / "80°" (Ysol Q) / "60°" (Calder Q): full angle or half angle? Tests only probe 25° off-axis (inside under both readings) and 90° off (outside under both).

**OQ-5: line capsule vs body radius.** L509 defines the capsule by length/width; L508 uses body radius 0.4 only for circles. Line tests keep ≥ 0.65 margin outside and ≥ 0.1 inside the half-width so both readings pass. Circle edge tests use the explicit body-0.4 rule (L508): hit at r+0.3, miss at r+0.5.

**OQ-6: skillshot aimed beyond max range.** Spec L507 covers targeted skills only. Tests do not aim a skillshot beyond range except for "reach" probes ≥ 1.5 beyond authored length (must not hit).

**OQ-7: windup length.** L506 "Windup = 0.25 / AS … flag: proposal, range 0.15/AS–0.35/AS". The cadence/windup tests assume the proposal value (0.25/AS) with a tolerance of ±1 tick. If the GD changes it, edit the constant in `08-casting-rules.test.ts` and cite the new spec line.

**OQ-8: time-stop and its own timer.** L448/L144 say all timers on a time-stopped unit pause, "including their own CC timers". The Time-stop effect's own countdown must still run down or it is permanent. Tests assume the stop lasts exactly its duration (Saelo R 2.0 s).

**OQ-9: `status_apply` for a banished/ward-rejected application and for zero-duration results.** Spec silent; tests never apply CC to banished or Spellwarded units.

**OQ-10: events not in §4.4.** `mark_apply`, `skill_fizzle`, `projectile_*` are not asserted. Marks are tested through their effect on damage (+35% / finisher).

Passives scope: only the passives listed in M1 (Long Sight, Kiln-Cured, Well-Fed, Bedrock, Rewound Moment, plus their Break gating) are tested; the other passive lines are not.
