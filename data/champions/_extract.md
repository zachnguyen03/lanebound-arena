# Champion kit extract — spec §7.1–7.14

> Source: `lanebound-arena-build-spec-v1_122c.md` sections 7.1–7.14. Values quoted exactly as authored.

## W `radius = 0.0` design proposals

| Champion | Ability | Proposal |
|----------|---------|----------|
| **Tolle** | W — Draw Down | Single-target targeted hex/banish, no splash. `radius = 0.0` (selected unit only). Engine fallback: unit body **0.4**, not splash. |
| **Mirren** | W — Jarring | Single-target targeted hex, no splash. `radius = 0.0` (selected unit only; body **0.4** if engine requires positive radius). |
| **Saelo** | W — Unwind | Authored single target; no radius. **v1 default `radius = 0.0`** (selected ally only; body **0.4** if required). Alternative **r = 1.2** (Ysol parity) exists but is **not** v1 default. |

**Related (not in proposal list):** Calder W — Smoke Drink: self only, `radius = 0.0` (centre unambiguously self).

---

## TypeScript-friendly kit records

```ts
// Illustrative shapes — copy values into your implementation types.

type StatRow = {
  lv: 1 | 7 | 10;
  HP: number;
  Regen: number;
  ATK: number;
  POW: number;
  PRes: number;
  MRes: number;
  AS: number;
  Crit_pct: number;
  Range: number;
  MS: number;
};

type CcEffect = {
  effect: string;
  duration_s: number;
  category: "Lock" | "Bind" | "Handicap";
  school?: "physical" | "magic";
  notes?: string;
};

type Ability = {
  name: string;
  unlock: "L1" | "L5";
  type: string;
  range?: number;
  radius?: number;
  length?: number;
  width?: number;
  angle_deg?: number;
  dash_tiles?: number;
  school?: "physical" | "magic";
  l7_formula?: string;
  damage?: "none" | string;
  CD_s: number;
  cast_s: number;
  cc?: CcEffect[];
  special?: string[];
};
```

---

### huntress

```json
{
  "id": "huntress",
  "position": "ADC",
  "class": "Marksman",
  "lean": "Damage (pure DPS)",
  "default_slot": "ADC",
  "faction": "Falconridge",
  "primary_disable": "None / —",
  "stats": [
    { "lv": 1, "HP": 900, "Regen": 4, "ATK": 72, "POW": 8, "PRes": 26, "MRes": 24, "AS": 0.840, "Crit_pct": 8.0, "Range": 6.25, "MS": 3.3 },
    { "lv": 7, "HP": 1100, "Regen": 4.72, "ATK": 100, "POW": 12, "PRes": 36, "MRes": 32, "AS": 0.960, "Crit_pct": 14.0, "Range": 6.25, "MS": 3.3 },
    { "lv": 10, "HP": 1200, "Regen": 5.08, "ATK": 114, "POW": 14, "PRes": 41, "MRes": 36, "AS": 1.020, "Crit_pct": 17.0, "Range": 6.25, "MS": 3.3 }
  ],
  "passive": { "name": "none" },
  "abilities": {
    "Q": {
      "name": "Keen Bolt",
      "unlock": "L1",
      "type": "line skillshot",
      "range": 8,
      "length": 8,
      "width": 0.5,
      "school": "physical",
      "l7_formula": "110 + 80% ATK",
      "CD_s": 8,
      "cast_s": 0.33,
      "special": ["pierce", "mark 4 s (does not consume)", "aim roll per target"]
    },
    "W": {
      "name": "Switchback",
      "unlock": "L1",
      "type": "self dash",
      "dash_tiles": 2,
      "damage": "none",
      "CD_s": 11,
      "cast_s": 0.15
    },
    "R": {
      "name": "Horizon Volley",
      "unlock": "L5",
      "type": "circle skillshot",
      "range": 7.5,
      "radius": 2.6,
      "school": "physical",
      "l7_formula": "230 + 105% ATK",
      "CD_s": 55,
      "cast_s": 0.6,
      "special": ["if target is marked: +35% damage, then consume mark", "aim roll per target in circle"]
    }
  },
  "ai_rules": [
    "Marksman backline",
    "Prefer Q on focus/marked target to set up R",
    "Dash is peel or reset, not engage",
    "Do not walk into melee range of tanks"
  ]
}
```

---

### maelis

