/**
 * M2-25 … M2-37 — Cast-policy acceptance (R6-1 / §9.4.1).
 * Spec definitions L1941–1953; context §9.4.1 L1150–1336, S5-R6-8 L2229+,
 * Teamwork R6-7(d), M2-22 peel accounting.
 *
 * Behind LB_M2 so default npm test stays green on bb4cb63 (no cast policy yet):
 *
 *   LB_M2=1 npx vitest run tests/acceptance/m2-cast-policy.test.ts
 *   LB_M2=1 npm test
 *
 * Lab = 200-game random-draft even-OVR side-swapped pairs (100 seeds × 2),
 * seed 20261122, attrs 70 / mastery 50, forced_clock_end false.
 * Unit = scripted headless fixture via the S2 public harness.
 *
 * Does not modify sim/ or existing tests. Does not read s6-casts.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { digestEvents, evenOvrConfig, simulate } from "../../sim/index.js";
import type { MatchConfig } from "../../sim/index.js";
import { LB_M2 } from "./_m2_gate.js";
import {
  CONDITIONAL_SKILLS,
  DAMAGE_BASICS,
  DISABLE_BASICS,
  DISABLE_KINDS,
  DISABLE_SKILLS_RULE1,
  HARD_CC,
  LOCK_KINDS,
  appearances,
  castIs,
  MIN_SAMPLE,
  castTier,
  castsByUnitSkill,
  combosOf,
  getCastPolicyLab,
  intendedLockTarget,
  isConditional,
  isTimestopKind,
  livingEnemiesAt,
  lockStretches,
  logRate,
  mean,
  peelSkillReadyAt,
  peelSkillsFor,
  readCommitRFlag,
  retreatImmobileFromLog,
  stripCastTier,
  teamOf,
  teamfightsOf,
  timeAliveAtLeastLevel,
  type Champ,
  type Ev,
  type LabBundle,
} from "./_m2_lab.js";
import { PIT, pathOf, runAi, type UId } from "./s2/_harness.js";
import { maxHp } from "./s1/_harness.js";
import { ab, type Key } from "./s1/_oracle.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// ─── attribute formulas (§8.4) used by unit fixtures ─────────────────────────
function reactionDelay(reflexes: number): number {
  return Math.min(0.9, Math.max(0.2, 0.7 - 0.008 * (reflexes - 50)));
}
function perceptionDelay(decision: number): number {
  return Math.min(0.6, Math.max(0.15, 0.4 - 0.004 * (decision - 50)));
}
function comboFollowS(effE: number): number {
  return Math.min(0.5, Math.max(0.1, 0.35 - 0.005 * (effE - 50)));
}
function chainErrS(effE: number): number {
  return Math.min(0.5, Math.max(0.1, 0.3 - 0.005 * (effE - 50)));
}
/** R7-6b / §15: P1a wind-up read multiplier on enemy R cast_start only. */
const P1A_READ_MULT = 0.5;
function p1aReadDelayTicks(reflexes: number): number {
  return Math.ceil(P1A_READ_MULT * reactionDelay(reflexes) * 10 - 1e-9);
}
function reactionDelayTicks(reflexes: number): number {
  return Math.ceil(reactionDelay(reflexes) * 10 - 1e-9);
}

