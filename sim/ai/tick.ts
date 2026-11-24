/**
 * Phase 2 AI tick: Fight Call → peel/dive → Unit Brain.
 * Decisions use only seeded RNG (ai stream) and sim state — no wall clock / Math.random.
 *
 * Appendix R #3:
 * - OQ-S2-3: fight_call on the tick AFTER fight-start / fight-end / death is detected.
 * - OQ-S2-4: fight_call carries a_commit + shotcaller_id; dive events.
 * - OQ-S2-7: intent only when it changes (first-class digest event).
 */
import { beginCast } from "../cast.js";
import { createCastMemory, notePolicyCast, observeCastMemory } from "./cast_policy.js";
import type { Constants } from "../constants.js";
import type { RngBank } from "../rng.js";
import { isBanished } from "../status.js";
import type { MatchConfig, MatchState, Team, UnitId } from "../types.js";
import { retreatImmobile } from "../retreat_combat.js";
import { hystS, mistakeBand, regroupS } from "./attributes.js";
import { brainDecide, type ChaseState } from "./brain.js";
import {
  canFlipCommit,
  chooseCommit,
  evaluateFight,
  fightIssuesCall,
  shouldRunL1,
  shotcaller,
  type CommitKind,
  type FightSnapshot,
} from "./fight.js";
import { detectDives, updatePerceptionSeen } from "./peel.js";
import { chooseFocus } from "./target.js";

export interface AiRuntime {
  last_l1_t: number;
  last_flip_t: Record<Team, number>;
  commit: Record<Team, CommitKind>;
  focus: Record<Team, UnitId | null>;
  chase: Partial<Record<UnitId, ChaseState>>;
  peel_diver: Partial<Record<UnitId, UnitId>>;
  intent_target: Partial<Record<UnitId, UnitId | null>>;
  dive_geom: number;
  peel_fired: number;
  prev_geom_fight: boolean;
  /** Queue L1 for next tick (OQ-S2-3) with the snap that triggered it. */
  pending_l1: boolean;
  pending_snap: FightSnapshot | null;
  pending_issue: boolean;
  last_snap: FightSnapshot | null;
  fight_id: string | null;
  fight_seq: number;
  /** Pairs that already emitted dive this fight. */
  dive_emitted: Set<string>;
  /** Perception first-seen map: "observer>other" → t. */
  seen_at: Partial<Record<string, number>>;
  /** First t a diver-carry pair entered PEEL_DIVE_R: "diver>carry" → t. */
  dive_start_at: Partial<Record<string, number>>;
  /** Peel_start already emitted for pair. */
  peel_emitted: Set<string>;
  /** Fight end grace: last t geometric fight was true. */
  last_geom_fight_t: number;
  /** Soft L1 window end (grace and/or pending hyst flip). */
  soft_until: number;
  /** Focus died this fight — do not auto-pick a replacement (Teamwork stick). */
  focus_died: Record<Team, boolean>;
  /** §9.4.1 disable / spill / cast-sight memory. Not digested. */
  cast_memory: ReturnType<typeof createCastMemory>;
  /**
   * Effective tactic preset for this team (§12 L1344 / L1358).
   * Secondary replaces primary when the 1 s L1 planner would otherwise idle
   * (no Fight Call this L1 tick). Invention INV-SECONDARY-IDLE-L1.
   */
  active_tactic: Record<Team, "hold_the_pit" | "hunt" | "starve">;
}

export function createAiRuntime(): AiRuntime {
  return {
    last_l1_t: -Infinity,
    last_flip_t: { blue: -Infinity, red: -Infinity },
    commit: { blue: "hold", red: "hold" },
    focus: { blue: null, red: null },
    chase: {},
    peel_diver: {},
    intent_target: {},
    dive_geom: 0,
    peel_fired: 0,
    prev_geom_fight: false,
    pending_l1: false,
    pending_snap: null,
    pending_issue: false,
    last_snap: null,
    fight_id: null,
    fight_seq: 0,
    dive_emitted: new Set(),
    seen_at: {},
    dive_start_at: {},
    peel_emitted: new Set(),
    last_geom_fight_t: -Infinity,
    soft_until: -Infinity,
    focus_died: { blue: false, red: false },
    active_tactic: { blue: "hold_the_pit", red: "hold_the_pit" },
    cast_memory: createCastMemory(),
  };
}