```json
{
  "id": "maelis",
  "position": "ADC",
  "class": "Marksman",
  "lean": "Damage (pure DPS)",
  "default_slot": "ADC",
  "faction": "Cinderglass",
  "primary_disable": "None / —",
  "stats": [
    { "lv": 1, "HP": 880, "Regen": 3.6, "ATK": 48, "POW": 80, "PRes": 24, "MRes": 26, "AS": 0.780, "Crit_pct": 4.0, "Range": 6.5, "MS": 3.25 },
    { "lv": 7, "HP": 1080, "Regen": 4.32, "ATK": 76, "POW": 84, "PRes": 34, "MRes": 34, "AS": 0.900, "Crit_pct": 10.0, "Range": 6.5, "MS": 3.25 },
    { "lv": 10, "HP": 1180, "Regen": 4.68, "ATK": 90, "POW": 86, "PRes": 39, "MRes": 38, "AS": 0.960, "Crit_pct": 13.0, "Range": 6.5, "MS": 3.25 }
  ],
  "passive": { "name": "none" },
  "abilities": {
    "Q": {
      "name": "Prism Split",
      "unlock": "L1",
      "type": "line skillshot",
      "range": 7.8,
      "length": 7.8,
      "width": 0.55,
      "school": "magic",
      "l7_formula": "160 + 135% POW",
      "CD_s": 7,
      "cast_s": 0.3,
      "special": ["pierce"]
    },
    "W": {
      "name": "Glass Veil",
      "unlock": "L1",
      "type": "self dash",
      "dash_tiles": 2.5,
      "damage": "none",
      "CD_s": 11,
      "cast_s": 0.15,
      "special": ["on cast: shield 80 + 40% POW for 2.5 s (skill-scaled) on self", "no CC", "resolved: 11 s CD, dash+shield, no CC"]
    },
    "R": {
      "name": "Duskburst",
      "unlock": "L5",
      "type": "circle skillshot",
      "range": 7.6,
      "radius": 2.0,
      "school": "magic",
      "l7_formula": "350 + 170% POW",
      "CD_s": 55,
      "cast_s": 0.55,
      "special": ["finisher: raw × (1 + 0.20 × missing-HP fraction) per target"]
    }
  },
  "ai_rules": [
    "Marksman backline",
    "Dash is survival/kiting, not in",
    "R is finisher: hold until focus below ~50% unless Fight Call is hard commit"
  ]
}
```

---

### isra

```json
{
  "id": "isra",
  "position": "ADC",
  "class": "Marksman",
  "lean": "Damage (pure DPS)",
  "default_slot": "ADC",
  "faction": "Cinderwell",
  "primary_disable": "None / —",
  "stats": [
    { "lv": 1, "HP": 860, "Regen": 3.6, "ATK": 70, "POW": 10, "PRes": 24, "MRes": 24, "AS": 0.760, "Crit_pct": 6.0, "Range": 7, "MS": 3.2 },
    { "lv": 7, "HP": 1060, "Regen": 4.32, "ATK": 98, "POW": 14, "PRes": 34, "MRes": 32, "AS": 0.880, "Crit_pct": 12.0, "Range": 7, "MS": 3.2 },
    { "lv": 10, "HP": 1160, "Regen": 4.68, "ATK": 112, "POW": 16, "PRes": 39, "MRes": 36, "AS": 0.940, "Crit_pct": 15.0, "Range": 7, "MS": 3.2 }
  ],
  "passive": {
    "name": "Long Sight",
    "unlock": "L1",
    "off_under_break": true,
    "autos_and_skills_vs_targets_5plus_tiles": "+8% damage",
    "far_tiles": 5.0,
    "far_bonus": "+8%",
    "notes": "Longest auto range on roster (7.0)"
  },
  "abilities": {
    "Q": {
      "name": "Fuse Shot",
      "unlock": "L1",
      "type": "circle point",
      "range": 8.5,
      "radius": 1.4,
      "school": "physical",
      "l7_formula": "90 + 70% ATK",
      "CD_s": 8,
      "cast_s": 0.3,
      "special": ["lands after 1.0 s", "lead target current velocity at cast (simple linear lead)"]
    },
    "W": {
      "name": "Recoil Step",
      "unlock": "L1",
      "type": "self dash",
      "dash_tiles": 2.5,
      "damage": "none",
      "CD_s": 12,
      "cast_s": 0.15
    },
    "R": {
      "name": "Starfall Mortar",
      "unlock": "L5",
      "type": "circle point",
      "range": 12,
      "radius": 3.4,
      "school": "physical",
      "l7_formula": "145 + 75% ATK",
      "CD_s": 60,
      "cast_s": 0.5,
      "special": ["lands after 1.2 s", "sanctuary clip mandatory: land point and circle truncated at enemy pad; no damage in sanctuary tiles"]
    }
  },
  "ai_rules": [
    "Stands farther than other marksmen",
    "Q/R delayed point lands — do not fire at target about to enter sanctuary",
    "R is fight-start or fleeing-clump tool, not chase into pad"
  ]
}
```

---

### sedge