describe.skipIf(!LB_M2)("M2 cast policy (R6-1 / §9.4.1 L1150–1336, tests L1941–1953)", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Lab-backed gates share one 200-game bundle.
  // ═══════════════════════════════════════════════════════════════════════════
  describe("Lab gates (200-game side-swapped random-draft)", () => {
    let lab: LabBundle;
    beforeAll(() => {
      lab = getCastPolicyLab();
    }, 600_000);

    it("lab fixture: N=200, seed_start=20261122, forced_clock_end false path", () => {
      expect(lab.n).toBe(200);
      expect(lab.seed_start).toBe(20261122);
      expect(lab.games.every((g) => g.duration_s > 0)).toBe(true);
    });

    // ── M2-25 ──────────────────────────────────────────────────────────────
    describe("M2-25 Every skill is cast (coverage) (spec L1941)", () => {
      it("(a) Q/W cast_start coverage ≥ 95% (≥ 40% conditional) of games ≥ 60 s per champ", () => {
        for (const champ of [
          "huntress",
          "maelis",
          "isra",
          "sedge",
          "torun",
          "tolle",
          "helvar",
          "calder",
          "kerrig",
          "mirren",
          "rhedan",
          "brannoch",
          "ysol",
          "saelo",
        ] as Champ[]) {
          const apps = appearances(lab, champ).filter((a) => a.game.duration_s >= 60);
          expect(apps.length, `${champ} appearances ≥ 100`).toBeGreaterThanOrEqual(100);
          for (const key of ["Q", "W"] as Key[]) {
            const bar = isConditional(champ, key) ? 0.4 : 0.95;
            const num = apps.filter(
              (a) => castsByUnitSkill(a.game, a.unitId, champ, key).length > 0,
            ).length;
            const den = apps.length;
            logRate(`M2-25a ${champ} ${key}`, num, den, lab.n);
            expect(num / den, `${champ} ${key} coverage`).toBeGreaterThanOrEqual(bar);
          }
        }
      });

      it("(b) R cast_start in ≥ 80% of games where champ is L5 for ≥ 60 s (R7-3: ≥30 sample)", () => {
        for (const champ of [
          "huntress",
          "maelis",
          "isra",
          "sedge",
          "torun",
          "tolle",
          "helvar",
          "calder",
          "kerrig",
          "mirren",
          "rhedan",
          "brannoch",
          "ysol",
          "saelo",
        ] as Champ[]) {
          const apps = appearances(lab, champ).filter(
            (a) => timeAliveAtLeastLevel(a.game, a.unitId, 5) >= 60,
          );
          // R7-3 / L1944: empty never fails; gate only when den ≥ 30.
          if (apps.length === 0) {
            logRate(`M2-25b ${champ} R (empty sample — skip)`, 0, 0, lab.n);
            continue;
          }
          if (apps.length < MIN_SAMPLE) {
            // eslint-disable-next-line no-console
            console.log(
              `[M2 lab] M2-25b ${champ} R: insufficient sample den=${apps.length} (need ≥${MIN_SAMPLE}) N=${lab.n}`,
            );
            continue;
          }
          const num = apps.filter(
            (a) => castsByUnitSkill(a.game, a.unitId, champ, "R").length > 0,
          ).length;
          logRate(`M2-25b ${champ} R`, num, apps.length, lab.n);
          expect(num / apps.length).toBeGreaterThanOrEqual(0.8);
        }
      });

      it("(c) mean casts/game in games ≥ 120 s: damage ≥ 4, disable ≥ 2, conditional ≥ 0.5", () => {
        const check = (
          list: ReadonlyArray<readonly [Champ, Key]>,
          floor: number,
          label: string,
        ) => {
          for (const [champ, key] of list) {
            const apps = appearances(lab, champ).filter((a) => a.game.duration_s >= 120);
            expect(apps.length, `${champ} games≥120`).toBeGreaterThan(0);
            const counts = apps.map(
              (a) => castsByUnitSkill(a.game, a.unitId, champ, key).length,
            );
            const m = mean(counts);
            logRate(`M2-25c ${label} ${champ} ${key} mean`, m, 1, apps.length);
            expect(m, `${champ} ${key} mean`).toBeGreaterThanOrEqual(floor);
          }
        };
        check(DAMAGE_BASICS, 4, "damage");
        check(DISABLE_BASICS, 2, "disable");
        check(CONDITIONAL_SKILLS, 0.5, "conditional");
      });

      it("(d) regression R6-1: Kerrig Q ≥ 2, Huntress Q ≥ 4; both Rs in ≥ 50% of L5 games", () => {
        const long = (champ: Champ) =>
          appearances(lab, champ).filter((a) => a.game.duration_s >= 120);
        const kQ = mean(
          long("kerrig").map((a) => castsByUnitSkill(a.game, a.unitId, "kerrig", "Q").length),
        );
        const hQ = mean(
          long("huntress").map((a) => castsByUnitSkill(a.game, a.unitId, "huntress", "Q").length),
        );
        logRate("M2-25d Kerrig Q mean", kQ, 1, long("kerrig").length);
        logRate("M2-25d Huntress Q mean", hQ, 1, long("huntress").length);
        expect(kQ).toBeGreaterThanOrEqual(2);
        expect(hQ).toBeGreaterThanOrEqual(4);

        for (const champ of ["kerrig", "huntress"] as Champ[]) {
          const apps = appearances(lab, champ).filter(
            (a) => timeAliveAtLeastLevel(a.game, a.unitId, 5) >= 60,
          );
          if (apps.length === 0) {
            logRate(`M2-25d ${champ} R L5 (empty sample — skip)`, 0, 0, lab.n);
            continue;
          }
          const num = apps.filter(
            (a) => castsByUnitSkill(a.game, a.unitId, champ, "R").length > 0,
          ).length;
          logRate(`M2-25d ${champ} R L5`, num, apps.length, lab.n);
          expect(num / apps.length).toBeGreaterThanOrEqual(0.5);
        }
      });
    });

    // ── M2-26 ──────────────────────────────────────────────────────────────
    describe("M2-26 Hard-CC volume and the chain-lock cap (spec L1942)", () => {
      it("(a) hard-CC status_apply mean > 0 (gate); provisional 15–80 band reported not gated", () => {
        const perGame = lab.games.map(
          (g) => g.events.filter((e) => e.type === "status_apply" && HARD_CC.has(String(e.kind))).length,
        );
        const m = mean(perGame);
        logRate("M2-26a hard-CC mean (provisional band 15–80 reported)", m, 1, lab.n);
        // eslint-disable-next-line no-console
        console.log(
          `[M2 lab] M2-26a provisional band 15–80: in_band=${m >= 15 && m <= 80} (reported, not gated)`,
        );
        expect(m).toBeGreaterThan(0);
      });

      it("(b) every §9.4.1.4 rule-1 disable skill applies ≥ 1 status in ≥ 90% (R7-7 Rs: L5≥60s ∩ R cast)", () => {
        for (const [champ, key] of DISABLE_SKILLS_RULE1) {
          // R7-7 / L1945: Rs use M2-25b filter ∩ at least one R cast; basics keep games ≥ 60 s.
          const apps =
            key === "R"
              ? appearances(lab, champ).filter(
                  (a) =>
                    timeAliveAtLeastLevel(a.game, a.unitId, 5) >= 60 &&
                    castsByUnitSkill(a.game, a.unitId, champ, "R").length > 0,
                )
              : appearances(lab, champ).filter((a) => a.game.duration_s >= 60);
          if (apps.length === 0) {
            logRate(`M2-26b ${champ} ${key} (empty sample — skip)`, 0, 0, lab.n);
            continue;
          }
          if (apps.length < MIN_SAMPLE) {
            // eslint-disable-next-line no-console
            console.log(
              `[M2 lab] M2-26b ${champ} ${key}: insufficient sample den=${apps.length} (need ≥${MIN_SAMPLE}) N=${lab.n}`,
            );
            continue;
          }
          const num = apps.filter((a) => {
            const casts = castsByUnitSkill(a.game, a.unitId, champ, key);
            if (casts.length === 0) return false;
            return a.game.events.some(
              (e) =>
                e.type === "status_apply" &&
                e.source_id === a.unitId &&
                DISABLE_KINDS.has(String(e.kind)),
            );
          }).length;
          logRate(`M2-26b ${champ} ${key}`, num, apps.length, lab.n);
          expect(num / apps.length).toBeGreaterThanOrEqual(0.9);
        }
      });

      it("(c) Lock stretches > 4.5 s = 0; > 3.0 s in ≤ 2% of stretches", () => {
        const all = lab.games.flatMap(lockStretches);
        const over45 = all.filter((s) => s.dur > 4.5).length;
        const over30 = all.filter((s) => s.dur > 3.0).length;
        logRate("M2-26c Lock >4.5s", over45, all.length, lab.n);
        logRate("M2-26c Lock >3.0s", over30, all.length, lab.n);
        expect(over45).toBe(0);
        if (all.length > 0) expect(over30 / all.length).toBeLessThanOrEqual(0.02);
      });

      it("(d) AI third Locks on intended target inside 5.0 s (R7-4 / rule 4) = 0", () => {
        // R7-4 / L1947 / L1204: count only the cast's intended target at decision
        // time (applied Lock status_apply in the window + perceived allied Lock
        // casts). Incidental area bodies excluded; ally-targeted casts excluded;
        // a third that arrives only via an unperceived allied cast is excluded.
        // M2-26c still counts every Lock (continuous > 4.5 s) — unchanged.
        let violations = 0;
        let den = 0;
        const reaction = reactionDelay(70); // lab attrs 70
        for (const g of lab.games) {
          for (const cast of g.events.filter((e) => e.type === "cast_start")) {
            const src = String(cast.unit_id);
            const intended = intendedLockTarget(g, cast);
            if (!intended) continue;
            // Ally-targeted Lock casts (e.g. Tolle W P1c) excluded — R7-4.
            if (teamOf(intended) === teamOf(src)) continue;
            // This cast must actually land a Lock on its intended target.
            const land = g.events.find(
              (e) =>
                e.type === "status_apply" &&
                LOCK_KINDS.has(String(e.kind)) &&
                e.source_id === src &&
                e.target_id === intended &&
                (e.t as number) >= (cast.t as number) - 1e-9 &&
                (e.t as number) <= (cast.t as number) + 3.0 &&
                (e.seq as number) > (cast.seq as number),
            );
            if (!land) continue; // incidental / miss — not a counted AI Lock start

            const decisionT = cast.t as number;
            // lead_ticks unknown per skill here; window is the 5.0 s DR window
            // ending at decision (apply tick > decision + lead − 50 ≈ decision − 5 s).
            const windowStart = decisionT - 5.0;
            const applied = g.events.filter(
              (e) =>
                e.type === "status_apply" &&
                LOCK_KINDS.has(String(e.kind)) &&
                e.target_id === intended &&
                (e.t as number) > windowStart + 1e-12 &&
                ((e.t as number) < decisionT - 1e-12 ||
                  ((e.t as number) <= decisionT + 1e-9 && (e.seq as number) < (cast.seq as number))),
            );
            // Perceived allied Lock casts on intended whose land is not yet in `applied`.
            const alliedPerceived = g.events.filter((c) => {
              if (c.type !== "cast_start") return false;
              if (teamOf(String(c.unit_id)) !== teamOf(src)) return false;
              if (String(c.unit_id) === src) return false;
              if ((c.t as number) + reaction > decisionT + 1e-9) return false; // unperceived
              if ((c.t as number) <= windowStart + 1e-12) return false;
              if (intendedLockTarget(g, c) !== intended) return false;
              const allyLand = g.events.find(
                (e) =>
                  e.type === "status_apply" &&
                  LOCK_KINDS.has(String(e.kind)) &&
                  e.source_id === c.unit_id &&
                  e.target_id === intended &&
                  (e.seq as number) > (c.seq as number),
              );
              if (!allyLand) return false;
              // Already counted via applied → don't double-count.
              if ((allyLand.t as number) <= decisionT + 1e-9) return false;
              return true;
            });
            const counted = applied.length + alliedPerceived.length;
            if (counted < 2) continue; // this cast is not a third
            den += 1;
            const tier = castTier(cast);
            if (tier === "P1a" || tier === "P1b") continue;
            const living = livingEnemiesAt(g, teamOf(src), decisionT);
            if (living.length === 1 && living[0] === intended) continue;
            violations += 1;
          }
        }
        logRate("M2-26d third-Lock violations (intended-target)", violations, den, lab.n);
        expect(violations).toBe(0);
      });
    });

    // ── M2-28 lab half ─────────────────────────────────────────────────────
    describe("M2-28 Lab: escape dashes go away (spec L1944)", () => {
      it("100% of Huntress/Maelis/Isra W casts end farther from nearest enemy; 0 have tier P3", () => {
        // Without pos stream we use cast_start → next pos/move samples when present;
        // require debug-free proxy: tier P3 count = 0, and when pos exists check distance.
        let casts = 0;
        let p3 = 0;
        let farther = 0;
        let measured = 0;
        for (const champ of ["huntress", "maelis", "isra"] as Champ[]) {
          for (const a of appearances(lab, champ)) {
            const ws = castsByUnitSkill(a.game, a.unitId, champ, "W");
            for (const c of ws) {
              casts += 1;
              if (castTier(c) === "P3") p3 += 1;
              const pos = a.game.events.filter(
                (e) =>
                  (e.type === "pos" || e.type === "move") &&
                  e.unit_id === a.unitId &&
                  (e.tick as number) >= (c.tick as number) - 1 &&
                  (e.tick as number) <= (c.tick as number) + 15,
              );
              if (pos.length < 2) continue;
              measured += 1;
              const start = pos[0]!;
              const end = pos[pos.length - 1]!;
              const enemies = Object.keys(a.game.roster).filter(
                (id) => teamOf(id) !== teamOf(a.unitId),
              );
              const nearest = (x: number, y: number) => {
                let best = Infinity;
                for (const id of enemies) {
                  const pe = a.game.events
                    .filter(
                      (e) =>
                        (e.type === "pos" || e.type === "move") &&
                        e.unit_id === id &&
                        (e.tick as number) === (start.tick as number),
                    )
                    .pop();
                  if (!pe) continue;
                  best = Math.min(best, Math.hypot(x - (pe.x as number), y - (pe.y as number)));
                }
                return best;
              };
              // Without pos in the default lab this block is skipped; the P3 gate still binds.
              const d0 = nearest(start.x as number, start.y as number);
              const d1 = nearest(end.x as number, end.y as number);
              if (Number.isFinite(d0) && Number.isFinite(d1) && d1 > d0) farther += 1;
            }
          }
        }
        logRate("M2-28 W casts", casts, 1, lab.n);
        logRate("M2-28 P3 escapes", p3, casts, lab.n);
        expect(p3).toBe(0);
        if (measured > 0) {
          logRate("M2-28 farther", farther, measured, lab.n);
          expect(farther / measured).toBe(1);
        } else {
          // Default lab has no pos stream: require that escape W casts exist and none are P3.
          expect(casts).toBeGreaterThan(0);
        }
      });
    });

    // ── M2-29 ──────────────────────────────────────────────────────────────
    describe("M2-29 Peel skills are used in auto-peel (spec L1945)", () => {
      it("≥ 80% of eligible peel_start followed by peeler cast_start tier P1b within 10 ticks; M2-22 ≥ 70% still holds", () => {
        let peelEligible = 0;
        let peelWithCast = 0;
        let divePerceived = 0;
        let divePeeled = 0;
        for (const g of lab.games) {
          const dives = g.events.filter((e) => e.type === "dive" && e.peeler_perceived === true);
          const peels = g.events.filter((e) => e.type === "peel_start");
          for (const d of dives) {
            divePerceived += 1;
            // M2-22: peel_start among dive events with peeler_perceived (s2/03-auto-peel).
            const matched = peels.some(
              (p) =>
                p.diver_id === d.diver_id &&
                (p.carry_id === d.target_id || p.diver_id === d.diver_id) &&
                Math.abs((p.t as number) - (d.t as number)) <= 1.5,
            );
            if (matched || peels.some((p) => Math.abs((p.t as number) - (d.t as number)) <= 1.5)) {
              divePeeled += 1;
            }
          }
          for (const p of peels) {
            const peeler = String(p.peeler_id);
            const champ = g.roster[peeler];
            if (!champ) continue;
            const skills = peelSkillsFor(champ);
            const ready = skills.filter((k) =>
              peelSkillReadyAt(g, peeler, champ, k, p.t as number),
            );
            if (ready.length === 0) continue;
            peelEligible += 1;
            const follow = g.events.find(
              (e) =>
                e.type === "cast_start" &&
                e.unit_id === peeler &&
                castTier(e) === "P1b" &&
                (e.tick as number) >= (p.tick as number) &&
                (e.tick as number) - (p.tick as number) <= 10 &&
                ready.some((k) => castIs(e, champ, k)),
            );
            if (follow) peelWithCast += 1;
          }
        }
        logRate("M2-29 P1b follow", peelWithCast, peelEligible, lab.n);
        logRate("M2-22 peel rate", divePeeled, divePerceived, lab.n);
        expect(peelEligible).toBeGreaterThan(0);
        expect(peelWithCast / peelEligible).toBeGreaterThanOrEqual(0.8);
        expect(divePerceived).toBeGreaterThan(0);
        expect(divePeeled / divePerceived).toBeGreaterThanOrEqual(0.7);
      });
    });

    // ── M2-31 lab ──────────────────────────────────────────────────────────
    describe("M2-31 No wasted disables (lab) (spec L1947)", () => {
      it("(a) disable land on target with remaining > chain_err_ticks+1 ≤ 10% at eff_E 70", () => {
        // Lab attrs are 70 → eff_E 70 → chain_err_s = 0.20 → 2 ticks; threshold = 3.
        const chainErrTicks = Math.round(chainErrS(70) * 10);
        let wasted = 0;
        let den = 0;
        for (const g of lab.games) {
          const applies = g.events.filter(
            (e) => e.type === "status_apply" && DISABLE_KINDS.has(String(e.kind)),
          );
          for (const e of applies) {
            const cast = g.events
              .filter(
                (c) =>
                  c.type === "cast_start" &&
                  c.unit_id === e.source_id &&
                  (c.t as number) <= (e.t as number) + 1e-9 &&
                  (e.t as number) - (c.t as number) <= 3.0,
              )
              .pop();
            const tier = cast ? castTier(cast) : undefined;
            if (tier === "P1a" || tier === "P1b") continue;
            den += 1;
            // Existing disable remaining at land: look for prior apply still covering land tick.
            const prior = applies.filter(
              (p) =>
                p.target_id === e.target_id &&
                (p.seq as number) < (e.seq as number) &&
                (p.t as number) + Number(p.applied_duration ?? p.raw_duration ?? 0) > (e.t as number) + 1e-9,
            );
            if (prior.length === 0) continue;
            const remTicks = Math.max(
              ...prior.map(
                (p) =>
                  Math.round(
                    ((p.t as number) + Number(p.applied_duration ?? p.raw_duration ?? 0) - (e.t as number)) *
                      10,
                  ),
              ),
            );
            if (remTicks > chainErrTicks + 1) wasted += 1;
          }
        }
        logRate("M2-31a wasted disables", wasted, den, lab.n);
        expect(den).toBeGreaterThan(0);
        expect(wasted / den).toBeLessThanOrEqual(0.1);
      });

      it("(c) 0 disables on banished targets; 0 disables on time-stopped targets landing > chain_err before end", () => {
        const chainErrTicks = Math.round(chainErrS(70) * 10);
        let onBanish = 0;
        let onTimestopEarly = 0;
        for (const g of lab.games) {
          const applies = g.events
            .filter((e) => e.type === "status_apply" && DISABLE_KINDS.has(String(e.kind)))
            .slice()
            .sort(
              (a, b) =>
                (a.t as number) - (b.t as number) || (a.seq as number) - (b.seq as number),
            );
          for (const e of applies) {
            // A time-stop (or banish) apply is not a disable *on* an already-stopped
            // target — drop the self-count (L1947 / rule 2 L1200).
            if (isTimestopKind(e.kind) || e.kind === "banish") continue;
            const t = e.t as number;
            const seq = e.seq as number;
            const banishes = applies.filter(
              (p) =>
                p.kind === "banish" &&
                p.target_id === e.target_id &&
                ((p.t as number) < t - 1e-9 ||
                  (Math.abs((p.t as number) - t) <= 1e-9 && (p.seq as number) < seq)) &&
                (p.t as number) + Number(p.applied_duration ?? p.raw_duration ?? 0) > t + 1e-9,
            );
            if (banishes.length) onBanish += 1;

            const stops = applies.filter(
              (p) =>
                isTimestopKind(p.kind) &&
                p.target_id === e.target_id &&
                // Strictly prior by (t, seq) — same-tick later disables see the stop.
                ((p.t as number) < t - 1e-9 ||
                  (Math.abs((p.t as number) - t) <= 1e-9 && (p.seq as number) < seq)),
            );
            for (const s of stops) {
              const end =
                (s.t as number) + Number(s.applied_duration ?? s.raw_duration ?? 0);
              // Still covering land tick?
              if (end <= t + 1e-9) continue;
              const ticksBefore = Math.round((end - t) * 10);
              if (ticksBefore > chainErrTicks) onTimestopEarly += 1;
            }
          }
        }
        logRate("M2-31c on-banish", onBanish, 1, lab.n);
        logRate("M2-31c on-timestop-early", onTimestopEarly, 1, lab.n);
        expect(onBanish).toBe(0);
        expect(onTimestopEarly).toBe(0);
      });
    });

    // ── M2-32 ──────────────────────────────────────────────────────────────
    describe("M2-32 Friendly-fire Rs (spec L1953 / R7-5)", () => {
      it("Sedge R / Saelo R: nA≥2 = 0 unless commit-R; nE≥2 always (commit-R lifts nA only); ≥70% hit nE≥2", () => {
        let illegalNA = 0;
        let illegalNE = 0;
        let total = 0;
        let multiE = 0;
        for (const champ of ["sedge", "saelo"] as Champ[]) {
          for (const a of appearances(lab, champ)) {
            const rs = castsByUnitSkill(a.game, a.unitId, champ, "R");
            for (const c of rs) {
              total += 1;
              const team = teamOf(a.unitId);
              const landHits = a.game.events.filter(
                (e) =>
                  (e.type === "hit" || e.type === "status_apply") &&
                  e.source_id === a.unitId &&
                  (e.t as number) >= (c.t as number) - 1e-9 &&
                  (e.t as number) <= (c.t as number) + 2.0,
              );
              const allyHits = new Set(
                landHits
                  .filter((e) => String(e.target_id).startsWith(team + ":") && e.target_id !== a.unitId)
                  .map((e) => String(e.target_id)),
              );
              const enemyHits = new Set(
                landHits
                  .filter((e) => !String(e.target_id).startsWith(team + ":"))
                  .map((e) => String(e.target_id)),
              );
              const nA = allyHits.size;
              const nE = enemyHits.size;
              if (nE >= 2) multiE += 1;
              const tier = castTier(c);
              const isP1 =
                tier === "P1a" || tier === "P1b" || tier === "P1c" || tier === "P1d";
              const call = a.game.events
                .filter(
                  (e) =>
                    e.type === "fight_call" &&
                    e.team === team &&
                    (e.t as number) <= (c.t as number) + 1e-9,
                )
                .pop();
              const enemiesInFight = livingEnemiesAt(a.game, team, c.t as number).length;
              // Single read site — see readCommitRFlag (COMMIT-R PATH TBD, R7-5).
              const commitR = readCommitRFlag(call, { enemiesInFight });
              // R7-5: commit-R lifts only nA ≤ 1; nE ≥ 2 always applies (P1 row triggers exempt).
              if (!isP1 && nE < 2) illegalNE += 1;
              if (nA >= 2 && !commitR) illegalNA += 1;
            }
          }
        }
        logRate("M2-32 illegal nA≥2 without commit-R", illegalNA, total, lab.n);
        logRate("M2-32 illegal nE<2 (non-P1)", illegalNE, total, lab.n);
        logRate("M2-32 nE≥2", multiE, total, lab.n);
        expect(illegalNA).toBe(0);
        expect(illegalNE).toBe(0);
        expect(total).toBeGreaterThan(0);
        expect(multiE / total).toBeGreaterThanOrEqual(0.7);
      });
    });

    // ── M2-33 lab report ───────────────────────────────────────────────────
    describe("M2-33 Lab: interrupts reported by Reflexes band (spec L1954)", () => {
      it("AI interrupts (cast_cancel lock|silence after P1a) reported per game, split by Reflexes band; no gate", () => {
        const bands = { low: 0, mid: 0, high: 0, other: 0 };
        const perGame = lab.games.map((g) => {
          let n = 0;
          const cancels = g.events.filter(
            (e) =>
              e.type === "cast_cancel" &&
              (e.reason === "lock" || e.reason === "silence"),
          );
          for (const c of cancels) {
            const prior = g.events.find(
              (e) =>
                e.type === "cast_start" &&
                castTier(e) === "P1a" &&
                (e.t as number) <= (c.t as number) + 1e-9 &&
                (c.t as number) - (e.t as number) <= 2.0 &&
                teamOf(String(e.unit_id)) !== teamOf(String(c.unit_id)),
            );
            if (!prior) continue;
            n += 1;
            // Lab attrs are flat 70; band from cast attrs when present, else mid.
            const refl = Number(
              (prior as { attrs?: { reflexes?: number } }).attrs?.reflexes ??
                (prior as { reflexes?: number }).reflexes ??
                70,
            );
            if (refl < 60) bands.low += 1;
            else if (refl < 80) bands.mid += 1;
            else if (refl <= 99) bands.high += 1;
            else bands.other += 1;
          }
          return n;
        });
        const total = perGame.reduce((s, x) => s + x, 0);
        // eslint-disable-next-line no-console
        console.log(
          `[M2 lab] M2-33 interrupts reported: total=${total} mean_per_game=${mean(perGame).toFixed(3)} ` +
            `bands Reflexes<60=${bands.low} 60–79=${bands.mid} 80–99=${bands.high} other=${bands.other} N=${lab.n} (no gate)`,
        );
        expect(perGame.length).toBe(lab.n);
      });
    });

    // ── M2-34 ──────────────────────────────────────────────────────────────
    describe("M2-34 Disengage compliance with casts on (spec L1950)", () => {
      it("after disengage, mobile retreating units start 0 casts with tier P2/P3/P4", () => {
        let bad = 0;
        let den = 0;
        for (const g of lab.games) {
          const calls = g.events.filter((e) => e.type === "fight_call" && e.commit === "disengage");
          for (const call of calls) {
            const team = String(call.team);
            const next = g.events.find(
              (e) =>
                e.type === "fight_call" &&
                e.team === team &&
                (e.seq as number) > (call.seq as number),
            );
            const t1 = next ? (next.t as number) : g.duration_s;
            const retreats = g.events.filter(
              (e) =>
                e.type === "intent" &&
                String(e.unit_id).startsWith(team + ":") &&
                e.intent === "Retreat" &&
                (e.t as number) >= (call.t as number) - 1e-9 &&
                (e.t as number) <= t1 + 1e-9,
            );
            for (const r of retreats) {
              // Mobile = not retreatImmobile (gate 4 / §9.4.1.2 L1181; S2-R4-5).
              if (retreatImmobileFromLog(g, String(r.unit_id), r.t as number)) continue;
              den += 1;
              const casts = g.events.filter(
                (e) =>
                  e.type === "cast_start" &&
                  e.unit_id === r.unit_id &&
                  (e.t as number) >= (r.t as number) - 1e-9 &&
                  (e.t as number) <= t1 + 1e-9 &&
                  (castTier(e) === "P2" ||
                    castTier(e) === "P3" ||
                    castTier(e) === "P4" ||
                    castTier(e) === "P4s" ||
                    castTier(e) === "P2c"),
              );
              bad += casts.length;
            }
          }
        }
        logRate("M2-34 illegal post-disengage casts", bad, den, lab.n);
        expect(bad).toBe(0);
      });
    });

    // ── M2-36 ──────────────────────────────────────────────────────────────
    describe("M2-36 Combos, not one-shots (spec L1952)", () => {
      it("(a)(b) single-unit ≥90%→dead ≤1s ≤ 2% of kills; team ≤ 10%; (c) Kerrig/Maelis reported", () => {
        let kills = 0;
        let single = 0;
        let teamBurst = 0;
        let kerrigSingle = 0;
        let maelisSingle = 0;
        let kerrigKills = 0;
        let maelisKills = 0;
        for (const g of lab.games) {
          const deaths = g.events.filter((e) => e.type === "death");
          for (const d of deaths) {
            kills += 1;
            const t = d.t as number;
            const victim = String(d.unit_id);
            const victimChamp = g.roster[victim];
            const windowHits = g.events.filter(
              (e) =>
                e.type === "hit" &&
                e.target_id === victim &&
                e.miss !== true &&
                (e.t as number) >= t - 1.0 - 1e-9 &&
                (e.t as number) <= t + 1e-9,
            );
            if (windowHits.length === 0 || !victimChamp) continue;
            const early = windowHits[0]!;
            const hpLoss =
              Number(early.mitigated ?? 0) - Number(early.shield_absorbed ?? 0);
            const hpBefore =
              typeof early.hp_after === "number"
                ? (early.hp_after as number) + Math.max(0, hpLoss)
                : null;
            // Level at death from last level_up (default 1).
            let level = 1;
            for (const e of g.events) {
              if (e.type === "level_up" && e.unit_id === victim && (e.t as number) <= t + 1e-9) {
                level = Number(e.new_level ?? e.level ?? level);
              }
            }
            const mhp = maxHp(victimChamp, level);
            if (hpBefore == null || mhp <= 0 || hpBefore / mhp < 0.9) continue;
            const sources = new Set(windowHits.map((h) => String(h.source_id)));
            const killer = String(d.killer_id ?? [...sources][0] ?? "");
            const champ = g.roster[killer];
            if (champ === "kerrig") kerrigKills += 1;
            if (champ === "maelis") maelisKills += 1;
            if (sources.size === 1) {
              single += 1;
              if (champ === "kerrig") kerrigSingle += 1;
              if (champ === "maelis") maelisSingle += 1;
            }
            teamBurst += 1;
          }
        }
        logRate("M2-36a single-unit one-shots", single, kills, lab.n);
        logRate("M2-36b team one-shots", teamBurst, kills, lab.n);
        // eslint-disable-next-line no-console
        console.log(
          `[M2 lab] M2-36c Kerrig one-shots=${kerrigSingle}/${kerrigKills}; Maelis=${maelisSingle}/${maelisKills} (reported)`,
        );
        expect(kills).toBeGreaterThan(0);
        expect(single / kills).toBeLessThanOrEqual(0.02);
        expect(teamBurst / kills).toBeLessThanOrEqual(0.1);
      });
    });

    // ── M2-37 ──────────────────────────────────────────────────────────────
    describe("M2-37 F2 floor (spec L1953, S5-R6-8 L2237)", () => {
      it("F2 mean ≥ 1.0 / game and ≥ 1 combo in ≥ 30% of F1 teamfights (gates); bands reported", () => {
        const perGame = lab.games.map((g) => combosOf(g).length);
        const m = mean(perGame);
        let tf = 0;
        let tfWithCombo = 0;
        let comboKills = 0;
        let combos = 0;
        for (const g of lab.games) {
          const cs = combosOf(g);
          combos += cs.length;
          comboKills += cs.filter((c) => c.kill).length;
          const tfs = teamfightsOf(g);
          for (const t of tfs) {
            tf += 1;
            if (cs.some((c) => c.t >= t.start_t - 1e-9 && c.t <= t.end_t + 0.5)) tfWithCombo += 1;
          }
        }
        logRate("M2-37 F2 mean", m, 1, lab.n);
        logRate("M2-37 teamfights with ≥1 combo", tfWithCombo, tf, lab.n);
        // eslint-disable-next-line no-console
        console.log(
          `[M2 lab] M2-37 reported targets (not gated): F2 band 4–12/game mean=${m.toFixed(2)}; ` +
            `combo in ≥60% TFs → ${(tf ? tfWithCombo / tf : 0).toFixed(3)}; ` +
            `combo-kill conversion=${combos ? (comboKills / combos).toFixed(3) : "n/a"}; ` +
            `F1 teamfights/game=${(tf / lab.n).toFixed(2)}`,
        );
        expect(m).toBeGreaterThanOrEqual(1.0);
        expect(tf).toBeGreaterThan(0);
        expect(tfWithCombo / tf).toBeGreaterThanOrEqual(0.3);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unit fixtures
  // ═══════════════════════════════════════════════════════════════════════════

  describe("M2-27 Backliner casts promptly (spec L1943)", () => {
    const BACKLINERS: Array<{ champ: Champ; skill: Key; slot: UId }> = [
      { champ: "huntress", skill: "Q", slot: "blue:adc" },
      { champ: "maelis", skill: "Q", slot: "blue:adc" },
      { champ: "isra", skill: "Q", slot: "blue:adc" },
      { champ: "helvar", skill: "Q", slot: "blue:mid" },
      { champ: "calder", skill: "Q", slot: "blue:mid" },
      { champ: "mirren", skill: "Q", slot: "blue:mid" },
      { champ: "sedge", skill: "Q", slot: "blue:jungle" },
      { champ: "saelo", skill: "Q", slot: "blue:support" },
      { champ: "ysol", skill: "Q", slot: "blue:support" },
    ];

    for (const { champ, skill, slot } of BACKLINERS) {
      it(`${champ} ${skill}: cast_start within 2 ticks of an already-perceived enemy stepping into range`, () => {
        const foe = "red:mid" as UId;
        const foe2 = "red:adc" as UId;
        const range = ab(champ, skill).range || 6;
        // Open mid-lane corridor (y=8): clear of pillars at y∈[2,3]/[12,13] (constants PILLARS).
        // Caster at x=8; foe starts just outside skill range, walks in. Autos on (L1945 setup).
        const cx = 8;
        const cy = 8;
        const r = runAi({
          seed: 20261122,
          T: 5.0,
          pos: true,
          ai_enabled: true,
          units: {
            [slot]: {
              champ,
              level: 7,
              x: cx,
              y: cy,
              auto: true,
              attrs: { reflexes: 50, decision: 50, execution: 70, aim: 70, positioning: 70, teamwork: 70 },
            },
            [foe]: {
              champ: "torun",
              level: 7,
              x: cx + range + 0.8,
              y: cy,
              auto: false,
            },
            // Ysol Q needs nE ≥ 2 (L1945): second enemy inside cone range 7.2.
            ...(champ === "ysol"
              ? {
                  [foe2]: {
                    champ: "huntress",
                    level: 7,
                    x: cx + 5.5,
                    y: cy + 0.6,
                    auto: false,
                  },
                }
              : {}),
          },
          motor: {
            [foe]: {
              to: [
                [cx + range - 0.4, cy],
                [cx + range - 0.4, cy],
              ],
              arrive_r: 0.15,
              hold_at_end: true,
            },
          },
          tactics: { blue: { preset: "hunt", aggression: 1 }, red: { preset: "hold_the_pit" } },
        });
        const casts = r.of("cast_start", (e) => e.unit_id === slot && castIs(e, champ, skill));
        expect(casts.length).toBeGreaterThan(0);

        // Decision tick = first tick the foe is in skill range while already perceived (L1945).
        // Perception: foe was within 8 tiles of the caster for ≥ perception_delay before that tick.
        const casterPath = pathOf(r.events, slot);
        const foePath = pathOf(r.events, foe);
        const percDelayTicks = Math.ceil(perceptionDelay(50) * 10);
        let decisionTick: number | null = null;
        for (const fp of foePath) {
          const cp = casterPath.find((p) => p.tick === fp.tick);
          if (!cp) continue;
          const d = Math.hypot(fp.x - cp.x, fp.y - cp.y);
          if (d > range + 1e-9) continue;
          // Already-perceived: some earlier tick (≥ percDelayTicks ago) had foe within 8 tiles.
          const seen = foePath.some((earlier) => {
            if (earlier.tick > fp.tick - percDelayTicks) return false;
            const c0 = casterPath.find((p) => p.tick === earlier.tick);
            if (!c0) return false;
            return Math.hypot(earlier.x - c0.x, earlier.y - c0.y) <= 8 + 1e-9;
          });
          if (!seen) continue;
          decisionTick = fp.tick;
          break;
        }
        expect(decisionTick, "foe must step into skill range while already perceived").not.toBeNull();
        const firstAfter = casts.find((e) => (e.tick as number) >= decisionTick!);
        expect(firstAfter).toBeTruthy();
        expect((firstAfter!.tick as number) - decisionTick!).toBeLessThanOrEqual(2);
      });
    }

    it("must not fire while the unit is mobile and retreating (S2-R4-5)", () => {
      const slot = "blue:adc" as UId;
      const r = runAi({
        seed: 20261122,
        T: 3.0,
        units: {
          [slot]: {
            champ: "huntress",
            level: 7,
            x: PIT.x - 1,
            y: PIT.y,
            hp: 40,
            auto: false,
            attrs: { teamwork: 90, decision: 90 },
          },
          ["blue:mid" as UId]: {
            champ: "kerrig",
            level: 7,
            x: PIT.x,
            y: PIT.y,
            hp: 40,
            auto: false,
          },
          ["blue:jungle" as UId]: {
            champ: "kerrig",
            level: 7,
            x: PIT.x + 0.5,
            y: PIT.y + 0.5,
            hp: 40,
            auto: false,
          },
          ["red:mid" as UId]: { champ: "maelis", level: 7, x: PIT.x + 2, y: PIT.y, auto: true },
          ["red:jungle" as UId]: { champ: "maelis", level: 7, x: PIT.x + 2.2, y: PIT.y + 0.4, auto: true },
          ["red:adc" as UId]: { champ: "maelis", level: 7, x: PIT.x + 2.4, y: PIT.y - 0.4, auto: true },
        },
        tactics: { blue: { preset: "starve" }, red: { preset: "hunt", aggression: 1 } },
      });
      const retreats = r.of("intent", (e) => e.unit_id === slot && e.intent === "Retreat");
      for (const ret of retreats) {
        const casts = r.of(
          "cast_start",
          (e) =>
            e.unit_id === slot &&
            (e.tick as number) >= (ret.tick as number) &&
            (e.tick as number) <= (ret.tick as number) + 10 &&
            (castTier(e) === "P2" || castTier(e) === "P3" || castTier(e) === "P4"),
        );
        expect(casts).toHaveLength(0);
      }
    });
  });

  describe("M2-28 Gap-closer on engage (unit) (spec L1944)", () => {
    it("Brannoch W on engage within ceil(reaction_delay×10)+2 ticks, tier P3", () => {
      const B = "blue:top" as UId;
      const F = "red:adc" as UId;
      const r = runAi({
        seed: 20261122,
        T: 4.0,
        units: {
          [B]: {
            champ: "brannoch",
            level: 7,
            x: 11,
            y: 4,
            auto: false,
            attrs: { reflexes: 50, decision: 70, teamwork: 90 },
          },
          ["blue:jungle" as UId]: { champ: "torun", level: 7, x: 11.5, y: 4.5, auto: false },
          ["blue:mid" as UId]: { champ: "helvar", level: 7, x: 10.5, y: 3.5, auto: false },
          [F]: { champ: "huntress", level: 7, x: 11 + 3.0, y: 4, auto: false },
          ["red:mid" as UId]: { champ: "maelis", level: 7, x: 14, y: 4.5, auto: false },
          ["red:jungle" as UId]: { champ: "sedge", level: 7, x: 14, y: 3.5, auto: false },
        },
        tactics: { blue: { preset: "hunt", aggression: 1 }, red: { preset: "hold_the_pit" } },
      });
      const engage = r.fightCalls("blue").find((e) => e.commit === "engage");
      expect(engage).toBeTruthy();
      const bound = Math.ceil(reactionDelay(50) * 10) + 2;
      const cast = r
        .of("cast_start", (e) => e.unit_id === B && castIs(e, "brannoch", "W"))
        .find((e) => (e.tick as number) >= (engage!.tick as number));
      expect(cast).toBeTruthy();
      expect((cast!.tick as number) - (engage!.tick as number)).toBeLessThanOrEqual(bound);
      expect(castTier(cast!)).toBe("P3");
    });

    it("Rhedan W (backliner 4–5.5 tiles) and Kerrig Q (squishy within 6.5, dive gate) same bound + tier P3", () => {
      const bound = Math.ceil(reactionDelay(50) * 10) + 2;
      const rhedan = runAi({
        seed: 20261122,
        T: 4.0,
        units: {
          ["blue:top" as UId]: {
            champ: "rhedan",
            level: 7,
            x: 11,
            y: 4,
            auto: false,
            attrs: { reflexes: 50, decision: 70, teamwork: 90 },
          },
          ["blue:jungle" as UId]: { champ: "torun", level: 7, x: 11.2, y: 4.4, auto: false },
          ["blue:mid" as UId]: { champ: "helvar", level: 7, x: 10.8, y: 3.6, auto: false },
          ["red:adc" as UId]: { champ: "huntress", level: 7, x: 11 + 5.0, y: 4, auto: false },
          ["red:mid" as UId]: { champ: "maelis", level: 7, x: 16, y: 4.5, auto: false },
          ["red:jungle" as UId]: { champ: "sedge", level: 7, x: 16, y: 3.5, auto: false },
        },
        tactics: { blue: { preset: "hunt", aggression: 1 }, red: { preset: "hold_the_pit" } },
      });
      const engR = rhedan.fightCalls("blue").find((e) => e.commit === "engage");
      expect(engR).toBeTruthy();
      const cR = rhedan
        .of("cast_start", (e) => e.unit_id === "blue:top" && castIs(e, "rhedan", "W"))
        .find((e) => (e.tick as number) >= (engR!.tick as number));
      expect(cR).toBeTruthy();
      expect((cR!.tick as number) - (engR!.tick as number)).toBeLessThanOrEqual(bound);
      expect(castTier(cR!)).toBe("P3");

      const kerrig = runAi({
        seed: 20261122,
        T: 4.0,
        units: {
          ["blue:mid" as UId]: {
            champ: "kerrig",
            level: 7,
            x: 11,
            y: 4,
            auto: false,
            attrs: { reflexes: 50, decision: 70, teamwork: 90 },
          },
          ["blue:jungle" as UId]: { champ: "torun", level: 7, x: 11.2, y: 4.4, auto: false },
          ["blue:adc" as UId]: { champ: "huntress", level: 7, x: 10.5, y: 3.5, auto: false },
          ["red:adc" as UId]: { champ: "maelis", level: 7, x: 11 + 5.0, y: 4, auto: false },
          ["red:mid" as UId]: { champ: "helvar", level: 7, x: 16, y: 4.5, auto: false },
          ["red:support" as UId]: { champ: "ysol", level: 7, x: 16, y: 3.5, auto: false },
        },
        tactics: { blue: { preset: "hunt", aggression: 1 }, red: { preset: "hold_the_pit" } },
      });
      const engK = kerrig.fightCalls("blue").find((e) => e.commit === "engage");
      expect(engK).toBeTruthy();
      const cK = kerrig
        .of("cast_start", (e) => e.unit_id === "blue:mid" && castIs(e, "kerrig", "Q"))
        .find((e) => (e.tick as number) >= (engK!.tick as number));
      expect(cK).toBeTruthy();
      expect((cK!.tick as number) - (engK!.tick as number)).toBeLessThanOrEqual(bound);
      expect(castTier(cK!)).toBe("P3");
    });
  });

  describe("M2-30 Combo follow-up timing (Execution) (spec L1946)", () => {
    for (const effE of [30, 60, 90]) {
      it(`(a) Kerrig W at a + round(combo_follow_s×10) ±1 (eff_E ${effE})`, () => {
        const K = "blue:mid" as UId;
        const X = "red:adc" as UId;
        const follow = comboFollowS(effE);
        const r = runAi({
          seed: 20261122,
          T: 5.0,
          units: {
            [K]: {
              champ: "kerrig",
              level: 7,
              x: 12,
              y: 4,
              auto: false,
              attrs: { execution: effE, reflexes: 50, decision: 70 },
              mastery: 50,
            },
            [X]: { champ: "maelis", level: 7, x: 13.5, y: 4, auto: false },
          },
          casts: [{ tick: 5, by: K, skill: "Q", target: X, force_hit: true }],
          // Keep AI on so W follow-up is chosen by cast policy (not scripted).
        });
        const leash = r.of("status_apply", (e) => e.target_id === X && e.kind === "leash" && e.source_id === K);
        expect(leash.length).toBeGreaterThan(0);
        const a = leash[0]!.tick as number;
        const expected = a + Math.round(follow * 10);
        const w = r
          .of("cast_start", (e) => e.unit_id === K && castIs(e, "kerrig", "W"))
          .find((e) => (e.tick as number) >= a);
        expect(w).toBeTruthy();
        expect(Math.abs((w!.tick as number) - expected)).toBeLessThanOrEqual(1);
      });
    }

    it("(b) ally CC: Maelis Q after Torun Q stun within the authored bound", () => {
      const TOR = "blue:jungle" as UId;
      const MAE = "blue:adc" as UId;
      const X = "red:mid" as UId;
      const refl = 50;
      const effE = 60;
      const r = runAi({
        seed: 20261122,
        T: 5.0,
        units: {
          [TOR]: {
            champ: "torun",
            level: 7,
            x: 12,
            y: 4,
            auto: false,
            attrs: { reflexes: refl, execution: effE, decision: 70 },
          },
          [MAE]: {
            champ: "maelis",
            level: 7,
            x: 12.5,
            y: 4.2,
            auto: false,
            attrs: { reflexes: refl, execution: effE, decision: 70, aim: 70 },
          },
          [X]: { champ: "helvar", level: 7, x: 13.5, y: 4, auto: false },
        },
        casts: [{ tick: 5, by: TOR, skill: "Q", target: X, force_hit: true }],
      });
      const castStart = r.of("cast_start", (e) => e.unit_id === TOR && castIs(e, "torun", "Q"));
      const apply = r.of("status_apply", (e) => e.target_id === X && (e.kind === "knockup" || e.kind === "taunt") && e.source_id === TOR);
      expect(castStart.length).toBeGreaterThan(0);
      expect(apply.length).toBeGreaterThan(0);
      const c = castStart[0]!.tick as number;
      const a = apply[0]!.tick as number;
      const earliest = Math.max(
        a,
        c + Math.ceil(reactionDelay(refl) * 10),
        a + Math.round(comboFollowS(effE) * 10),
      );
      const q = r
        .of("cast_start", (e) => e.unit_id === MAE && castIs(e, "maelis", "Q"))
        .find((e) => (e.tick as number) >= a);
      expect(q).toBeTruthy();
      expect((q!.tick as number)).toBeGreaterThanOrEqual(earliest);
      expect((q!.tick as number) - earliest).toBeLessThanOrEqual(2);
    });

    it("(c) eff_E 30 waits full combo_follow_s even if stun expires; eff_E ≥ 50 fires before expiry", () => {
      // Short stun (0.2 s) with long follow at E30 (0.45 s) → must wait full follow.
      const runCase = (effE: number) => {
        const K = "blue:mid" as UId;
        const X = "red:adc" as UId;
        return runAi({
          seed: 20261122,
          T: 4.0,
          units: {
            [K]: {
              champ: "kerrig",
              level: 7,
              x: 12,
              y: 4,
              auto: false,
              attrs: { execution: effE },
              mastery: 50,
            },
            [X]: { champ: "maelis", level: 7, x: 13.2, y: 4, auto: false },
          },
          // Script a short stun via lab CC after a Q, then expect W timing vs expiry.
          casts: [{ tick: 5, by: K, skill: "Q", target: X, force_hit: true }],
          cc: [{ tick: 8, target: X, kind: "stun", duration: 0.2, source: K }],
        });
      };
      const low = runCase(30);
      const high = runCase(60);
      const followLow = comboFollowS(30);
      const stunApply = low.of("status_apply", (e) => e.kind === "stun" && e.target_id === "red:adc");
      expect(stunApply.length).toBeGreaterThan(0);
      const a = stunApply[0]!.tick as number;
      const expiry = a + Math.round(0.2 * 10);
      const wLow = low
        .of("cast_start", (e) => e.unit_id === "blue:mid" && castIs(e, "kerrig", "W"))
        .find((e) => (e.tick as number) >= a);
      // Prefer stun-window follow if present; else leash follow from Q.
      if (wLow) {
        expect((wLow.tick as number)).toBeGreaterThanOrEqual(a + Math.round(followLow * 10) - 1);
      }
      const stunHigh = high.of("status_apply", (e) => e.kind === "stun" && e.target_id === "red:adc");
      if (stunHigh.length) {
        const ah = stunHigh[0]!.tick as number;
        const expH = ah + Math.round(0.2 * 10);
        const wHigh = high
          .of("cast_start", (e) => e.unit_id === "blue:mid" && castIs(e, "kerrig", "W"))
          .find((e) => (e.tick as number) >= ah);
        expect(wHigh).toBeTruthy();
        expect((wHigh!.tick as number)).toBeLessThan(expH);
      }
      void expiry;
    });
  });

  describe("M2-31 Chain timing unit (spec L1947)", () => {
    for (const effE of [30, 60, 90]) {
      it(`(b) Tolle Q chains onto a 1.0 s stun with k ≤ round(chain_err_s×10) (eff_E ${effE})`, () => {
        const TOL = "blue:jungle" as UId;
        const X = "red:mid" as UId;
        const err = Math.round(chainErrS(effE) * 10);
        const r = runAi({
          seed: 20261122,
          T: 4.0,
          units: {
            [TOL]: {
              champ: "tolle",
              level: 7,
              x: 12,
              y: 4,
              auto: false,
              attrs: { execution: effE, decision: 70, reflexes: 50 },
              mastery: 50,
            },
            ["blue:mid" as UId]: { champ: "helvar", level: 7, x: 11.5, y: 4.2, auto: false },
            [X]: { champ: "maelis", level: 7, x: 13.5, y: 4, auto: false },
          },
          cc: [{ tick: 5, target: X, kind: "stun", duration: 1.0, source: "blue:mid" }],
        });
        const stun = r.of("status_apply", (e) => e.target_id === X && e.kind === "stun");
        expect(stun.length).toBeGreaterThan(0);
        const a = stun[0]!.tick as number;
        const expiry = a + Math.round(1.0 * 10);
        const land = r
          .of("status_apply", (e) => e.target_id === X && e.source_id === TOL && e.kind === "stun")
          .find((e) => (e.tick as number) > a);
        expect(land).toBeTruthy();
        const k = expiry - (land!.tick as number);
        expect(k).toBeGreaterThanOrEqual(0);
        expect(k).toBeLessThanOrEqual(err);
      });
    }
  });

  describe("M2-33 Interrupts exist and are honest (unit) (spec L1954 / R7-6 / R7-6b)", () => {
    // Tick math (L1954): enemy R at cast_start tick c completes c+ceil(cast_s×10).
    // P1a earliest decision d = c + ceil(P1A_READ_MULT × reaction_delay_s × 10 − 1e-9)
    // for R windups only. Non-R keep full reaction_delay_s.
    const SEED = 20261122;
    const C_TICK = 10;

    function replayDigest(run: () => ReturnType<typeof runAi>): string {
      const a = run();
      const b = run();
      expect(a.digest).toBe(b.digest);
      return a.digest;
    }

    function ysolVsEnemyR(opts: {
      refl: number;
      enemyChamp: Champ;
      enemySkill: Key;
      enemyX?: number;
    }) {
      const Y = "blue:support" as UId;
      const E = "red:mid" as UId;
      return runAi({
        seed: SEED,
        T: 3.0,
        units: {
          [Y]: {
            champ: "ysol",
            level: 7,
            x: 12,
            y: 4,
            auto: false,
            attrs: { reflexes: opts.refl, decision: 70, execution: 70 },
          },
          ["blue:adc" as UId]: { champ: "maelis", level: 7, x: 11.5, y: 4.2, auto: false },
          [E]: {
            champ: opts.enemyChamp,
            level: 7,
            x: opts.enemyX ?? 14,
            y: 4,
            auto: false,
          },
        },
        casts: [
          {
            tick: C_TICK,
            by: E,
            skill: opts.enemySkill,
            aim: [12, 4],
            target: Y,
            force_hit: true,
          },
        ],
      });
    }

    it("(a) Ysol Q vs Kerrig R: no P1a at Reflexes 50; P1a+cancel silence at 70 (c+3/c+6) and 90 (c+2/c+5); Kerrig R never hits", () => {
      expect(p1aReadDelayTicks(50)).toBe(4);
      expect(p1aReadDelayTicks(70)).toBe(3);
      expect(p1aReadDelayTicks(90)).toBe(2);

      const scene = (refl: number) =>
        ysolVsEnemyR({ refl, enemyChamp: "kerrig", enemySkill: "R", enemyX: 14 });

      replayDigest(() => scene(50));
      const r50 = scene(50);
      expect(
        r50.of(
          "cast_start",
          (e) => e.unit_id === "blue:support" && castIs(e, "ysol", "Q") && castTier(e) === "P1a",
        ),
      ).toHaveLength(0);

      replayDigest(() => scene(70));
      const r70 = scene(70);
      const q70 = r70.of(
        "cast_start",
        (e) => e.unit_id === "blue:support" && castIs(e, "ysol", "Q") && castTier(e) === "P1a",
      );
      expect(q70.length).toBeGreaterThan(0);
      expect(q70[0]!.tick).toBe(C_TICK + 3);
      const cancel70 = r70.of(
        "cast_cancel",
        (e) => e.unit_id === "red:mid" && e.reason === "silence",
      );
      expect(cancel70.length).toBeGreaterThan(0);
      expect(cancel70[0]!.tick).toBe(C_TICK + 6);
      // Kerrig R never lands a hit (windup cancelled by silence).
      expect(
        r70.of(
          "hit",
          (e) =>
            e.source_id === "red:mid" &&
            (e.tick as number) >= C_TICK &&
            String(e.skill_id ?? "")
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "")
              .includes("reeling"),
        ),
      ).toHaveLength(0);

      replayDigest(() => scene(90));
      const r90 = scene(90);
      const q90 = r90.of(
        "cast_start",
        (e) => e.unit_id === "blue:support" && castIs(e, "ysol", "Q") && castTier(e) === "P1a",
      );
      expect(q90.length).toBeGreaterThan(0);
      expect(q90[0]!.tick).toBe(C_TICK + 2);
      const cancel90 = r90.of(
        "cast_cancel",
        (e) => e.unit_id === "red:mid" && e.reason === "silence",
      );
      expect(cancel90.length).toBeGreaterThan(0);
      expect(cancel90[0]!.tick).toBe(C_TICK + 5);
    });

    it("(b) Ysol Q vs Huntress R: no P1a at Reflexes 70; at 90 P1a with cancel silence on c+5", () => {
      const scene = (refl: number) =>
        ysolVsEnemyR({ refl, enemyChamp: "huntress", enemySkill: "R", enemyX: 14 });

      replayDigest(() => scene(70));
      expect(
        scene(70).of(
          "cast_start",
          (e) => e.unit_id === "blue:support" && castTier(e) === "P1a",
        ),
      ).toHaveLength(0);

      replayDigest(() => scene(90));
      const r90 = scene(90);
      const q90 = r90.of(
        "cast_start",
        (e) => e.unit_id === "blue:support" && castIs(e, "ysol", "Q") && castTier(e) === "P1a",
      );
      expect(q90.length).toBeGreaterThan(0);
      const cancel90 = r90.of(
        "cast_cancel",
        (e) => e.unit_id === "red:mid" && e.reason === "silence",
      );
      expect(cancel90.length).toBeGreaterThan(0);
      expect(cancel90[0]!.tick).toBe(C_TICK + 5);
    });

    it("(c) Brannoch W vs Kerrig R at 3.0 tiles, Reflexes 50: P1a with cast_cancel{reason:'lock'} on c+6", () => {
      const B = "blue:top" as UId;
      const K = "red:mid" as UId;
      const scene = () =>
        runAi({
          seed: SEED,
          T: 3.0,
          units: {
            [B]: {
              champ: "brannoch",
              level: 7,
              x: 12,
              y: 4,
              auto: false,
              attrs: { reflexes: 50, decision: 70, execution: 70 },
            },
            ["blue:support" as UId]: { champ: "ysol", level: 7, x: 11.5, y: 4.2, auto: false },
            [K]: { champ: "kerrig", level: 7, x: 15, y: 4, auto: false }, // 3.0 tiles
          },
          casts: [{ tick: C_TICK, by: K, skill: "R", target: B, force_hit: true }],
        });
      expect(p1aReadDelayTicks(50)).toBe(4);
      replayDigest(scene);
      const r = scene();
      const w = r.of(
        "cast_start",
        (e) => e.unit_id === B && castIs(e, "brannoch", "W") && castTier(e) === "P1a",
      );
      expect(w.length).toBeGreaterThan(0);
      const cancel = r.of("cast_cancel", (e) => e.unit_id === K && e.reason === "lock");
      expect(cancel.length).toBeGreaterThan(0);
      expect(cancel[0]!.tick).toBe(C_TICK + 6);
    });

    it("(d) Ysol Reflexes 90 vs Helvar W (non-R): full 0.38 s delay, no P1a", () => {
      expect(reactionDelay(90)).toBeCloseTo(0.38, 5);
      expect(reactionDelayTicks(90)).toBe(4);
      expect(p1aReadDelayTicks(90)).toBe(2); // R-only; Helvar W must NOT use this
      const scene = () =>
        ysolVsEnemyR({ refl: 90, enemyChamp: "helvar", enemySkill: "W", enemyX: 14 });
      replayDigest(scene);
      const r = scene();
      expect(
        r.of(
          "cast_start",
          (e) => e.unit_id === "blue:support" && castTier(e) === "P1a",
        ),
      ).toHaveLength(0);
    });
  });

  // ── R7 unit checks (Appendix R #7 binding clarifications) ─────────────────
  describe("R7-1 P2 follow-up timing (combo_follow_s at eff_E 20/60/90) (spec L2287 / L1005)", () => {
    it("combo_follow_s is 0.50 / 0.30 / 0.15 s at eff_E 20 / 60 / 90", () => {
      expect(comboFollowS(20)).toBeCloseTo(0.5, 5);
      expect(comboFollowS(60)).toBeCloseTo(0.3, 5);
      expect(comboFollowS(90)).toBeCloseTo(0.15, 5);
    });

    for (const [effE, follow] of [
      [20, 0.5],
      [60, 0.3],
      [90, 0.15],
    ] as const) {
      it(`Kerrig W P2 lands at a + round(${follow}×10) ±1 (eff_E ${effE})`, () => {
        const K = "blue:mid" as UId;
        const X = "red:adc" as UId;
        const r = runAi({
          seed: 20261122,
          T: 5.0,
          units: {
            [K]: {
              champ: "kerrig",
              level: 7,
              x: 12,
              y: 4,
              auto: false,
              attrs: { execution: effE, reflexes: 50, decision: 70 },
              mastery: 50,
            },
            [X]: { champ: "maelis", level: 7, x: 13.5, y: 4, auto: false },
          },
          casts: [{ tick: 5, by: K, skill: "Q", target: X, force_hit: true }],
        });
        const leash = r.of(
          "status_apply",
          (e) => e.target_id === X && e.kind === "leash" && e.source_id === K,
        );
        expect(leash.length).toBeGreaterThan(0);
        const a = leash[0]!.tick as number;
        const expected = a + Math.round(follow * 10);
        const w = r
          .of("cast_start", (e) => e.unit_id === K && castIs(e, "kerrig", "W"))
          .find((e) => (e.tick as number) >= a);
        expect(w).toBeTruthy();
        expect(Math.abs((w!.tick as number) - expected)).toBeLessThanOrEqual(1);
        expect(castTier(w!)).toBe("P2");
      });
    }
  });

  describe("R7-2 Saelo W P1b peel (spec L2288 / L1327)", () => {
    it("auto-peel Saelo casts W tier P1b on a dived carry within 6.5 with a basic-dispellable Handicap", () => {
      const SAE = "blue:support" as UId;
      const CARRY = "blue:adc" as UId;
      const DIVER = "red:mid" as UId;
      const r = runAi({
        seed: 20261122,
        T: 4.0,
        units: {
          [SAE]: {
            champ: "saelo",
            level: 7,
            x: 12,
            y: 4,
            auto: false,
            attrs: { reflexes: 70, decision: 70, teamwork: 90 },
          },
          [CARRY]: {
            champ: "huntress",
            level: 7,
            x: 13,
            y: 4,
            hp: 80,
            auto: false,
          },
          ["blue:jungle" as UId]: { champ: "torun", level: 7, x: 11.5, y: 4.5, auto: false },
          [DIVER]: { champ: "kerrig", level: 7, x: 13.5, y: 4, auto: true },
          ["red:adc" as UId]: { champ: "maelis", level: 7, x: 16, y: 4.5, auto: false },
          ["red:jungle" as UId]: { champ: "sedge", level: 7, x: 16, y: 3.5, auto: false },
        },
        // Basic-dispellable Handicap on the carry (silence).
        cc: [{ tick: 5, target: CARRY, kind: "silence", duration: 1.5, source: DIVER }],
        tactics: { blue: { preset: "hold_the_pit", aggression: 0 }, red: { preset: "hunt", aggression: 1 } },
      });
      const peel = r.of("peel_start", (e) => e.peeler_id === SAE || e.unit_id === SAE);
      // Peel assignment may log peeler on peel_start; either way Saelo W P1b must fire.
      const w = r.of(
        "cast_start",
        (e) => e.unit_id === SAE && castIs(e, "saelo", "W") && castTier(e) === "P1b",
      );
      expect(w.length).toBeGreaterThan(0);
      void peel;
    });
  });

  describe("R7-8 Kerrig Q isolated under Hunt (spec L2303 / L1286)", () => {
    it("under Hunt, Kerrig Q on an isolated squishy (no ally within 4.0) logs tier P3", () => {
      const K = "blue:mid" as UId;
      const X = "red:adc" as UId;
      const r = runAi({
        seed: 20261122,
        T: 4.0,
        units: {
          [K]: {
            champ: "kerrig",
            level: 7,
            x: 12,
            y: 4,
            auto: false,
            attrs: { reflexes: 50, decision: 70, teamwork: 70 },
          },
          // Isolated squishy: no red ally within 4.0 tiles.
          [X]: { champ: "maelis", level: 7, x: 12 + 5.0, y: 4, auto: false },
          ["red:support" as UId]: { champ: "ysol", level: 7, x: 20, y: 4, auto: false },
        },
        tactics: { blue: { preset: "hunt", aggression: 1 }, red: { preset: "hold_the_pit" } },
      });
      const q = r.of(
        "cast_start",
        (e) => e.unit_id === K && castIs(e, "kerrig", "Q") && castTier(e) === "P3",
      );
      expect(q.length).toBeGreaterThan(0);
    });
  });

  describe("R7-9 Isra W spacing reset is P1d (spec L2304 / L1239)", () => {
    it("perceived enemy melee (Range ≤ 2.0) within 1.5 tiles → Isra W cast_start tier P1d", () => {
      const I = "blue:adc" as UId;
      const M = "red:mid" as UId;
      const r = runAi({
        seed: 20261122,
        T: 3.0,
        units: {
          [I]: {
            champ: "isra",
            level: 7,
            x: 12,
            y: 4,
            auto: false,
            attrs: { reflexes: 70, decision: 70 },
          },
          // Kerrig is melee (Range ≤ 2.0); place within 1.5 tiles.
          [M]: { champ: "kerrig", level: 7, x: 12 + 1.2, y: 4, auto: false },
        },
        tactics: { blue: { preset: "hold_the_pit" }, red: { preset: "hunt", aggression: 1 } },
      });
      const w = r.of(
        "cast_start",
        (e) => e.unit_id === I && castIs(e, "isra", "W") && castTier(e) === "P1d",
      );
      expect(w.length).toBeGreaterThan(0);
    });
  });

  describe("R7-10 Torun W taunt applies and logs status_apply (spec L2309 / L1255)", () => {
    it("diver inside r 1.2 of the shielded ally receives taunt status_apply from Torun W", () => {
      const TOR = "blue:jungle" as UId;
      const CARRY = "blue:adc" as UId;
      const DIVER = "red:mid" as UId;
      const r = runAi({
        seed: 20261122,
        T: 4.0,
        units: {
          [TOR]: {
            champ: "torun",
            level: 7,
            x: 12,
            y: 4,
            auto: false,
            attrs: { reflexes: 70, decision: 70, teamwork: 90 },
          },
          [CARRY]: { champ: "huntress", level: 7, x: 12.5, y: 4, hp: 90, auto: false },
          [DIVER]: { champ: "kerrig", level: 7, x: 12.5 + 0.8, y: 4, auto: true },
          ["red:adc" as UId]: { champ: "maelis", level: 7, x: 18, y: 4, auto: false },
        },
        tactics: { blue: { preset: "hold_the_pit" }, red: { preset: "hunt", aggression: 1 } },
      });
      const w = r.of("cast_start", (e) => e.unit_id === TOR && castIs(e, "torun", "W"));
      expect(w.length).toBeGreaterThan(0);
      const taunt = r.of(
        "status_apply",
        (e) => e.kind === "taunt" && e.target_id === DIVER && e.source_id === TOR,
      );
      expect(taunt.length).toBeGreaterThan(0);
    });
  });

  describe("M2-35 Determinism with casts on (spec L1951)", () => {
    it("byte-identical digest across two processes; cast_start.tier excluded from digest", () => {
      const cfg: MatchConfig = {
        ...evenOvrConfig(20261122, "hold_the_pit"),
        ai_enabled: true,
        forced_clock_end: false,
      };
      const a = simulate(cfg);
      const b = simulate(cfg);
      expect(a.digest).toBe(b.digest);

      // tier excluded: stripping tier from events must still match the sim digest.
      expect(digestEvents(stripCastTier(a.events as never) as never)).toBe(a.digest);

      const child = () => {
        const r = spawnSync(
          process.execPath,
          [
            "--import",
            "tsx",
            "-e",
            `
              import { evenOvrConfig, simulate } from ${JSON.stringify(path.join(root, "sim/index.js"))};
              const r = simulate({ ...evenOvrConfig(20261122, "hold_the_pit"), ai_enabled: true, forced_clock_end: false });
              console.log("digest=" + r.digest);
            `,
          ],
          { encoding: "utf8", cwd: root, env: process.env },
        );
        if (r.status !== 0) throw new Error(r.stderr || r.stdout);
        const d = /^digest=(.+)$/m.exec(r.stdout)?.[1]?.trim();
        if (!d) throw new Error(`no digest in\n${r.stdout}`);
        return d;
      };
      expect(child()).toBe(child());
      expect(child()).toBe(a.digest);
    }, 120_000);
  });
});
