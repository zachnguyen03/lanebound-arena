/**
 * Authored champion kits from build-spec §7.1–7.14 (via data/champions/_extract.md).
 * Structured ability effect data — do not edit kit numbers to pass a test; report disagreements.
 */

export type Unlock = "L1" | "L5";
export type CcCategory = "Lock" | "Bind" | "Handicap";
export type School = "physical" | "magic";

export type AbilityShape =
  | "line"
  | "cone"
  | "cone_target"
  | "circle_point"
  | "circle_target"
  | "circle_self"
  | "circle_ally"
  | "target"
  | "ally_target"
  | "self"
  | "self_dash"
  | "streak";

export interface AbilityDamage {
  base: number;
  atk?: number;
  pow?: number;
}

export interface AbilityHeal {
  base: number;
  pow: number;
}

export interface AbilityShield {
  base: number;
  pow: number;
  duration_s: number;
}

export interface AbilitySlow {
  pct: number;
  duration_s: number;
  school: School;
}

export interface AbilityCc {
  kind: string;
  category: CcCategory;
  duration_s: number;
  school?: School;
  petrify?: boolean;
}

export interface AbilityDef {
  name: string;
  unlock: Unlock;
  shape: AbilityShape;
  range: number;
  radius?: number;
  width?: number;
  angle_deg?: number;
  length?: number;
  pierce?: "all" | "first";
  school?: School;
  damage?: AbilityDamage | "none";
  CD_s: number;
  cast_s: number;
  land_delay_s?: number;
  cc?: AbilityCc[];
  slow?: AbilitySlow;
  heal?: AbilityHeal;
  shield?: AbilityShield;
  dash_tiles?: number;
  knockback?: number;
  pull?: number;
  finisher?: number;
  mark_dur_s?: number;
  mark_bonus?: number;
  needs_mark?: boolean;
  hits_allies?: boolean;
  dispel?: "basic" | "strong";
  /** Mirren sets hex_from to caster id when applying hex */
  hex_from_caster?: boolean;
  notes?: string;
  special?: string[];
  /** Design-proposal note for r=0 unit-only targets */
  radius_design_proposal?: string;
}

export interface PassiveDef {
  name: string;
  unlock?: Unlock;
  off_under_break?: boolean;
  /** Long Sight: tiles at/beyond which far_bonus applies */
  far_tiles?: number;
  /** Long Sight: damage multiplier bonus (e.g. 0.08 = +8%) */
  far_bonus?: number;
  /** Well-Fed */
  wellfed_base?: number;
  wellfed_pct?: number;
  combat_heal_multiplier?: number;
  skill_scaled?: boolean;
  /** Bedrock: HP fraction threshold and flat res bonus */
  bedrock_hp?: number;
  bedrock_res?: number;
  /** Kiln-Cured amp (e.g. 0.12 = +12%) */
  kiln_amp?: number;
  /** Rewound Moment */
  rewind_hp?: number;
  rewind_shield?: number;
  rewind_dur_s?: number;
  reset?: string;
  shield_subject_to_25pct_cap?: boolean;
  notes?: string;
}

export interface ChampKit {
  passive: PassiveDef;
  Q: AbilityDef;
  W: AbilityDef;
  R: AbilityDef;
}