```json
{
  "id": "sedge",
  "position": "Jungle",
  "class": "Mage",
  "lean": "Utility",
  "default_slot": "Jungle",
  "faction": "Mirefall",
  "primary_disable": "Root / Sleep",
  "stats": [
    { "lv": 1, "HP": 980, "Regen": 5, "ATK": 50, "POW": 68, "PRes": 30, "MRes": 28, "AS": 0.720, "Crit_pct": 3.0, "Range": 5.25, "MS": 3.45 },
    { "lv": 7, "HP": 1160, "Regen": 5.6, "ATK": 56, "POW": 98, "PRes": 38, "MRes": 38, "AS": 0.780, "Crit_pct": 3.0, "Range": 5.25, "MS": 3.45 },
    { "lv": 10, "HP": 1250, "Regen": 5.9, "ATK": 59, "POW": 113, "PRes": 42, "MRes": 43, "AS": 0.810, "Crit_pct": 3.0, "Range": 5.25, "MS": 3.45 }
  ],
  "passive": { "name": "none" },
  "abilities": {
    "Q": {
      "name": "Lantern Sweep",
      "unlock": "L1",
      "type": "circle targeted (around target)",
      "range": 5.5,
      "radius": 2.2,
      "school": "magic",
      "l7_formula": "115 + 90% POW",
      "CD_s": 6.8,
      "cast_s": 0.28,
      "special": ["primary target always hits; others in radius skillshot-rolled"]
    },
    "W": {
      "name": "Wickbind",
      "unlock": "L1",
      "type": "line skillshot",
      "range": 6.5,
      "length": 6.5,
      "width": 0.5,
      "school": "magic",
      "l7_formula": "55 + 10% ATK + 50% POW",
      "CD_s": 12.5,
      "cast_s": 0.3,
      "cc": [{ "effect": "root", "duration_s": 0.85, "category": "Bind", "school": "magic" }],
      "special": ["pierce"]
    },
    "R": {
      "name": "Mire Drowse",
      "unlock": "L5",
      "type": "circle point",
      "range": 11,
      "radius": 3.8,
      "school": "magic",
      "l7_formula": "85 + 45% POW",
      "CD_s": 60,
      "cast_s": 0.55,
      "cc": [{ "effect": "sleep", "duration_s": 2.8, "category": "Lock", "school": "magic" }],
      "special": [
        "hits enemies and allies except caster",
        "sleeping allies asleep (Ysol strong-dispel can remove)",
        "AI: do not sleep two allies to catch one enemy unless A_true favours wipe and allies expendable",
        "default: only fire if ≥2 enemies and ≤1 ally other than self would be hit, or Fight Call flagged commit R"
      ]
    }
  },
  "ai_rules": [
    "Jungle-slot mage",
    "W is bind for peels and setups",
    "R is pit tool; respect friendly-fire sleep"
  ]
}
```

---

### torun

```json
{
  "id": "torun",
  "position": "Jungle",
  "class": "Tank",
  "lean": "Utility",
  "default_slot": "Jungle",
  "faction": "Tidehold",
  "primary_disable": "Knockup, Taunt, Stun",
  "stats": [
    { "lv": 1, "HP": 1300, "Regen": 8.2, "ATK": 52, "POW": 26, "PRes": 44, "MRes": 40, "AS": 0.680, "Crit_pct": 2.0, "Range": 1.4, "MS": 3.22 },
    { "lv": 7, "HP": 1720, "Regen": 9.7, "ATK": 62, "POW": 32, "PRes": 66, "MRes": 60, "AS": 0.720, "Crit_pct": 2.0, "Range": 1.4, "MS": 3.22 },
    { "lv": 10, "HP": 1930, "Regen": 10.45, "ATK": 67, "POW": 35, "PRes": 77, "MRes": 70, "AS": 0.740, "Crit_pct": 2.0, "Range": 1.4, "MS": 3.22 }
  ],
  "passive": { "name": "none" },
  "abilities": {
    "Q": {
      "name": "Shell-Slam",
      "unlock": "L1",
      "type": "circle targeted",
      "range": 2.2,
      "radius": 1.6,
      "school": "magic",
      "l7_formula": "70 + 20% ATK + 40% POW",
      "CD_s": 8.5,
      "cast_s": 0.28,
      "cc": [
        { "effect": "knockup", "duration_s": 0.95, "category": "Lock", "school": "magic" },
        { "effect": "taunt", "duration_s": 2.0, "category": "Handicap", "school": "magic" }
      ],
      "special": ["both CC apply to enemies in radius", "primary always hits; others roll Aim"]
    },
    "W": {
      "name": "Sluice Ward",
      "unlock": "L1",
      "type": "circle ally",
      "range": 6,
      "radius": 1.2,
      "damage": "none",
      "CD_s": 12,
      "cast_s": 0.2,
      "special": [
        "shield 200 + 60% POW for 2.5 s (skill-scaled) on allies in radius (including self if centre)",
        "peel taunt 2.0 s on diver inside radius (enemy only)",
        "if several divers: taunt highest target score vs shielded ally"
      ]
    },
    "R": {
      "name": "Lock-Tide",
      "unlock": "L5",
      "type": "circle skillshot",
      "range": 6,
      "radius": 3.2,
      "school": "magic",
      "l7_formula": "90 + 15% ATK + 50% POW",
      "CD_s": 65,
      "cast_s": 0.45,
      "cc": [{ "effect": "stun", "duration_s": 1.25, "category": "Lock", "school": "magic" }]
    }
  },
  "ai_rules": [
    "Primary peeler and natural zone denier",
    "Holds zone when tactic is Hold the Pit",
    "W is auto-peel first button if diver in radius; Q is melee peel"
  ]
}
```

---

### tolle