export function tickAi(
  state: MatchState,
  config: MatchConfig,
  c: Constants,
  rng: RngBank,
  ai: AiRuntime,
  emit: (type: string, payload: Record<string, unknown>) => void,
  deathThisTick: boolean,
): void {
  void rng;
  // deathThisTick is already "deaths from previous tick" (simulate passes lagged flag).
  // That matches OQ-S2-3 next-tick-after-death. Fight start/end are queued below.
  const deathForL1 = deathThisTick;

  if (ai.last_l1_t < 0) {
    ai.active_tactic.blue = config.blue.tactics.preset;
    ai.active_tactic.red = config.red.tactics.preset;
  }

  updatePerceptionSeen(state.units, ai.seen_at, state.t);

  const snap = evaluateFight(state.units, c, ai.fight_id);
  ai.last_snap = snap;
  const geomFight = snap.exists;

  if (geomFight) {
    ai.last_geom_fight_t = state.t;
    if (!ai.fight_id) {
      ai.fight_seq += 1;
      ai.fight_id = `f${ai.fight_seq}`;
      snap.fight_id = ai.fight_id;
      ai.dive_emitted.clear();
      ai.peel_emitted.clear();
      ai.dive_start_at = {};
      ai.focus_died = { blue: false, red: false };
    }
  } else if (
    ai.fight_id &&
    state.t - ai.last_geom_fight_t >= c.FIGHT_END_GRACE_S - 1e-9 &&
    state.t > ai.soft_until + 1e-9
  ) {
    // Keep fight_id through soft_until so hyst flips can still emit fight_call.
    ai.fight_id = null;
    ai.dive_emitted.clear();
    ai.peel_emitted.clear();
    ai.dive_start_at = {};
  }

  const fightJustStarted = geomFight && !ai.prev_geom_fight;
  const fightJustEnded = !geomFight && ai.prev_geom_fight;
  ai.prev_geom_fight = geomFight;

  // Consume pending L1 from a prior tick's fight-start/end (OQ-S2-3: next tick).
  // The queued snap/issue is what was true at detection time (banish same tick must not erase the start call).
  const pendingFromPrior = ai.pending_l1;
  const queuedSnap = ai.pending_snap;
  const queuedIssue = ai.pending_issue;
  ai.pending_l1 = false;
  ai.pending_snap = null;
  ai.pending_issue = false;
  if (fightJustStarted || fightJustEnded) {
    ai.pending_l1 = true;
    ai.pending_snap = { ...snap, participants: snap.participants.slice(), blue: snap.blue.slice(), red: snap.red.slice() };
    ai.pending_issue = fightIssuesCall(snap);
  }

  const runL1 = shouldRunL1(state.t, c, pendingFromPrior || deathForL1, ai.last_l1_t);
  // Call payload uses current geometry for cadence; for queued start use the queued snap's A_true/issue.
  const callSnap = pendingFromPrior && queuedSnap ? queuedSnap : snap;
  const issueNow = pendingFromPrior && queuedSnap ? queuedIssue : fightIssuesCall(snap);
  // Soft L1 after geometry breaks: emit through FIGHT_END_GRACE, and through the
  // pending hyst_s window when a composition break still wants engage→disengage
  // (Decision 99 needs ~1.29 s — longer than the 1.0 s grace).
  if (fightJustEnded && ai.fight_id) {
    // Always cover the 1.0 s fight-end grace. Extend to hyst_s only while a
    // side is still on engage and needs the window to flip to disengage.
    // Add one L1 period so the flip cadence tick is still inside softIssue.
    let until = ai.last_geom_fight_t + c.FIGHT_END_GRACE_S;
    for (const team of ["blue", "red"] as Team[]) {
      if (ai.commit[team] !== "engage") continue;
      const sc = shotcaller(state.units, team);
      until = Math.max(
        until,
        ai.last_flip_t[team] + hystS(sc?.attrs.decision ?? 50) + c.L1_PERIOD_S,
      );
    }
    ai.soft_until = Math.max(ai.soft_until, until);
  }
  const softIssue = !geomFight && state.t <= ai.soft_until + 1e-9 && ai.soft_until > 0;
  const graceSnap = softIssue ? evaluateFight(state.units, c, ai.fight_id) : null;

  for (const team of ["blue", "red"] as Team[]) {
    const side = team === "blue" ? config.blue : config.red;
    const useSnap = softIssue && graceSnap ? graceSnap : callSnap;
    const aTrue = team === "blue" ? useSnap.a_true_blue : useSnap.a_true_red;
    const shouldCall = issueNow || softIssue;

    if (runL1 && shouldCall) {
      // Fight Call occupies the planner — always primary preset.
      ai.active_tactic[team] = side.tactics.preset;
      const sc = shotcaller(state.units, team);
      const decision = sc?.attrs.decision ?? 50;
      const bandHalf = mistakeBand(decision) / 2;
      // Soft 1vX during grace: force disengage desire from the short side.
      const usN = team === "blue" ? useSnap.blue.length : useSnap.red.length;
      const themN = team === "blue" ? useSnap.red.length : useSnap.blue.length;
      let next: CommitKind;
      if (softIssue && usN < 2 && themN >= 1) {
        next = "disengage";
      } else {
        next = chooseCommit(
          aTrue,
          ai.active_tactic[team],
          false, // zone ownership S3
          ai.commit[team],
          side.tactics.aggression,
          bandHalf,
          deathForL1,
        );
      }
      if (next !== ai.commit[team]) {
        if (!canFlipCommit(state.t, ai.last_flip_t[team], decision, deathForL1)) {
          next = ai.commit[team];
        } else {
          ai.last_flip_t[team] = state.t;
        }
      }
      ai.commit[team] = next;
      const a_commit = aTrue; // incoming-wave −0.08 is S3; log equals raw until then
      const focusPool =
        useSnap.participants.length > 0
          ? useSnap.participants
          : callSnap.participants.length > 0
            ? callSnap.participants
            : snap.participants;
      let focus: UnitId | null = null;
      const prevFocus = ai.focus[team];
      if (prevFocus) {
        const prevUnit = state.units.find((u) => u.id === prevFocus);
        if (prevUnit && !prevUnit.alive) {
          ai.focus_died[team] = true;
        }
      }
      if (ai.focus_died[team]) {
        focus = null;
      } else if (sc) {
        // Focus ×1.25 score only — no hard override (R #3 / S2-R4-4). Shotcaller
        // scores; pad Top may be the Decision tie-break shotcaller.
        focus = chooseFocus(team, state.units, sc, focusPool, {
          c,
          tactic: ai.active_tactic[team],
          zoneCenter: c.ZONE_CENTER,
          zoneR: c.ZONE_RADIUS,
          intentTarget: {},
          coachFocusSlot: side.tactics.focus === "auto" ? null : side.tactics.focus ?? null,
        });
      }
      ai.focus[team] = focus;
      emit("fight_call", {
        team,
        a_true: aTrue,
        a_commit,
        commit: next,
        focus_id: focus ?? null,
        shotcaller_id: sc?.id ?? null,
        reason: useSnap.escalate_2v2 ? "2v2_escalate" : "fight",
        centroid_x: useSnap.centroid.x,
        centroid_y: useSnap.centroid.y,
        fight_id: useSnap.fight_id ?? ai.fight_id,
      });
      ai.last_l1_t = state.t;
    } else if (runL1 && !shouldCall) {
      // Planner would otherwise idle this 1 s tick → optional secondary (§12 L1344).
      ai.active_tactic[team] = side.tactics.secondary ?? side.tactics.preset;
      if ((fightJustEnded || deathForL1 || pendingFromPrior) && !softIssue) {
        ai.commit[team] = "hold";
        ai.focus[team] = null;
      }
      // Soft grace over and no geometric fight: clear a stale disengage so the
      // §9.2 planner can leave the pad (otherwise Retreat↔Idle parks forever).
      if (!geomFight && !softIssue && ai.commit[team] === "disengage") {
        ai.commit[team] = "hold";
        ai.focus[team] = null;
      }
      ai.last_l1_t = state.t;
    }
  }

  // Auto-peel + dive events
  ai.peel_diver = {};
  for (const team of ["blue", "red"] as Team[]) {
    const side = team === "blue" ? config.blue : config.red;
    const aTrue = team === "blue" ? snap.a_true_blue : snap.a_true_red;
    const dives = detectDives(state.units, c, {
      a_true: aTrue,
      tactic: ai.active_tactic[team],
      ignore_perception: config.ai_ignore_perception === true,
      now: state.t,
      seenAt: ai.seen_at,
      diveStartAt: ai.dive_start_at,
    }).filter((d) => {
      const carry = state.units.find((u) => u.id === d.carry_id);
      return carry?.team === team;
    });
    // R #3 S2-4 / §9.5: emit dive once per pair per fight when condition (2)
    // first holds, with peeler_perceived at that instant (true or false).
    for (const d of dives) {
      if (!d.geometric_ok || !d.peeler_id) continue;
      const pairKey = `${d.diver_id}>${d.carry_id}`;
      const peelerId = d.peeler_id.id;
      if (d.peeler_perceived) {
        ai.peel_diver[peelerId] = d.diver_id;
      }
      if (ai.fight_id && !ai.dive_emitted.has(pairKey)) {
        ai.dive_emitted.add(pairKey);
        ai.dive_geom += 1;
        emit("dive", {
          diver_id: d.diver_id,
          target_id: d.carry_id,
          fight_id: ai.fight_id,
          peeler_id: peelerId,
          peeler_perceived: d.peeler_perceived,
        });
      }
      if (d.peeler_perceived && !ai.peel_emitted.has(pairKey)) {
        ai.peel_emitted.add(pairKey);
        ai.peel_fired += 1;
        emit("peel_start", {
          peeler_id: peelerId,
          carry_id: d.carry_id,
          diver_id: d.diver_id,
        });
      }
    }
  }

  const brainFightIds =
    snap.exists || softIssue || !!ai.fight_id ? snap.participants : [];
  observeCastMemory(
    state,
    ai.cast_memory,
    c,
    brainFightIds,
    ai.seen_at,
    config.ai_ignore_perception === true,
  );

  const scripted = config.scripted_motor;
  for (const u of state.units) {
    if (scripted && scripted[u.id]) continue;
    const team = u.team;
    const side = team === "blue" ? config.blue : config.red;
    const peeling = ai.peel_diver[u.id] !== undefined;
    const aTrue = team === "blue" ? snap.a_true_blue : snap.a_true_red;
    const decision = brainDecide(state, u, {
      c,
      commit: ai.commit[team],
      focusId: ai.focus[team],
      peelDiverId: ai.peel_diver[u.id] ?? null,
      peeling,
      chase: ai.chase[u.id] ?? null,
      tactic: ai.active_tactic[team],
      fightIds: brainFightIds,
      intentTarget: ai.intent_target,
      coachFocusSlot: side.tactics.focus === "auto" ? null : side.tactics.focus ?? null,
      comboStyle: side.tactics.combo_style,
      aTrue,
      seenAt: ai.seen_at,
      ignorePerception: config.ai_ignore_perception === true,
      castMemory: ai.cast_memory,
    });
    if (decision.chase) ai.chase[u.id] = decision.chase;
    else delete ai.chase[u.id];

    // Capture prior target before overwriting — intent emits on target change too.
    const prevIntent = u.intent;
    const prevTarget = u.ai_target_id ?? null;

    // §9.2 L1115: minimum 1 s dwell — do not trickle back into HoldZone inside
    // the window after Retreat (Idle intermediates still count). HoldZone →
    // Retreat (follow a disengage call) is always allowed.
    let intent = decision.intent;
    let waypoint = decision.waypoint;
    let targetId = decision.target_id;
    if (
      intent === "HoldZone" &&
      state.t <= u.ai_no_trickle_until + 1e-9 &&
      (prevIntent === "Retreat" || prevIntent === "Idle" || prevIntent === "HoldZone")
    ) {
      // Stay put on the pad / prior retreat pose — do not walk back mid.
      intent = prevIntent === "HoldZone" ? "Retreat" : prevIntent;
      if (intent === "Retreat") {
        const pad = u.team === "blue" ? c.BLUE_SPAWN : c.RED_SPAWN;
        waypoint = { x: pad[0]!, y: pad[1]! };
      } else {
        waypoint = u.waypoint ? { ...u.waypoint } : null;
      }
      targetId = prevTarget;
    } else if (intent === "Retreat" && prevIntent !== "Retreat") {
      u.ai_no_trickle_until = Math.max(u.ai_no_trickle_until, state.t + 1.0);
    }

    ai.intent_target[u.id] = targetId;
    u.ai_target_id = targetId;
    // R #4 supersedes L1044 "Teamwork 50+ always-follow". Block freestyle autos
    // only when the call's focus is dead/cleared and the brain named no target.
    u.ai_no_freelance =
      !!ai.fight_id &&
      targetId === null &&
      (ai.focus[team] === null || ai.focus_died[team]);

    // S2-R4-5 L1974: open a regroup_s suppress window on disengage Retreat/Regroup;
    // clear when the call flips. Expiry ends suppress without restarting.
    // Immobile exception: do not force ai_no_freelance (same retreatImmobile).
    const retreating =
      ai.commit[team] === "disengage" && (intent === "Retreat" || intent === "Regroup");
    if (retreating) {
      if (u.ai_retreat_suppress_until === 0) {
        u.ai_retreat_suppress_until = state.t + regroupS(u.attrs.decision);
      }
      if (!retreatImmobile(u, c)) {
        u.ai_no_freelance = true;
      }
    } else if (ai.commit[team] !== "disengage") {
      u.ai_retreat_suppress_until = 0;
    }

    if (decision.cast && intent === decision.intent) {
      const skill = decision.cast.skill;
      const cdBefore = skill === "Q" ? u.cd_q : skill === "W" ? u.cd_w : u.cd_r;
      beginCast(
        state,
        {
          tick: state.tick,
          source_id: u.id,
          skill,
          target_id: decision.cast.target_id ?? undefined,
          aim_x: decision.cast.aim_x,
          aim_y: decision.cast.aim_y,
          force_hit: false,
          tier: decision.cast.tier,
        },
        c,
        emit,
      );
      const cdAfter = skill === "Q" ? u.cd_q : skill === "W" ? u.cd_w : u.cd_r;
      if (cdBefore <= 1e-9 && cdAfter > 1e-9) {
        notePolicyCast(ai.cast_memory, u, skill, decision.cast.target_id, state.t);
      }
    }

    // R #3 S2-7: intent only on state change (intent name / target_id) — not waypoint.
    u.intent = intent;
    if (waypoint) {
      u.waypoint = { ...waypoint };
    } else if (intent === "Idle" || intent === "Engage") {
      u.waypoint = null;
    }
    const targetChanged = prevTarget !== (targetId ?? null);
    if (prevIntent !== u.intent || targetChanged) {
      emit("intent", {
        unit_id: u.id,
        intent,
        target_id: targetId ?? null,
        x: waypoint ? waypoint.x : null,
        y: waypoint ? waypoint.y : null,
      });
    }
  }
}