export const KITS: Record<string, ChampKit> = {
  huntress: {
    passive: { name: "none" },
    Q: {
      name: "Keen Bolt",
      unlock: "L1",
      shape: "line",
      range: 8,
      length: 8,
      width: 0.5,
      pierce: "all",
      school: "physical",
      damage: { base: 110, atk: 0.8 },
      CD_s: 8,
      cast_s: 0.33,
      mark_dur_s: 4,
      special: ["pierce", "mark 4 s (does not consume)", "aim roll per target"],
    },
    W: {
      name: "Switchback",
      unlock: "L1",
      shape: "self_dash",
      range: 0,
      dash_tiles: 2,
      damage: "none",
      CD_s: 11,
      cast_s: 0.15,
    },
    R: {
      name: "Horizon Volley",
      unlock: "L5",
      shape: "circle_point",
      range: 7.5,
      radius: 2.6,
      school: "physical",
      damage: { base: 230, atk: 1.05 },
      CD_s: 55,
      cast_s: 0.6,
      mark_bonus: 1.35,
      special: ["if target is marked: +35% damage, then consume mark", "aim roll per target in circle"],
    },
  },

  maelis: {
    passive: { name: "none" },
    Q: {
      name: "Prism Split",
      unlock: "L1",
      shape: "line",
      range: 7.8,
      length: 7.8,
      width: 0.55,
      pierce: "all",
      school: "magic",
      damage: { base: 160, pow: 1.35 },
      CD_s: 7,
      cast_s: 0.3,
      special: ["pierce"],
    },
    W: {
      name: "Glass Veil",
      unlock: "L1",
      shape: "self_dash",
      range: 0,
      dash_tiles: 2.5,
      damage: "none",
      CD_s: 11,
      cast_s: 0.15,
      shield: { base: 80, pow: 0.4, duration_s: 2.5 },
      special: ["on cast: shield 80 + 40% POW for 2.5 s (skill-scaled) on self", "no CC"],
    },
    R: {
      name: "Duskburst",
      unlock: "L5",
      shape: "circle_point",
      range: 7.6,
      radius: 2.0,
      school: "magic",
      damage: { base: 350, pow: 1.7 },
      CD_s: 55,
      cast_s: 0.55,
      finisher: 0.2,
      special: ["finisher: raw × (1 + 0.20 × missing-HP fraction) per target"],
    },
  },

  isra: {
    passive: {
      name: "Long Sight",
      unlock: "L1",
      off_under_break: true,
      far_tiles: 5.0,
      far_bonus: 0.08,
      notes: "Longest auto range on roster (7.0)",
    },
    Q: {
      name: "Fuse Shot",
      unlock: "L1",
      shape: "circle_point",
      range: 8.5,
      radius: 1.4,
      school: "physical",
      damage: { base: 90, atk: 0.7 },
      CD_s: 8,
      cast_s: 0.3,
      land_delay_s: 1.0,
      special: ["lands after 1.0 s", "lead target current velocity at cast (simple linear lead)"],
    },
    W: {
      name: "Recoil Step",
      unlock: "L1",
      shape: "self_dash",
      range: 0,
      dash_tiles: 2.5,
      damage: "none",
      CD_s: 12,
      cast_s: 0.15,
    },
    R: {
      name: "Starfall Mortar",
      unlock: "L5",
      shape: "circle_point",
      range: 12,
      radius: 3.4,
      school: "physical",
      damage: { base: 145, atk: 0.75 },
      CD_s: 60,
      cast_s: 0.5,
      land_delay_s: 1.2,
      special: [
        "lands after 1.2 s",
        "sanctuary clip mandatory: land point and circle truncated at enemy pad; no damage in sanctuary tiles",
      ],
    },
  },

  sedge: {
    passive: { name: "none" },
    Q: {
      name: "Lantern Sweep",
      unlock: "L1",
      shape: "circle_target",
      range: 5.5,
      radius: 2.2,
      school: "magic",
      damage: { base: 115, pow: 0.9 },
      CD_s: 6.8,
      cast_s: 0.28,
      special: ["primary target always hits; others in radius skillshot-rolled"],
    },
    W: {
      name: "Wickbind",
      unlock: "L1",
      shape: "line",
      range: 6.5,
      length: 6.5,
      width: 0.5,
      pierce: "all",
      school: "magic",
      damage: { base: 55, atk: 0.1, pow: 0.5 },
      CD_s: 12.5,
      cast_s: 0.3,
      cc: [{ kind: "root", category: "Bind", duration_s: 0.85, school: "magic" }],
      special: ["pierce"],
    },
    R: {
      name: "Mire Drowse",
      unlock: "L5",
      shape: "circle_point",
      range: 11,
      radius: 3.8,
      school: "magic",
      damage: { base: 85, pow: 0.45 },
      CD_s: 60,
      cast_s: 0.55,
      cc: [{ kind: "sleep", category: "Lock", duration_s: 2.8, school: "magic" }],
      hits_allies: true,
      special: [
        "hits enemies and allies except caster",
        "sleeping allies asleep (Ysol strong-dispel can remove)",
      ],
    },
  },

  torun: {
    passive: { name: "none" },
    Q: {
      name: "Shell-Slam",
      unlock: "L1",
      shape: "circle_target",
      range: 2.2,
      radius: 1.6,
      school: "magic",
      damage: { base: 70, atk: 0.2, pow: 0.4 },
      CD_s: 8.5,
      cast_s: 0.28,
      cc: [
        { kind: "knockup", category: "Lock", duration_s: 0.95, school: "magic" },
        { kind: "taunt", category: "Handicap", duration_s: 2.0, school: "magic" },
      ],
      special: ["both CC apply to enemies in radius", "primary always hits; others roll Aim"],
    },
    W: {
      name: "Sluice Ward",
      unlock: "L1",
      shape: "circle_ally",
      range: 6,
      radius: 1.2,
      damage: "none",
      CD_s: 12,
      cast_s: 0.2,
      shield: { base: 200, pow: 0.6, duration_s: 2.5 },
      special: [
        "shield 200 + 60% POW for 2.5 s (skill-scaled) on allies in radius (including self if centre)",
        "peel taunt 2.0 s on diver inside radius (enemy only)",
      ],
    },
    R: {
      name: "Lock-Tide",
      unlock: "L5",
      shape: "circle_point",
      range: 6,
      radius: 3.2,
      school: "magic",
      damage: { base: 90, atk: 0.15, pow: 0.5 },
      CD_s: 65,
      cast_s: 0.45,
      cc: [{ kind: "stun", category: "Lock", duration_s: 1.25, school: "magic" }],
    },
  },

  tolle: {
    passive: {
      name: "Well-Fed",
      unlock: "L1",
      off_under_break: true,
      wellfed_base: 25,
      wellfed_pct: 0.02,
      skill_scaled: false,
      combat_heal_multiplier: 0.75,
      notes: "One heal per application (Q stunning two targets heals twice)",
    },
    Q: {
      name: "Bucket Slam",
      unlock: "L1",
      shape: "circle_target",
      range: 2.2,
      radius: 1.6,
      school: "magic",
      damage: { base: 75, atk: 0.15, pow: 0.3 },
      CD_s: 9,
      cast_s: 0.28,
      cc: [{ kind: "stun", category: "Lock", duration_s: 0.9, school: "magic" }],
    },
    W: {
      name: "Draw Down",
      unlock: "L1",
      shape: "target",
      range: 6,
      radius: 0.0,
      radius_design_proposal: "0.0 selected unit only; engine fallback body 0.4 — not splash, not 1.2 ally ward",
      damage: "none",
      CD_s: 18,
      cast_s: 0.2,
      cc: [{ kind: "banish", category: "Lock", duration_s: 1.8, school: "magic" }],
    },
    R: {
      name: "Upwelling",
      unlock: "L5",
      shape: "circle_point",
      range: 7,
      radius: 3.4,
      school: "magic",
      damage: { base: 80, pow: 0.4 },
      CD_s: 70,
      cast_s: 0.4,
      land_delay_s: 0.8,
      cc: [{ kind: "knockup", category: "Lock", duration_s: 1.1, school: "magic" }],
      special: ["lands after 0.8 s"],
    },
  },

  helvar: {
    passive: { name: "none" },
    Q: {
      name: "Stoneverse",
      unlock: "L1",
      shape: "line",
      range: 8,
      length: 8,
      width: 0.6,
      pierce: "all",
      school: "magic",
      damage: { base: 100, pow: 0.9 },
      CD_s: 6.8,
      cast_s: 0.3,
      special: ["pierce"],
    },
    W: {
      name: "Faultline",
      unlock: "L1",
      shape: "line",
      range: 8.5,
      length: 8.5,
      width: 2.0,
      pierce: "all",
      school: "magic",
      damage: { base: 65, pow: 0.5 },
      CD_s: 11.5,
      cast_s: 0.4,
      cc: [{ kind: "root", category: "Bind", duration_s: 0.8, school: "magic" }],
      slow: { pct: 0.35, duration_s: 1.0, school: "magic" },
      special: ["pierce"],
    },
    R: {
      name: "Cliffwake",
      unlock: "L5",
      shape: "line",
      range: 9,
      length: 9,
      width: 2.2,
      pierce: "all",
      school: "magic",
      damage: { base: 230, pow: 1.15 },
      CD_s: 65,
      cast_s: 0.5,
      knockback: 2.2,
      special: ["knockback 2.2 tiles away from line origin (caster)", "displacement, not disable category", "pierce"],
    },
  },

  calder: {
    passive: { name: "none" },
    Q: {
      name: "Ashbreath",
      unlock: "L1",
      shape: "cone",
      range: 6.4,
      angle_deg: 60,
      school: "magic",
      damage: { base: 115, pow: 0.95 },
      CD_s: 6.5,
      cast_s: 0.28,
    },
    W: {
      name: "Smoke Drink",
      unlock: "L1",
      shape: "self",
      range: 0,
      radius: 0.0,
      damage: "none",
      CD_s: 12.5,
      cast_s: 0.2,
      heal: { base: 75, pow: 0.45 },
      notes: "authored circle self with no r; self only",
    },
    R: {
      name: "Ash Panic",
      unlock: "L5",
      shape: "circle_point",
      range: 7,
      radius: 3.0,
      school: "magic",
      damage: { base: 215, pow: 1.1 },
      CD_s: 58,
      cast_s: 0.45,
      cc: [{ kind: "fear", category: "Lock", duration_s: 1.6, school: "magic" }],
    },
  },

  kerrig: {
    passive: { name: "none" },
    Q: {
      name: "Latch Line",
      unlock: "L1",
      shape: "line",
      range: 6.5,
      length: 6.5,
      width: 0.45,
      pierce: "first",
      school: "physical",
      damage: { base: 110, atk: 0.85 },
      CD_s: 7.5,
      cast_s: 0.28,
      cc: [{ kind: "leash", category: "Bind", duration_s: 2.8, school: "physical" }],
      mark_dur_s: 2.8,
      special: ["stops at first enemy", "mark 2.8 s (required by R)", "leash range 3.5 tiles"],
    },
    W: {
      name: "Spool Cut",
      unlock: "L1",
      shape: "circle_target",
      range: 1.8,
      radius: 1.2,
      school: "physical",
      damage: { base: 95, atk: 0.9 },
      CD_s: 7,
      cast_s: 0.12,
      slow: { pct: 0.3, duration_s: 0.8, school: "physical" },
    },
    R: {
      name: "Reeling Cut",
      unlock: "L5",
      shape: "streak",
      range: 5.5,
      dash_tiles: 5,
      school: "physical",
      damage: { base: 330, atk: 1.4, pow: 0.15 },
      CD_s: 42,
      cast_s: 0.7,
      needs_mark: true,
      finisher: 0.35,
      special: [
        "requires live mark on target (from Q)",
        "finisher: raw × (1 + 0.35 × missing-HP fraction)",
        "CD starts on windup (even if dash cancelled)",
        "on landed hit: 2.8 s commitment — no retreat/new dash until ends",
        "Self-Break 2.8 s (§6.5)",
      ],
    },
  },

  mirren: {
    passive: {
      name: "Kiln-Cured",
      unlock: "L1",
      off_under_break: true,
      kiln_amp: 0.12,
    },
    Q: {
      name: "Glaze Spit",
      unlock: "L1",
      shape: "circle_target",
      range: 6,
      radius: 1.6,
      school: "magic",
      damage: { base: 115, pow: 0.9 },
      CD_s: 7,
      cast_s: 0.28,
    },
    W: {
      name: "Jarring",
      unlock: "L1",
      shape: "target",
      range: 6,
      radius: 0.0,
      radius_design_proposal: "0.0 selected unit only; body 0.4 if required; do not splash",
      damage: "none",
      CD_s: 15,
      cast_s: 0.25,
      cc: [{ kind: "hex", category: "Lock", duration_s: 1.6, school: "magic" }],
      slow: { pct: 0.35, duration_s: 1.6, school: "magic" },
      hex_from_caster: true,
      special: ["preferred target: enemy carry (ADC slot, else highest damage dealer)"],
    },
    R: {
      name: "Kiln Chorus",
      unlock: "L5",
      shape: "circle_point",
      range: 8,
      radius: 2.8,
      school: "magic",
      damage: { base: 150, pow: 0.75 },
      CD_s: 70,
      cast_s: 0.55,
      cc: [{ kind: "hex", category: "Lock", duration_s: 1.5, school: "magic" }],
      hex_from_caster: true,
      special: ["Kiln-Cured applies to every enemy hexed by R"],
    },
  },

  rhedan: {
    passive: { name: "none" },
    Q: {
      name: "Tide-Cleave",
      unlock: "L1",
      shape: "cone_target",
      range: 3,
      angle_deg: 70,
      school: "physical",
      damage: { base: 90, atk: 0.75 },
      CD_s: 7,
      cast_s: 0.25,
      special: ["primary always hits; others in cone roll Aim"],
    },
    W: {
      name: "Wake Hook",
      unlock: "L1",
      shape: "line",
      range: 5.5,
      length: 5.5,
      width: 0.5,
      pierce: "first",
      school: "physical",
      damage: { base: 45, atk: 0.3 },
      CD_s: 12,
      cast_s: 0.3,
      cc: [{ kind: "root", category: "Bind", duration_s: 0.7, school: "physical" }],
      pull: 4,
      special: ["stops at first enemy", "pull 4 tiles toward Rhedan (displacement)"],
    },
    R: {
      name: "Keelbreak",
      unlock: "L5",
      shape: "circle_target",
      range: 2.8,
      radius: 2.4,
      school: "physical",
      damage: { base: 150, atk: 0.9 },
      CD_s: 50,
      cast_s: 0.4,
      cc: [{ kind: "knockup", category: "Lock", duration_s: 0.9, school: "physical" }],
    },
  },

  brannoch: {
    passive: {
      name: "Bedrock",
      unlock: "L1",
      off_under_break: true,
      bedrock_hp: 0.5,
      bedrock_res: 20,
      notes: "Not included in snapshot eHP column (unbuffed)",
    },
    Q: {
      name: "Quarry Throw",
      unlock: "L1",
      shape: "line",
      range: 6.5,
      length: 6.5,
      width: 0.6,
      pierce: "all",
      school: "physical",
      damage: { base: 125, atk: 0.65 },
      CD_s: 8,
      cast_s: 0.3,
      slow: { pct: 0.35, duration_s: 1.5, school: "physical" },
      special: ["pierce"],
    },
    W: {
      name: "Cairn Shoulder",
      unlock: "L1",
      shape: "streak",
      range: 3.5,
      school: "physical",
      damage: { base: 90, atk: 0.45 },
      CD_s: 12,
      cast_s: 0.2,
      cc: [{ kind: "knockup", category: "Lock", duration_s: 0.6, school: "physical" }],
      special: ["dashes to target"],
    },
    R: {
      name: "Stonefast",
      unlock: "L5",
      shape: "circle_self",
      range: 2.6,
      radius: 2.6,
      school: "magic",
      damage: { base: 170, atk: 0.2, pow: 0.45 },
      CD_s: 60,
      cast_s: 0.4,
      cc: [
        {
          kind: "stun",
          category: "Lock",
          duration_s: 1.6,
          school: "magic",
          petrify: true,
        },
      ],
      special: ["hits enemies in radius", "petrify tag: stun + 25% damage reduction on petrified unit"],
    },
  },

  ysol: {
    passive: {
      name: "none",
      notes: "Enchanter growth, Support slot. Saelo is Support Mage — do not confuse classes.",
    },
    Q: {
      name: "Kiln Bell",
      unlock: "L1",
      shape: "cone_target",
      range: 7.2,
      angle_deg: 80,
      school: "magic",
      damage: { base: 60, pow: 0.4 },
      CD_s: 12.5,
      cast_s: 0.3,
      cc: [{ kind: "silence", category: "Handicap", duration_s: 1.0, school: "magic" }],
    },
    W: {
      name: "Ember Mending",
      unlock: "L1",
      shape: "circle_ally",
      range: 6.5,
      radius: 1.2,
      damage: "none",
      CD_s: 13,
      cast_s: 0.25,
      heal: { base: 95, pow: 0.45 },
      dispel: "strong",
      special: [
        "heal 95 + 45% POW (skill-scaled, combat ×0.75)",
        "strong dispel on each ally in radius (including chosen centre)",
      ],
    },
    R: {
      name: "Vowbreak",
      unlock: "L5",
      shape: "circle_point",
      range: 6,
      radius: 2.6,
      school: "magic",
      damage: { base: 105, pow: 0.7 },
      CD_s: 70,
      cast_s: 0.45,
      cc: [{ kind: "knockup", category: "Lock", duration_s: 1.05, school: "magic" }],
    },
  },

  saelo: {
    passive: {
      name: "Rewound Moment",
      unlock: "L1",
      off_under_break: true,
      rewind_hp: 0.3,
      rewind_shield: 0.25,
      rewind_dur_s: 2.5,
      skill_scaled: false,
      reset: "out of any declared fight for 8.0 s (death does not reset mid-fight)",
      shield_subject_to_25pct_cap: true,
    },
    Q: {
      name: "Second Hand",
      unlock: "L1",
      shape: "line",
      range: 7,
      length: 7,
      width: 0.5,
      pierce: "all",
      school: "magic",
      damage: { base: 105, pow: 0.8 },
      CD_s: 8,
      cast_s: 0.3,
      slow: { pct: 0.3, duration_s: 1.2, school: "magic" },
      special: ["pierce"],
    },
    W: {
      name: "Unwind",
      unlock: "L1",
      shape: "ally_target",
      range: 6.5,
      radius: 0.0,
      radius_design_proposal: "v1 default 0.0; alt r=1.2 (Ysol parity) — do not silently take alternative",
      damage: "none",
      CD_s: 14,
      cast_s: 0.25,
      heal: { base: 65, pow: 0.35 },
      dispel: "basic",
      special: ["heal 65 + 35% POW (skill-scaled, combat ×0.75)", "basic dispel on target"],
    },
    R: {
      name: "Still Hour",
      unlock: "L5",
      shape: "circle_point",
      range: 8,
      radius: 2.4,
      school: "magic",
      damage: { base: 90, pow: 0.45 },
      CD_s: 85,
      cast_s: 0.7,
      cc: [{ kind: "timestop", category: "Lock", duration_s: 2.0, school: "magic" }],
      hits_allies: true,
      special: [
        "hits enemies and allies in radius except caster",
        "time-stop does not pierce Spellward",
      ],
    },
  },
};

export const KIT_IDS = [
  "brannoch",
  "calder",
  "helvar",
  "huntress",
  "isra",
  "kerrig",
  "maelis",
  "mirren",
  "rhedan",
  "saelo",
  "sedge",
  "tolle",
  "torun",
  "ysol",
] as const;