```json
{
  "id": "tolle",
  "position": "Jungle",
  "class": "Tank",
  "lean": "Utility",
  "default_slot": "Jungle",
  "faction": "Deepwell",
  "primary_disable": "Stun, Banish, Knockup",
  "stats": [
    { "lv": 1, "HP": 1340, "Regen": 8, "ATK": 52, "POW": 28, "PRes": 44, "MRes": 42, "AS": 0.680, "Crit_pct": 2.0, "Range": 1.5, "MS": 3.25 },
    { "lv": 7, "HP": 1760, "Regen": 9.5, "ATK": 62, "POW": 34, "PRes": 66, "MRes": 62, "AS": 0.720, "Crit_pct": 2.0, "Range": 1.5, "MS": 3.25 },
    { "lv": 10, "HP": 1970, "Regen": 10.25, "ATK": 67, "POW": 37, "PRes": 77, "MRes": 72, "AS": 0.740, "Crit_pct": 2.0, "Range": 1.5, "MS": 3.25 }
  ],
  "passive": {
    "name": "Well-Fed",
    "unlock": "L1",
    "off_under_break": true,
    "on_each_Lock_or_Bind_on_enemy": "heal 25 + 2% max HP",
    "skill_scaled": false,
    "combat_heal_multiplier": 0.75,
    "wellfed_base": 25,
    "wellfed_pct": "2%",
    "notes": "One heal per application (Q stunning two targets heals twice)"
  },
  "abilities": {
    "Q": {
      "name": "Bucket Slam",
      "unlock": "L1",
      "type": "circle targeted",
      "range": 2.2,
      "radius": 1.6,
      "school": "magic",
      "l7_formula": "75 + 15% ATK + 30% POW",
      "CD_s": 9,
      "cast_s": 0.28,
      "cc": [{ "effect": "stun", "duration_s": 0.9, "category": "Lock", "school": "magic" }]
    },
    "W": {
      "name": "Draw Down",
      "unlock": "L1",
      "type": "targeted unit (ally or enemy)",
      "range": 6,
      "radius": 0.0,
      "radius_design_proposal": "0.0 selected unit only; engine fallback body 0.4 — not splash, not 1.2 ally ward",
      "damage": "none",
      "CD_s": 18,
      "cast_s": 0.2,
      "cc": [{ "effect": "banish", "duration_s": 1.8, "category": "Lock", "school": "magic" }]
    },
    "R": {
      "name": "Upwelling",
      "unlock": "L5",
      "type": "circle point",
      "range": 7,
      "radius": 3.4,
      "school": "magic",
      "l7_formula": "80 + 40% POW",
      "CD_s": 70,
      "cast_s": 0.4,
      "cc": [{ "effect": "knockup", "duration_s": 1.1, "category": "Lock", "school": "magic" }],
      "special": ["lands after 0.8 s"]
    }
  },
  "ai_rules": [
    "Jungle-slot tank, natural zone denier (survivability)",
    "Leftover Tolle in zone still denies claim",
    "Well-Fed rewards landing Q/R",
    "W AI (design proposal): (1) allied carry/tank predicted HP ≤ 0 within 1.5 s and focused, else (2) enemy diving assassin/marksman if auto-peel flagged and A_true not already won fight",
    "Never banish only enemy team can hit during winning commit",
    "Never banish leftover enemy denying claim if team about to win claim",
    "Never banish self"
  ]
}
```

---

### helvar

```json
{
  "id": "helvar",
  "position": "Mid",
  "class": "Mage",
  "lean": "Damage",
  "default_slot": "Mid",
  "faction": "Highcairn",
  "primary_disable": "Root, Knockback",
  "stats": [
    { "lv": 1, "HP": 1050, "Regen": 4.5, "ATK": 46, "POW": 72, "PRes": 32, "MRes": 28, "AS": 0.700, "Crit_pct": 2.0, "Range": 5.8, "MS": 3.15 },
    { "lv": 7, "HP": 1230, "Regen": 5.1, "ATK": 52, "POW": 102, "PRes": 40, "MRes": 38, "AS": 0.760, "Crit_pct": 2.0, "Range": 5.8, "MS": 3.15 },
    { "lv": 10, "HP": 1320, "Regen": 5.4, "ATK": 55, "POW": 117, "PRes": 44, "MRes": 43, "AS": 0.790, "Crit_pct": 2.0, "Range": 5.8, "MS": 3.15 }
  ],
  "passive": { "name": "none" },
  "abilities": {
    "Q": {
      "name": "Stoneverse",
      "unlock": "L1",
      "type": "line skillshot",
      "range": 8,
      "length": 8,
      "width": 0.6,
      "school": "magic",
      "l7_formula": "100 + 90% POW",
      "CD_s": 6.8,
      "cast_s": 0.3,
      "special": ["pierce"]
    },
    "W": {
      "name": "Faultline",
      "unlock": "L1",
      "type": "line skillshot",
      "range": 8.5,
      "length": 8.5,
      "width": 2.0,
      "school": "magic",
      "l7_formula": "65 + 50% POW",
      "CD_s": 11.5,
      "cast_s": 0.4,
      "cc": [
        { "effect": "root", "duration_s": 0.8, "category": "Bind", "school": "magic" },
        { "effect": "slow 35%", "duration_s": 1.0, "category": "Handicap", "notes": "real slow; omitted from 5 s dummy CC column" }
      ],
      "special": ["pierce"]
    },
    "R": {
      "name": "Cliffwake",
      "unlock": "L5",
      "type": "line skillshot",
      "range": 9,
      "length": 9,
      "width": 2.2,
      "school": "magic",
      "l7_formula": "230 + 115% POW",
      "CD_s": 65,
      "cast_s": 0.5,
      "special": ["knockback 2.2 tiles away from line origin (caster)", "displacement, not disable category", "pierce"]
    }
  },
  "ai_rules": [
    "Mid mage, poke",
    "Starve/Poke comps want Helvar firing through pit from range",
    "R knocks enemies off zone — break exclusive occupation"
  ]
}
```

---

### calder

```json
{
  "id": "calder",
  "position": "Mid",
  "class": "Mage",
  "lean": "Hybrid",
  "default_slot": "Mid",
  "faction": "Cinderwell",
  "primary_disable": "Fear",
  "stats": [
    { "lv": 1, "HP": 960, "Regen": 4.2, "ATK": 48, "POW": 74, "PRes": 28, "MRes": 30, "AS": 0.740, "Crit_pct": 2.0, "Range": 5.6, "MS": 3.22 },
    { "lv": 7, "HP": 1140, "Regen": 4.8, "ATK": 54, "POW": 104, "PRes": 36, "MRes": 40, "AS": 0.800, "Crit_pct": 2.0, "Range": 5.6, "MS": 3.22 },
    { "lv": 10, "HP": 1230, "Regen": 5.1, "ATK": 57, "POW": 119, "PRes": 40, "MRes": 45, "AS": 0.830, "Crit_pct": 2.0, "Range": 5.6, "MS": 3.22 }
  ],
  "passive": { "name": "none" },
  "abilities": {
    "Q": {
      "name": "Ashbreath",
      "unlock": "L1",
      "type": "cone skillshot",
      "range": 6.4,
      "angle_deg": 60,
      "school": "magic",
      "l7_formula": "115 + 95% POW",
      "CD_s": 6.5,
      "cast_s": 0.28
    },
    "W": {
      "name": "Smoke Drink",
      "unlock": "L1",
      "type": "self",
      "radius": 0.0,
      "notes": "authored circle self with no r; self only",
      "damage": "none",
      "CD_s": 12.5,
      "cast_s": 0.2,
      "special": ["heal 75 + 45% POW (skill-scaled, combat ×0.75)"]
    },
    "R": {
      "name": "Ash Panic",
      "unlock": "L5",
      "type": "circle point",
      "range": 7,
      "radius": 3.0,
      "school": "magic",
      "l7_formula": "215 + 110% POW",
      "CD_s": 58,
      "cast_s": 0.45,
      "cc": [{ "effect": "fear", "duration_s": 1.6, "category": "Lock", "school": "magic" }]
    }
  },
  "ai_rules": [
    "Mid hybrid mage",
    "W self-sustain below 60% HP or when retreating",
    "R disengage/pit-clear fear; do not fear enemies into backline"
  ]
}
```

---

### kerrig

```json
{
  "id": "kerrig",
  "position": "Mid",
  "class": "Assassin",
  "lean": "Damage",
  "default_slot": "Mid",
  "faction": "Lowfen",
  "primary_disable": "Leash, Slow, (R commit)",
  "stats": [
    { "lv": 1, "HP": 870, "Regen": 4, "ATK": 70, "POW": 36, "PRes": 24, "MRes": 24, "AS": 0.900, "Crit_pct": 8.0, "Range": 1.5, "MS": 3.5 },
    { "lv": 7, "HP": 1050, "Regen": 4.72, "ATK": 96, "POW": 48, "PRes": 32, "MRes": 32, "AS": 1.040, "Crit_pct": 13.0, "Range": 1.5, "MS": 3.5 },
    { "lv": 10, "HP": 1140, "Regen": 5.08, "ATK": 109, "POW": 54, "PRes": 36, "MRes": 36, "AS": 1.110, "Crit_pct": 15.5, "Range": 1.5, "MS": 3.5 }
  ],
  "passive": { "name": "none" },
  "abilities": {
    "Q": {
      "name": "Latch Line",
      "unlock": "L1",
      "type": "line skillshot",
      "range": 6.5,
      "length": 6.5,
      "width": 0.45,
      "school": "physical",
      "l7_formula": "110 + 85% ATK",
      "CD_s": 7.5,
      "cast_s": 0.28,
      "cc": [{ "effect": "leash", "duration_s": 2.8, "category": "Bind", "school": "physical", "notes": "leash range 3.5 tiles" }],
      "special": ["stops at first enemy", "mark 2.8 s (required by R)"]
    },
    "W": {
      "name": "Spool Cut",
      "unlock": "L1",
      "type": "circle targeted",
      "range": 1.8,
      "radius": 1.2,
      "school": "physical",
      "l7_formula": "95 + 90% ATK",
      "CD_s": 7,
      "cast_s": 0.12,
      "cc": [{ "effect": "slow 30%", "duration_s": 0.8, "category": "Handicap", "school": "physical" }]
    },
    "R": {
      "name": "Reeling Cut",
      "unlock": "L5",
      "type": "streak targeted",
      "range": 5.5,
      "dash_tiles": 5,
      "school": "physical",
      "l7_formula": "330 + 140% ATK + 15% POW",
      "CD_s": 42,
      "cast_s": 0.7,
      "special": [
        "requires live mark on target (from Q)",
        "finisher: raw × (1 + 0.35 × missing-HP fraction)",
        "CD starts on windup (even if dash cancelled)",
        "on landed hit: 2.8 s commitment — no retreat/new dash until ends",
        "Self-Break 2.8 s (§6.5)",
        "do not add second 1.5 s commitment tax",
        "cast 0.7 s — statsheet v4.1 wins over older 0.50 s windup"
      ]
    }
  },
  "ai_rules": [
    "Mid assassin",
    "Combo Q (mark+leash) → walk/dash in → W → R when mark live and target wounded or Fight Call commit",
    "If combo will not kill and sanctuary behind target, abort — do not dash into pad",
    "2.8 s commitment is why auto-peel must answer him"
  ]
}
```

---

### mirren

```json
{
  "id": "mirren",
  "position": "Mid",
  "class": "Mage",
  "lean": "Utility",
  "default_slot": "Mid",
  "faction": "Kilnhold",
  "primary_disable": "Hex",
  "stats": [
    { "lv": 1, "HP": 920, "Regen": 4, "ATK": 44, "POW": 70, "PRes": 26, "MRes": 30, "AS": 0.700, "Crit_pct": 2.0, "Range": 5.5, "MS": 3.2 },
    { "lv": 7, "HP": 1100, "Regen": 4.6, "ATK": 50, "POW": 100, "PRes": 34, "MRes": 40, "AS": 0.760, "Crit_pct": 2.0, "Range": 5.5, "MS": 3.2 },
    { "lv": 10, "HP": 1190, "Regen": 4.9, "ATK": 53, "POW": 115, "PRes": 38, "MRes": 45, "AS": 0.790, "Crit_pct": 2.0, "Range": 5.5, "MS": 3.2 }
  ],
  "passive": {
    "name": "Kiln-Cured",
    "unlock": "L1",
    "off_under_break": true,
    "enemies_hexed_by_mirren": "+12% damage from all sources for hex duration",
    "kiln_amp": "+12%"
  },
  "abilities": {
    "Q": {
      "name": "Glaze Spit",
      "unlock": "L1",
      "type": "circle targeted",
      "range": 6,
      "radius": 1.6,
      "school": "magic",
      "l7_formula": "115 + 90% POW",
      "CD_s": 7,
      "cast_s": 0.28
    },
    "W": {
      "name": "Jarring",
      "unlock": "L1",
      "type": "targeted unit",
      "range": 6,
      "radius": 0.0,
      "radius_design_proposal": "0.0 selected unit only; body 0.4 if required; do not splash",
      "l7_damage": "none (hex is the point)",
      "CD_s": 15,
      "cast_s": 0.25,
      "cc": [{ "effect": "hex", "duration_s": 1.6, "category": "Lock", "school": "magic", "notes": "hex also slows 35%" }],
      "special": ["preferred target: enemy carry (ADC slot, else highest damage dealer)"]
    },
    "R": {
      "name": "Kiln Chorus",
      "unlock": "L5",
      "type": "circle point",
      "range": 8,
      "radius": 2.8,
      "school": "magic",
      "l7_formula": "150 + 75% POW",
      "CD_s": 70,
      "cast_s": 0.55,
      "cc": [{ "effect": "hex", "duration_s": 1.5, "category": "Lock", "school": "magic", "notes": "hex also slows 35%" }],
      "special": ["Kiln-Cured applies to every enemy hexed by R"]
    }
  },
  "ai_rules": [
    "Mid utility mage",
    "Put Kiln-Cured on focus, then team hits",
    "W the carry; R the clump"
  ]
}
```

---

### rhedan

```json
{
  "id": "rhedan",
  "position": "Top",
  "class": "Fighter",
  "lean": "Hybrid",
  "default_slot": "Top",
  "faction": "Ironwake",
  "primary_disable": "Root+Pull, Knockup",
  "stats": [
    { "lv": 1, "HP": 1100, "Regen": 6.2, "ATK": 72, "POW": 14, "PRes": 36, "MRes": 30, "AS": 0.780, "Crit_pct": 5.0, "Range": 1.45, "MS": 3.35 },
    { "lv": 7, "HP": 1360, "Regen": 7.28, "ATK": 94, "POW": 18, "PRes": 52, "MRes": 42, "AS": 0.860, "Crit_pct": 8.0, "Range": 1.45, "MS": 3.35 },
    { "lv": 10, "HP": 1490, "Regen": 7.82, "ATK": 105, "POW": 20, "PRes": 60, "MRes": 48, "AS": 0.900, "Crit_pct": 9.5, "Range": 1.45, "MS": 3.35 }
  ],
  "passive": { "name": "none" },
  "abilities": {
    "Q": {
      "name": "Tide-Cleave",
      "unlock": "L1",
      "type": "cone targeted (facing target)",
      "range": 3,
      "angle_deg": 70,
      "school": "physical",
      "l7_formula": "90 + 75% ATK",
      "CD_s": 7,
      "cast_s": 0.25,
      "special": ["primary always hits; others in cone roll Aim"]
    },
    "W": {
      "name": "Wake Hook",
      "unlock": "L1",
      "type": "line skillshot",
      "range": 5.5,
      "length": 5.5,
      "width": 0.5,
      "school": "physical",
      "l7_formula": "45 + 30% ATK",
      "CD_s": 12,
      "cast_s": 0.3,
      "cc": [{ "effect": "root", "duration_s": 0.7, "category": "Bind", "school": "physical" }],
      "special": ["stops at first enemy", "pull 4 tiles toward Rhedan (displacement)"]
    },
    "R": {
      "name": "Keelbreak",
      "unlock": "L5",
      "type": "circle targeted",
      "range": 2.8,
      "radius": 2.4,
      "school": "physical",
      "l7_formula": "150 + 90% ATK",
      "CD_s": 50,
      "cast_s": 0.4,
      "cc": [{ "effect": "knockup", "duration_s": 0.9, "category": "Lock", "school": "physical" }]
    }
  },
  "ai_rules": [
    "Top fighter, flex frontline",
    "Hook is engage and peel (hook diver off carry)",
    "Not Tank; can still deny claim if alive in zone at resolve (any unit can)"
  ]
}
```

---

### brannoch

```json
{
  "id": "brannoch",
  "position": "Top",
  "class": "Tank",
  "lean": "Hybrid",
  "default_slot": "Top",
  "faction": "Highcairn",
  "primary_disable": "Slow, Knockup, Petrify",
  "stats": [
    { "lv": 1, "HP": 1460, "Regen": 8, "ATK": 54, "POW": 24, "PRes": 46, "MRes": 40, "AS": 0.680, "Crit_pct": 2.0, "Range": 1.5, "MS": 3.2 },
    { "lv": 7, "HP": 1880, "Regen": 9.5, "ATK": 64, "POW": 30, "PRes": 68, "MRes": 60, "AS": 0.720, "Crit_pct": 2.0, "Range": 1.5, "MS": 3.2 },
    { "lv": 10, "HP": 2090, "Regen": 10.25, "ATK": 69, "POW": 33, "PRes": 79, "MRes": 70, "AS": 0.740, "Crit_pct": 2.0, "Range": 1.5, "MS": 3.2 }
  ],
  "passive": {
    "name": "Bedrock",
    "unlock": "L1",
    "off_under_break": true,
    "while_below_50pct_HP": "+20 PRes and +20 MRes",
    "bedrock_hp": "50%",
    "bedrock_res": "+20",
    "notes": "Not included in snapshot eHP column (unbuffed)"
  },
  "abilities": {
    "Q": {
      "name": "Quarry Throw",
      "unlock": "L1",
      "type": "line skillshot",
      "range": 6.5,
      "length": 6.5,
      "width": 0.6,
      "school": "physical",
      "l7_formula": "125 + 65% ATK",
      "CD_s": 8,
      "cast_s": 0.3,
      "cc": [{ "effect": "slow 35%", "duration_s": 1.5, "category": "Handicap", "school": "physical" }],
      "special": ["pierce"]
    },
    "W": {
      "name": "Cairn Shoulder",
      "unlock": "L1",
      "type": "streak targeted",
      "range": 3.5,
      "school": "physical",
      "l7_formula": "90 + 45% ATK",
      "CD_s": 12,
      "cast_s": 0.2,
      "cc": [{ "effect": "knockup", "duration_s": 0.6, "category": "Lock", "school": "physical" }],
      "special": ["dashes to target"]
    },
    "R": {
      "name": "Stonefast",
      "unlock": "L5",
      "type": "circle point self-centred",
      "range": 2.6,
      "radius": 2.6,
      "school": "magic",
      "l7_formula": "170 + 20% ATK + 45% POW",
      "CD_s": 60,
      "cast_s": 0.4,
      "cc": [{ "effect": "stun", "duration_s": 1.6, "category": "Lock", "school": "magic", "notes": "tag petrify: stun + 25% damage reduction on petrified unit" }],
      "special": ["hits enemies in radius"]
    }
  },
  "ai_rules": [
    "Top tank, natural zone denier (survivability + aura), heavy peeler",
    "Stands in zone",
    "R pit button when 2+ enemies in self circle",
    "Bedrock harder to finish — not reason to dive at 40%"
  ]
}
```

---

### ysol

```json
{
  "id": "ysol",
  "position": "Support",
  "class": "Enchanter",
  "lean": "Utility",
  "default_slot": "Support",
  "faction": "Kilnhold",
  "primary_disable": "Silence, Knockup",
  "stats": [
    { "lv": 1, "HP": 860, "Regen": 3.8, "ATK": 42, "POW": 68, "PRes": 24, "MRes": 28, "AS": 0.680, "Crit_pct": 2.0, "Range": 5.4, "MS": 3.28 },
    { "lv": 7, "HP": 1040, "Regen": 4.4, "ATK": 48, "POW": 90, "PRes": 32, "MRes": 38, "AS": 0.730, "Crit_pct": 2.0, "Range": 5.4, "MS": 3.28 },
    { "lv": 10, "HP": 1130, "Regen": 4.7, "ATK": 51, "POW": 101, "PRes": 36, "MRes": 43, "AS": 0.755, "Crit_pct": 2.0, "Range": 5.4, "MS": 3.28 }
  ],
  "passive": {
    "name": "none",
    "notes": "Enchanter growth, Support slot. Saelo is Support Mage — do not confuse classes."
  },
  "abilities": {
    "Q": {
      "name": "Kiln Bell",
      "unlock": "L1",
      "type": "cone targeted",
      "range": 7.2,
      "angle_deg": 80,
      "school": "magic",
      "l7_formula": "60 + 40% POW",
      "CD_s": 12.5,
      "cast_s": 0.3,
      "cc": [{ "effect": "silence", "duration_s": 1.0, "category": "Handicap", "school": "magic" }]
    },
    "W": {
      "name": "Ember Mending",
      "unlock": "L1",
      "type": "circle ally",
      "range": 6.5,
      "radius": 1.2,
      "damage": "none",
      "CD_s": 13,
      "cast_s": 0.25,
      "special": [
        "heal 95 + 45% POW (skill-scaled, combat ×0.75)",
        "strong dispel on each ally in radius (including chosen centre)",
        "see §6.7 for strong dispel"
      ]
    },
    "R": {
      "name": "Vowbreak",
      "unlock": "L5",
      "type": "circle skillshot",
      "range": 6,
      "radius": 2.6,
      "school": "magic",
      "l7_formula": "105 + 70% POW",
      "CD_s": 70,
      "cast_s": 0.45,
      "cc": [{ "effect": "knockup", "duration_s": 1.05, "category": "Lock", "school": "magic" }]
    }
  },
  "ai_rules": [
    "Primary enchanter peeler",
    "W is auto-peel heal/dispel button",
    "Q silences diver mid-combo (especially Kerrig)",
    "Stand with marksman, not in pit",
    "Can deny claim if in zone at resolve — not her job"
  ]
}
```

---

### saelo

```json
{
  "id": "saelo",
  "position": "Support",
  "class": "Mage",
  "lean": "Utility",
  "default_slot": "Support",
  "faction": "Glasswater",
  "primary_disable": "Slow, Time-stop",
  "stats": [
    { "lv": 1, "HP": 900, "Regen": 3.8, "ATK": 42, "POW": 70, "PRes": 26, "MRes": 30, "AS": 0.680, "Crit_pct": 2.0, "Range": 5.5, "MS": 3.25 },
    { "lv": 7, "HP": 1080, "Regen": 4.4, "ATK": 48, "POW": 100, "PRes": 34, "MRes": 40, "AS": 0.740, "Crit_pct": 2.0, "Range": 5.5, "MS": 3.25 },
    { "lv": 10, "HP": 1170, "Regen": 4.7, "ATK": 51, "POW": 115, "PRes": 38, "MRes": 45, "AS": 0.770, "Crit_pct": 2.0, "Range": 5.5, "MS": 3.25 }
  ],
  "passive": {
    "name": "Rewound Moment",
    "unlock": "L1",
    "off_under_break": true,
    "once_per_fight_when_HP_below_30pct": "shield 25% max HP for 2.5 s",
    "rewind_hp": "30%",
    "rewind_shield": "25%",
    "rewind_dur_s": 2.5,
    "skill_scaled": false,
    "reset": "out of any declared fight for 8.0 s (death does not reset mid-fight)",
    "shield_subject_to_25pct_cap": true
  },
  "abilities": {
    "Q": {
      "name": "Second Hand",
      "unlock": "L1",
      "type": "line skillshot",
      "range": 7,
      "length": 7,
      "width": 0.5,
      "school": "magic",
      "l7_formula": "105 + 80% POW",
      "CD_s": 8,
      "cast_s": 0.3,
      "cc": [{ "effect": "slow 30%", "duration_s": 1.2, "category": "Handicap", "school": "magic" }],
      "special": ["pierce"]
    },
    "W": {
      "name": "Unwind",
      "unlock": "L1",
      "type": "ally targeted",
      "range": 6.5,
      "radius": 0.0,
      "radius_design_proposal": "v1 default 0.0; alt r=1.2 (Ysol parity) — do not silently take alternative",
      "damage": "none",
      "CD_s": 14,
      "cast_s": 0.25,
      "special": [
        "heal 65 + 35% POW (skill-scaled, combat ×0.75)",
        "basic dispel on target",
        "see §6.7"
      ]
    },
    "R": {
      "name": "Still Hour",
      "unlock": "L5",
      "type": "circle point",
      "range": 8,
      "radius": 2.4,
      "school": "magic",
      "l7_formula": "90 + 45% POW",
      "CD_s": 85,
      "cast_s": 0.7,
      "cc": [{ "effect": "time-stop", "duration_s": 2.0, "category": "Lock", "school": "magic" }],
      "special": [
        "hits enemies and allies in radius except caster",
        "time-stop does not pierce Spellward",
        "see §6.5"
      ]
    }
  },
  "ai_rules": [
    "Support mage",
    "W single-target peel/dispel (weaker heal than Ysol, basic not strong)",
    "R decisive pit button and friendly-fire trap: only fire if ≥2 enemies hit and ≤1 ally hit, or Fight Call flagged Still Hour",
    "85 s CD → at most one, sometimes two, per match"
  ]
}
```

---

## Torun W CC note (encoded rule)

Peel taunt on W is **2.0 s** Handicap-class behaviour (taunt), not listed as separate CC block in Q/R style but specified in ability text.

## Sedge R / Saelo R friendly-fire AI thresholds (rules)

| Champion | Rule |
|----------|------|
| Sedge R | Default: ≥2 enemies and ≤1 ally (other than self) hit; or Fight Call commit R |
| Saelo R | ≥2 enemies hit and ≤1 ally hit; or Fight Call explicitly flagged Still Hour |