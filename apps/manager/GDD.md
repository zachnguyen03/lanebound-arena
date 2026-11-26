# Lanebreak Manager — Game Design Document

Updated 2026-11-25 (v0.8, Lanebound engine, Tactic Cards). This file is updated every time a feature lands. The parity plan against the LEM feature summary is in `PLAN.md`.

## Overview & pillars

Lanebreak Manager is a browser esports-management game. You run a club in a fictional 5v5 MOBA scene, and every match plays out live in a tick-based simulation. You influence it only through roster, draft, training and game plans. It is an original game in the Teamfight Manager / Football Manager mould: no champions, leagues, names or art are taken from existing games.

- **Decisions, not reflexes.** The player never controls a champion. Every lever is a manager's lever: who plays, what they pick, how they are told to play.
- **A readable simulation.** Every outcome traces back to player attributes, champion choice and the game plan. The live view, feed and match report show why a game was won.
- **Career depth.** A dated calendar, a three-tier pyramid in five regions, two international events, transfers, contracts, training, aging and full statistics.
- **Zero install.** Static web files and plain JavaScript. Runs in any modern browser and saves locally.

## Core loop

The manager advances the calendar with Continue (one day) or the sim controls (next match, until a date, rest of season). The sim stops before each of the manager's fixtures and, if enabled, when an offer or scouting report arrives. Weekdays are training days, matches fall mostly on weekends, and the Monday tick pays wages and sponsors and develops players.

The live match is the only step where time runs inside a game. Everything else is a management decision made between days.

## Match engine

Every full-engine game runs on the Lanebound sim (`sim/simulate.ts`) through the adapter `js/engine.ts`. `runFull(teamA, teamB, seed, opts)` builds a MatchConfig (Blue = teamA) in the sandbox mode the Watch app ships: three capture points (`objectives: points`), the round-3 teamfight AI, the sandbox constants (first to 28) and the sandbox kit patch, AI on, fixed draft, no forced clock end. It runs `simulate` and converts the result into the career's match summary. The same seed and inputs always give the same summary, and `summary.config` re-simulates the game exactly (for the Watch view later).

**Scoring.** A team scores 1 point per kill, 1 point every 15 s while it owns two of the three points (majority), and 1 point for a fight claim. First to 28 wins; a game still running at 4:00 goes to the leader, then to point control time and takedowns. Measured: games average 3:18 (198 ± 25 s), the loser scores 18.7 on average, about two thirds of the points come from kills, and 6% of games reach the clock.

**Milestones** (`sim/milestones.ts`, `MatchConfig.milestones`, on for career games with the defaults in `MILESTONES`). Kill streak: kills since the unit's last death; at 3 the unit is on fire (+5% damage while the streak lasts; `spree` at 3 and 5). Shutdown: killing an on-fire unit pays the killer's team +1 on top of the takedown point (`shutdown`). Anchor: 20 s straight on a point the team owns gives −10% damage taken while the unit stays on it (`anchor_start` / `anchor_end`). Sweep: owning all 3 points for 10 s straight scores +1, once per sweep, re-armed when any point is lost (`sweep`). The summary counts sprees, shutdowns and anchor seconds per player (`sp`, `sd`, `anc`) and sweeps per side (`sweeps`); the post-game shows shutdowns and sweeps in the team comparison and sprees / anchor seconds under each team, and the feed lists sweeps. The fast engine ignores milestones. Measured (scratch `msfit.mjs`: `test/fit.mjs` lineups, 1,600 games per row, off → on; comeback = the side behind at half time wins, ±2.3):

| Teams | Comeback | Length | Kills | Per game (on) |
|---|---|---|---|---|
| even (gap 0) | 26.8% → 27.2% | 209 → 188 s | 31.7 → 28.6 | 3.4 sprees, 1.8 shutdowns, 3.0 sweeps, 10 anchor-s |
| gap 8 | 21.5% → 22.3% | 203 → 185 s | 30.9 → 28.2 | same; stronger side wins 75.4% → 75.1% |

Comeback rates are unchanged within noise (no snowballing from the on-fire buff), so the defaults stay. Games are ~10% shorter from the ~4.8 extra points. Champion win rates on even teams: 43.1% (Mirren) to 54.3% (Huntress), was 43.4–56.0% on the same games.

**Champion balance.** `BASE_MODS` in `engine.ts` is a career-only balance layer (fractions of base HP, attack and power, and cooldowns) under the season patches: Ysol and Saelo get more HP, power and faster cooldowns, Huntress, Isra and Maelis lose attack, and smaller HP touches elsewhere. With attribute scaling on and even teams (2,400 games) every champion wins 44–55%; before, Ysol 40%, Saelo 42%, Huntress 58.5%. The sandbox and Watch are unaffected.

**Attributes in the engine.** The sim reads six attributes per player: Aim, Reflexes, Execution, Decision Making, Positioning and Teamwork. Career attributes keep the 1–99 scale and enter the sim 1:1 plus 10, so a 60-rated player is the sim's even 70. Before that, the career applies what it always did: traits, morale, condition, playing out of position and team chemistry (`calendar.enginePlayer`), then the adapter applies the day's form roll to Aim, Reflexes, Execution and Teamwork, and the coach rating adds (coach − 10) × 0.6 to Decision Making. Champion mastery maps to the sim's 0–100 mastery as 50 + (mastery − 0.85) × 200; the sim turns it into up to ±8 Aim and Execution. On their own the sim's attributes only touch skillshot hit chance, reaction delays and AI decisions, so gaps moved results little (a team 16 points better won 58%). The adapter therefore switches on the sim experiment `MatchConfig.attr_scaling` (`sim/combat.ts`, `attrDamageMult`), which scales every damage packet by attributes around the sim's 70 (d = (attr − 70)/100): damage dealt × (1 + 0.09·Aim + 0.22·Execution + 0.18·Decision when a teammate hit the target in the last 2 s + 0.11·Teamwork with a teammate within 5 tiles), damage taken × (1 − 0.18·Positioning − 0.09·Reflexes − 0.11·Teamwork with a teammate near). Measured with `test/attr-fit.mjs` (A alternates Blue and Red; ±5 points at 95%):

| Matchup | Stronger side wins | Before scaling |
|---|---|---|
| Uniform gap 0 / 4 / 8 / 16 (600 games each) | 50.5 / 61.3 / 68.3 / 84.0% | 51 / 52 / 56 / 58% |
| Team +15 in one attribute (400 games each) | Aim 57.8, Reflexes 56.0, Execution 57.5, Decision 55.0, Positioning 58.0, Teamwork 58.0% | |

Champion win rates with even teams are unchanged in shape: Saelo (~35–40%) and Maelis (~60%) are the outliers with or without scaling, the rest 45–57%.

| Attribute | Effect |
|---|---|
| Aim, Reflexes, Execution, Decision Making, Positioning, Teamwork | Passed to the sim as the player's attributes (see the sim's build spec for what each drives) |
| Aggression | Team mean shifts the plan's posture one step: tactics aggression = posture (−1/0/+1) + (mean − 60)/20, rounded and clamped |
| Resilience | Narrows the form roll: spread 0.13 − 0.0008 × Resilience |
| Clutch | Form bonus (Clutch − 50)/400 × stakes (playoffs, finals, deciders, rivalries) |

**Game plan.** A plan is a sim tactics preset plus posture, target focus and carry protection: Hold the pit (group on the centre point), Hunt (chase fights, take enemy-held points) or Starve (spread over the points and avoid fights); posture aggressive / balanced / defensive; focus auto or an enemy role; protect the carry on or off. Presets: Standard (hold, balanced), Early aggression (hunt, aggressive, no peel), Scale and teamfight (hold, defensive, focus the carry), Split map (starve, balanced), Objective control (starve, defensive). The plan is fixed for the game: the sim has no phases and no mid-game plan change.

The arena, movement and capture points are the sim's (`sim/map.ts`, `sim/objectives.ts`); the career has no map code of its own.

**Event stream.** The summary keeps kills (killer, victim, assists, first blood, shutdown, streak), deaths with no killer, aces, point captures, majority ticks and claims, plus a score timeline. There are no positions or frames; a replay re-simulates from the config.

**Fast engine** (`js/fastsim.js`). Background games use a statistical model with the same summary shape. Each lineup's strength is its role-weighted sim attributes (expected form, coach, mastery on Aim and Execution); the winner comes from a logistic logit = 0.0356 + 0.1302·d + 1.73·x, d = strength gap, x = balance-patch gap (each champion's hp + atk − cd patch fractions summed per lineup), fitted on 3,000 full-engine career games with milestones on. With a uniform attribute gap of 0/4/8/16 the stronger side wins 52/61/76/90% on the full engine and 51/65/75/90% on the fast engine; in randomly patched games the more-buffed side wins 56.5% (full) and 57.8% (fast). Scores, kill points, captures and stat lines are drawn around per-role per-minute means measured on the full engine. Milestones: a shutdown (victim on a 3+ kill streak) turns the side's next kill point into its bounty, 17% of the winner's and 13% of the loser's objective points are sweeps, sprees count at streaks of 3 and 5, anchor seconds are drawn per role. **Calibration:** `npm run manager:refit` (`test/refit.mjs`: 3,000 full-engine games in parallel, about 2 minutes) prints the constants block for `fastsim.js` and `ROLE_MEANS` for `engine.ts`; run it after any sim or career-balance change, then re-centre `ROLE_ADJ`. **Sim detail** (Settings): Fast (every AI game statistical), Top leagues (default: top-league and international AI games on the full engine, about 1 s more per week of fixtures), Every game (5–10 s per week). The manager's games always use the full engine.

## 5v5 format, roles & champions

One player per role: Top, Jungle, Mid, Carry, Support (the sim's top, jungle, mid, adc, support). The 14 champions are the sim's (`data/champions/defs.ts`); each has one role, its default slot. A champion played outside its role plays at 85% mastery. The sim owns every stat and kit: the career has no traits, passives, composition tags or counter triangle.

| Role | Champions |
|---|---|
| Top | Rhedan (Fighter), Brannoch (Tank) |
| Jungle | Sedge (Mage), Torun (Tank), Tolle (Tank) |
| Mid | Helvar (Mage), Calder (Mage), Kerrig (Assassin), Mirren (Mage) |
| Carry | Huntress, Maelis, Isra (Marksmen) |
| Support | Ysol (Enchanter), Saelo (Mage) |

Top and Support have two champions each, so most drafts put someone off-role.

**Patches.** Three a season: pre-season, 6 July (summer split) and 24 September (before the Grand Convergence). Each nerfs the 1–2 strongest champions by presence and win rate in top-league and international games and buffs the 1–2 weakest: 5–12% to HP, attack or cooldowns, cumulative, capped at ±25%; unchanged mods decay ×0.7 a patch. They reach the sim as a kit patch on top of the sandbox kit patch (HP; attack and power; Q, W and R cooldowns). Patch notes arrive in the inbox; the Meta tab shows the notes and an S/A/B/C tier list by role. AI clubs practise buffed champions for their role.

## Draft

**Order (12 steps):** one ban each (Blue, Red), then picks B R R B B R R B B R. The higher seed is Blue in game 1; sides alternate within a series. There is no Fearless mode: 14 champions can't support it.

**AI drafting.** Bans take the opponent's best comfort pick for a role they still have to fill, weighted by the patch. Picks take the best mastery for an open slot (off-role at 85%) plus the patch's meta value. The analyst's suggestion shows the reason.

## Tactic Cards

*Built in v0.8 (`js/cards.js`, sim `sim/cards.ts`). Design: CARD_PLAN.md, translated from the lane engine to points mode.* Every starter brings 2–3 cards; before each game both coaches secretly load up to 3. A card fires when its trigger happens in the game and applies a short effect. Cards are hidden until they fire.

**Rules.** Loadout: at most 3 cards, total cost ≤ 6 Focus, at most 2 from one player, at most one Signature. Cost = base cost (1–2) + 1 for Epic (max 3); Signature cards cost 3. Each card fires once a game unless it is marked Repeat. **Fearless cards:** a card loaded in a game of a series (fired or not) can't be loaded again in that series (`s.cards[teamId]` holds the used `pid:cardId` keys). **Resting cards:** a loaded card sits out the team's next 1 (Common), 2 (Rare) or 3 (Epic, Signature) games, across series too (`team.rest`: key to games left, counted down at each load), so the best loadout rotates; the card select shows the games left and the draft's scouting panel shows the opponent's resting cards. Classic mode (new-career setting, fixed for the career, `W.classic`) turns cards off.

**Where cards come from** (`playerCards`, derived from the player every time, so no save field). Slot 1: a role card (two per role, picked by the player's id). Slot 2: the first trait card (Aggressive, Hot-headed, Clutch performer, Shotcaller, Team player, Ice cold, Professional, Sharpshooter), else the card of the best attribute. Slot 3 at overall 70+: Franchise (Signature) at 80+, a {Champion} Specialist (Signature) at 75+ with a role champion at mastery ≥ 1.10, otherwise the next trait/attribute card. Rarity: overall < 60 all Common; 60–69 slot 2 Rare; 70–79 slot 2 Epic, others Rare; 80+ all Epic. Rarity scales every numeric effect: Common ×1, Rare ×1.3, Epic ×1.6 (score bonuses are not scaled). The player page shows a player's cards.

**Triggers** (`sim/cards.ts`, checked every tick from the tick's events and the state): first capture of the game, we take the majority (2 of 3 points), the enemy takes a point we held, we hold the majority for N s, we trail / lead by N points, the score is within N at a time, the clock reaches a time, first blood for us / for them, the holder reaches N kills, the holder (or our / their role) has died N times, an ally scores N kills within 10 s, the holder hasn't died by a time, the enemy drafts N+ of a class (at 0:00), the holder plays a champion (at 0:00). **Effects:** damage dealt, damage taken, move speed, cooldown recovery, capture speed and respawn timers as multipliers for N s (or the game), a one-shot shield (fraction of max HP), +N score, and a tactic override (preset, aggression, focus) for N s. Personal effects (on the holder, `sim/cards.ts` + `sim/combat.ts` / `status.ts`): execute (a hit that leaves an enemy below v of max HP kills it; the kill is credited normally, `execute` event), lifesteal (heals v of damage dealt), refund (each takedown cuts current cooldowns by v), tenacity (incoming crowd-control durations × 1 − v) and +v damage against one champion class. Targets: the holder, the team or the enemy team. A firing emits `card_fire {team, card_id, owner, score?}`; the summary turns it into a `card` event (`side, id, pid`).

**AI coaches** load the 3 legal cards with the highest measured win-chance gain still unused in the series (+0.5% for each card whose tags fit the club's plan: Early aggression likes early/fight cards, Scale likes scale/comeback, Split and Objective control like objective cards). The user's card select starts from the same analyst pick.

**Fast engine.** Each loaded card adds its measured win-chance gain to the side's strength (dd = 4·gain / k). Draft triggers are resolved from the picks: gain / fire rate when met, 0 when not. Synthetic `card` events are drawn with the measured fire rate (at the trigger's time for clock triggers, otherwise anywhere in the game), so feeds and stats see cards in background games.

**UI.** Card select before the draft (the five starters' cards with rules text, Focus meter, per-player limit, cards used this series greyed out, the measured fire rate per card); in the draft the user's column lists the loaded cards as Live / Dead (draft triggers) or Likely with the fire rate; the live view shows a reveal banner (card art, side, effect) for 4 s and a feed line; the post-game lists your cards as fired (with the time) or not fired, and the opponent's revealed cards. Dev gallery at `#/dev/cards`.

**Measured effect** (`test/card-fit.mjs`: even teams, the card on one side alternating Blue and Red, paired against the same games without cards; win-chance gain in points with a 95% interval; fire rate at Common):

| Card | Fire | Common | Epic | Fit (C / E) |
|---|---|---|---|---|
| island-lord | 60% | +2.0 ± 4.5 | +0.8 ± 4.6 | 0.9 / 1.5 |
| stubborn | 95% | +1.0 ± 4.1 | +1.8 ± 4.5 | 1.1 / 1.7 |
| clear-speed | 50% | +1.6 ± 2.2 | +3.4 ± 2.2 | 2.0 / 3.2 |
| bounty-hunter | 63% | +1.3 ± 3.7 | +2.5 ± 3.3 | 1.5 / 2.4 |
| triple-threat | 58% | +2.4 ± 1.8 | +4.9 ± 1.8 | 2.5 / 4.0 |
| called-shot | 99% | +1.8 ± 5.7 | +2.8 ± 6.1 | 1.8 / 2.8 |
| hypercarry | 80% | +0.5 ± 3.8 | -0.3 ± 4.2 | 0.5 / 0.8 |
| second-wind | 62% | +1.0 ± 3.3 | +3.0 ± 3.9 | 1.6 / 2.6 |
| hold-the-line | 100% | +1.6 ± 2.8 | +3.3 ± 2.8 | 1.9 / 3.1 |
| peel | 88% | +1.5 ± 4.8 | +4.3 ± 5.3 | 2.4 / 3.8 |
| spoils-of-war | 51% | +3.0 ± 4.2 | +0.8 ± 4.6 | 1.2 / 1.9 |
| shake-it-off | 50% | +1.5 ± 4.2 | +3.0 ± 4.3 | 1.8 / 2.8 |
| never-say-die | 51% | +2.2 ± 1.7 | +4.9 ± 1.9 | 2.5 / 4.0 |
| call-it | 93% | +2.5 ± 2.6 | +4.9 ± 2.6 | 2.5 / 4.0 |
| press-the-claim | 99% | -0.3 ± 4.1 | +2.5 ± 4.2 | 1.0 / 1.7 |
| blood-in-the-water | 88% | +1.5 ± 5.0 | +0.8 ± 5.1 | 0.8 / 1.2 |
| dead-heat | 43% | +1.3 ± 3.5 | +3.5 ± 3.6 | 1.9 / 3.1 |
| long-game | 100% | +3.1 ± 2.2 | +1.0 ± 2.1 | 1.3 / 2.1 |
| closing-argument | 49% | +1.8 ± 3.1 | +3.0 ± 2.9 | 1.9 / 3.0 |
| last-stand | 30% | +1.3 ± 1.6 | +2.3 ± 1.5 | 1.4 / 2.2 |
| first-claim | 50% | +2.5 ± 4.3 | +5.3 ± 4.4 | 2.5 / 4.0 |
| closing-time | 61% | +2.8 ± 1.6 | +2.8 ± 1.6 | 2.0 / 3.3 |
| can-opener | 31% | +1.3 ± 3.4 | +4.5 ± 3.3 | 2.4 / 3.8 |
| mage-hunter | 61% | +1.5 ± 4.8 | +3.0 ± 4.9 | 1.8 / 2.8 |
| executioner | 78% | +1.8 ± 1.9 | +4.1 ± 2.0 | 2.3 / 3.8 |
| bloodthirst | 91% | +2.6 ± 2.2 | +4.0 ± 2.1 | 2.5 / 4.0 |
| momentum | 49% | +2.4 ± 2.0 | +3.3 ± 2.1 | 2.2 / 3.5 |
| unshakeable | 61% | +0.9 ± 2.0 | +3.4 ± 2.1 | 1.8 / 2.8 |
| giant-slayer | 82% | +2.7 ± 2.7 | +3.6 ± 2.7 | 2.4 / 3.8 |
| specialist (Sig.) | 100% | +4.5 ± 5.9 | — | 4.0 |
| franchise (Sig.) | 100% | +5.5 ± 5.2 | — | 4.0 |

Raw gains are noisy (400 paired games each, ±3–6 points); the fast engine uses the fitted column. Clear Speed, Triple Threat, Hold the Line, Never Say Die, Call It and Long Game were re-measured over 1,600 games (±2–3 points). At 400 games Hold the Line (+5.3) and Long Game (+7.8) looked strongest; at 1,600 Hold the Line was about 0 and Long Game about +2. Hold the Line, Clear Speed, Triple Threat and Never Say Die were then buffed, and Call It lost its forced Hunt override (it cost more than it gave), to the values in `cards.js`.

**Personal cards** (holder-only effects; ownership via attributes: Execution → Executioner, Positioning → Bloodthirst, Aggression → Momentum, Reflexes / Resilience → Unshakeable, Aim / Decision → Giant Slayer): Executioner (holder reaches 2 kills → execute below 10% HP for the game, cost 2), Bloodthirst (holder died twice → 30% lifesteal for 60 s), Momentum (we draw first blood → holder refunds 30% of cooldowns on each takedown), Unshakeable (we trail by 4+ → holder takes 15% less damage and suffers 50% shorter CC for 60 s; tenacity alone measured +1.6 / +0.4), Giant Slayer (the enemy drafts a Tank → holder +15% damage to Tanks). Measured over 1,600 paired games with milestones on (their own base run); the rows above that are older were measured without milestones. First pass: Executioner at 3 kills +1.1 ± 1.3 (fire 53%), Bloodthirst at 20% +1.4 ± 2.1, Unshakeable 40% / 60 s +1.4 ± 1.9; retuned to the values here. Tenacity barely moves results (Epic +0.4): Unshakeable stays a weak card.

**Cut from CARD_PLAN:** card levels and XP, card drill, awards-based Signatures, transfers and ageing (C5); marks, rally, synergy levels and counter / reveal cards (C3); personality cards (slot 2 uses traits and attributes, so nothing depends on the hidden personality); scouting "card habits" and AI draft bias toward their own triggers (C4); nearest-miss text; gold, vision, towers and Titan triggers (no such things in points mode). Aces never happen in measured games, so there is no ace trigger.

## Career mode

**World.** Five regions with a three-tier pyramid each: 50 top-league clubs, 40 Crown Challengers (Tier 2, 8 per region) and 30 Open Circuit (Amateur, 6 per region), plus a free-agent pool.

| Region | Top league | Clubs | Sponsor market | Grand Convergence spots |
|---|---|---|---|---|
| Eastern Crown | Eastern Crown League | 10 | 1.2 | 4 |
| Jade Delta | Jade Delta League | 14 | 1.1 | 4 |
| Westmark | Westmark League | 10 | 1.0 | 3 |
| Frontier | Frontier Series | 8 | 1.05 | 2 |
| Sunward | Sunward League | 8 | 0.85 | 2 |

**Calendar** (dates are real; the year starts 1 January 2027).

| When | What |
|---|---|
| 5 Jan – Mar | Spring Split: double round robin Bo1 over 9 weeks for every league in every tier (2–3 rounds a weekend) |
| Weeks 10–12 | Spring playoffs (top leagues): top 6, double elimination, matches M1–M9 and a grand final; upper rounds Bo3, upper final, lower final and grand final Bo5 |
| 6 May | Vernal Invitational: 10 clubs (spring champion and runner-up per region), 2 groups of 5 (Bo1), Bo5 semifinals and final |
| 6 Jul | Summer Split, same format, then summer playoffs |
| Week 13 of summer | Promotion play-ins |
| 1 Oct | Grand Convergence: 15 clubs by regional quota, 3 groups of 5 (Bo1), top 8 (group winners, runners-up, best two thirds) to Bo5 quarterfinals, semifinals and final |
| 15 Nov | Season review (rollover screen) |
| 1 Jan | New year, new schedule |

**Promotion and relegation** (summer tables, per region): top-league last ↔ Tier 2 first directly; top-league 2nd-last v Tier 2 second in a Bo5 play-in; Tier 2 last ↔ Open Circuit first directly.

**Prizes** ($k by placement): playoffs 200/100/60/60/30/30; Vernal 500/250/120/120/50/50/25…; Grand Convergence 1500/700/300/300/150×4/60….

**Awards.** Each top-league regular season names an MVP and All-Pro first and second teams (best average rating per role, minimum half the games). Every playoff and international final names a Finals MVP (most game MVPs in the winning team). The season review names a Rookie of the Year per region (first season, age ≤ 21, at least 10 top-league games).

**Season review (16c).** Board verdict on the target, all champions, every promotion and relegation, rookies of the year, expired contracts, retirements and newgens. Then players age, contracts end, 75 newgens (15 per region, 3 per role, aged 15–19) join the pool, retirements happen (30–36), AI clubs rebuild, and old game detail is pruned.

**Board.** Each club's target follows its reputation rank in its league: win a split, reach a final, make the playoffs or avoid relegation (top league); win promotion or finish in the top half (lower tiers). Meeting it gives +5 club reputation, missing it −5.

**Board confidence (0–100, starts at 60).** League series ±1.2, playoff and international series +4/−3, finals +6, scaled for upsets; end of split clamp(4 × places above target, −16, +12); negative cash −2 a week; season target met +8, missed −14; long-term goals ±10. Warnings below 40 and 25. Sacked below 5 at any time, or below 15 after a split or the season review. The board can approve +10% wage cap for the season once (needs 50, costs 10).

**Long-term goals.** Reach the Grand Convergence (top league, 3 years) or reach the top league (2 years), and develop two academy players into starters (2 years).

**Manager.** Reputation (starts 35) moves with season targets (±3), trophies (+5) and goals (+3), and −8 when sacked. History of every spell (club, years, series W-L, trophies, how it ended). Bigger clubs approach a successful manager (Club screen, 14 days to accept). After a sacking the Jobs screen lists vacancies that fit the manager's reputation (21 days each); wait a week for new offers or retire.

**Rivalries.** Finals add 2 rivalry points between the clubs, a 1st-2nd league finish adds 1; −1 a season, max 10. At 3+ the clubs are rivals: +0.3 stakes (Clutch matters more, also in league games), double morale swings, flagged in the draft.

## Players, squad & development

**Profile.** Name, region, age, main and secondary role, the 9 attributes (1–99: Aim, Reflexes, Execution, Decision Making, Positioning, Teamwork, Aggression, Resilience, Clutch), potential, traits, professionalism (1–20), morale, condition (20–100), form (last 5 ratings), champion mastery per champion (S ≥ 1.08, A ≥ 0.98, B ≥ 0.85, else C), wage and contract end.

**Traits** modify attributes in the engine: Aggressive, Tilts when behind, Clutch performer, Shotcaller, Sharpshooter (+8 Aim), Team player, Hot-headed, Ice cold, Inconsistent, Professional (grows faster).

**Squad.** Up to 10 first-team and 10 academy players, at least 5 first-team. Starters play at 95% in their secondary role and 88% elsewhere; morale and condition scale attributes. Promote and demote between academy and first team.

**Condition.** Each training session costs condition by drill; weekends and Rest restore it; every game costs 7. Professionalism scales the fatigue.

**Training (08).** A weekly plan of 10 sessions (Mon–Fri, AM/PM) chosen from nine drills, each with attributes it trains and a fatigue cost: Aim drills (Aim, Execution), Mechanics (Execution, Reflexes), Teamfight scrim (Teamwork, Positioning), VOD review (Decision, Positioning), Macro rotations (Decision, Teamwork), Mental coaching (Resilience, Clutch), Skirmish drills (Aggression, Reflexes), Champion practice, Rest. Each player can also have one focus: an attribute (2 points) or a champion (1 point) from 15 focus points. The screen shows a 7-day condition forecast per player.

**Development** (weekly). Growth depends on age (fast to 21, slow to 25, flat to 28, then decline), the gap to potential, the training or academy facility, the development coach, professionalism, starting, the week's drills, the focus, and personality (lazy −15%; academy players grow 15% faster with a mentor in the first team).

**Comfort pool and meta fit.** Champions at A or S mastery form the comfort pool; meta fit compares it with the current patch. Both show on the player panel.

## People

**Personality** (hidden): one or two of ambitious, loyal, volatile, mentor, lazy, leader. Revealed by a scouting report, or after 60 days together (from the player's or the manager's arrival, whichever is later) in one weekly staff report.

| Personality | Effect |
|---|---|
| Ambitious | Asks more (−0.1 likelihood at clubs under 55 reputation); loses morale faster on the bench; likes demanding talks; promises count more |
| Loyal | +0.1 likelihood to re-sign; patient on the bench |
| Volatile | 6% weekly clash chance (others 0.8%); 1.5× morale swings; hates demanding talks |
| Mentor | Academy players at the club develop 15% faster |
| Lazy | Develops 15% slower; motivating talks work less |
| Leader | Chemistry grows 30% faster; halves the morale hit of a loss |

**Chemistry.** A value per pair of players (neutral 50; a new signing starts at 35 with everyone). The five who play a game together gain 0.5 per pair (0.9 on a win). Clashes cost 15, a broken promise 8. Team chemistry (average over the starters) adds (chem − 50)/10 to Teamwork and (chem − 50)/25 to Decision Making in the engine. Shown per pair on the player panel and in the opponent scouting panel.

**Status and promises.** Each first-team player expects a status from their overall rank in the squad: star (top 2), first-team regular (3–5), rotation (6–8), prospect. Expected starters lose morale each week on the bench. After three weeks a player asks to talk (inbox): promise a starting spot, tell them to fight for it, or transfer-list them. Contracts (renewals and transfers) can include promises ("You will start", "We will compete for a title"), which raise the likelihood (+0.06 each, +0.1 for ambitious players). A start promise is broken after four weeks on the bench; a title promise is broken by a best finish below 2nd. Broken promises cost morale and chemistry and make the player want to leave (−0.3 to re-sign).

**Conversations.** Inbox messages with choices (category Squad): playing time, broken promises (put them back in the lineup or list them), clashes between two players (back one, or fine both).

**Team talks.** Once per game, after the draft: stay calm, believe in yourselves, or I expect more. The effect on each starter's morale depends on the series score and personality; each reacts fired up, focused, unmoved or rattled.

## Transfers, contracts & finances

**Wage cap** covers first team and academy: $1M (top league), $500k (Tier 2), $250k (Open Circuit).

**Contracts (18, 18b).** Renew with a drawer: length 1–3 years, wage, signing bonus, promises and a live likelihood meter. Likelihood rises with the offer against the player's ask (higher for low-reputation clubs), morale and length preferences, and falls when a good player isn't starting. Release costs half the remaining wages. Transfer-list a player to draw more and cheaper bids.

**Scouting.** $1k and 7–15 days depending on the analytics room and analyst. Unscouted players show ability and potential ranges that narrow day by day; a report with the personality lands in the inbox.

**Scrims.** Pick a weekly scrim partner on Tactics (clubs from 25 below to 15 above your reputation). Every Monday the starters gain mastery on their three best champions for their role (0.6 points, up to 1.5× against stronger partners), chemistry grows, condition drops 3, and the partner's comfort picks show in the draft scouting panel for 60 days. A level-4 analytics room reveals every opponent's comfort picks.

**Negotiation (10b).** Step 1, the fee: the club accepts at ≥92% of its asking price, counters above 70%, otherwise rejects; three attempts; a bench player can be offered as part-exchange (trade). Step 2, the player's terms with the same likelihood model. Free agents skip step 1.

**AI market.** AI clubs bid for the manager's players any time (listed players far more often); offers expire after 14 days. AI clubs sign free agents for their weakest role, keep academies of prospects, and shed pricey bench players when over the cap.

**Club (11).** Cash and a monthly ledger (sponsors, wages, staff, transfers, bonuses, prizes, facilities, scouting, compensation). Four facilities, levels 1–5, one build at a time: training centre, analytics room, academy, media studio. Staff: head coach, strategy coach (both feed the engine's coach rating), development coach, analyst; candidates refresh weekly. Sponsors pay weekly; new offers arrive in the inbox with a 7-day window.

## News

*Built in v0.6 (`js/news.js`).* The world feels alive outside your club: short written pieces about what happened, built only from data the save records (clubs, players, scores, fees). No filler.

**Story types** (trigger → example headline):

| Type | Trigger | Example |
|---|---|---|
| Result | Top-league or international series: a reverse sweep (0-2 to 3-2), or an upset (loser's reputation ≥ 15 higher in a Bo3+, ≥ 25 in a Bo1) | "Northgate stun the league leaders 2-1" |
| Streak | A club reaches 5, 8, 11… series wins or losses in a row, or ends a run of 5+ | "Brightwater make it 5 in a row" |
| Title race | Top league with about two weeks left and the top two within one win (once a split) | "One win separates the top two" |
| Title | Champions of a top-league playoff or an international event | "Brightwater win the Grand Convergence" |
| International | An international event begins | "The Vernal Invitational begins" |
| Transfer | A fee in the top 10% of recent fees, or a free agent of 70+ overall signing | "Big money: Kaito joins Redmarsh" |
| Milestone | A top-league player passes 500/1,000/1,500/2,000 career kills or 100/200/300 games | "Vex reaches 1,000 career kills" |
| Patch | A new patch (headline names the biggest nerf; body lists every change) | "Patch 27.2: Ironclad toned down" |
| Award | Split MVP | "Mira named Spring Split MVP" |
| Your club | First board warning; a broken "you will start" promise | "Pressure grows at Redmarsh" |

**Writing.** 2–5 templates per type, picked at random. Headlines aim for under 60 characters.

**Ranking and volume.** Systems queue stories during the week; `newsWeekly` (end of the weekly tick, after `weeklyDigest`) adds title races and milestones, then ranks by importance: base value per type, +50 for your club, +20 for your league, +15 for a rivalry, +15 for a final. Only the top story of each type survives a week (your club's stories always do). The top 3 go to the inbox (News category, with club and player links); all go to the News card on Home (latest 20). About 7 stories a week reach the feed.

**Media pressure.** Each bad-news story led by your club costs 0.5 board confidence.

**Data.** `W.news` holds `{id, year, day, type, imp, headline, body, clubs, players, tone}`; kept for the current and previous season, at most 60. `W.newsQ` is the week's queue, `t.streak` the series streak (+ wins, − losses), `p.ms` the last milestone reported, `W.fees` the recent fees. All are created lazily, so no save migration. System mails about your own club (results, qualification, signings) stay as they were.

**Not built:** AI manager changes (AI clubs have no managers), quotes from players.

## Statistics

**Per game:** score and its split (kill points, objective points), kills, point captures, first blood, length and how the game ended (score or clock); per player K/D/A (deaths with no killer count, but none occurred in 2,400 measured games), level, damage, damage taken, healing, seconds on capture points (`obj`), damage share and a 1–10 rating; plus the draft and a score timeline. Rating is measured against the role's average line (`ROLE_MEANS` in `engine.ts`, per minute): 6 + 0.3 × (K − expected) + 0.12 × (A − expected) − 0.3 × (D − expected) + 6 × (damage share − the role's share) + (healing − expected)/900 + 2 × (minutes on points − expected), +0.5 for a win, −0.5 for a loss, plus a small per-role offset that centres each role on 6; clamped to 1–10. Role means land at 5.87–6.15 and every role wins player of the game (Top 12%, the others 21–23%); before, carries averaged 7.8 and took 87% of MVPs. The MVP is the best rating on the winning side. `sd60` is the score difference at 1:00.

**Measured per-minute means** (full engine, per player): Top 0.67 K / 1.11 D / 1.91 A, 1,440 damage, 9.6 s on points; Jungle 0.56 / 0.97 / 2.22, 1,200, 20.5 s; Mid 0.88 / 1.12 / 2.22, 1,630, 15.3 s; Carry 1.93 / 0.60 / 2.10, 2,820, 12.5 s; Support 0.72 / 0.95 / 2.15, 1,220, 6.1 s, 227 healing.

**Stats centre (14).** Scope bar: Season, Career, Archive (any past year), Exhibitions (empty for now), This series (only the games of your latest series). Player rows (K/D/A, KDA, point seconds a minute, damage a minute, rating, MVPs) show the role played most and the club of the latest game in scope. Team rows: kills and deaths a game, captures a game, first-blood %, length, score and score difference a game. Champion K/D/A comes only from games with player lines (top leagues, internationals and your own games); otherwise it shows –. Filters: region, tier, role, minimum games. Every table sorts by any column and exports to CSV.

**Replays and highlights.** Full-engine games store their MatchConfig, so a replay re-simulates them. Highlights get a one-line title: multi-kills with context ("…including a shutdown", "…to force an ace", "…to take a point", "…in the opening minute"), solo outplays, aces ("Ace to close the game"), shutdowns, solo first bloods and comebacks from 6+ points down. Every Monday the inbox gets the Top 5 plays of the week.

**Result mails.** Each game of a finished series gets a recap (winner, score, length, peak score lead, first blood, key moment, MVP line).

**Award leaders** include KDA, damage share, point seconds a minute, champion pool and the best rookie.

## UI

The screens below describe the v0.6 UI. It still expects the old engine (lane map, gold, items, phase plans, Fearless) and is rewritten in the next phase.

Visual system from the design handoff (`tokens.css`, `base.css`): broadcast style, radius 0, gold primary action with a slant cut, blue and red only for sides, Saira Semi Condensed / Geist / Geist Mono. Pixel portraits and champion sprites are generated on a canvas; club crests are SVG shields in the club colour.

**Shell.** Top bar with 8 tabs (Home, Squad, Training, Tactics, Transfers, Competitions, Stats, Club), inbox with unread badge, settings, the date and phase, and Continue (or Play match / Season review) with a sim menu. Sub-tabs: Squad (Players, Lineup, Contracts, Academy), Transfers (Market, Shortlist, Offers), Competitions (League, Bracket, International, Schedule, Awards, Meta), Stats (Overview, Players, Champions, Teams, Games, Replays, Economy). With no club the shell shows only the Jobs screen. Hash routes, so back and forward work.

**Focused modes.** Main menu with save slots, 2-step new career (region, then club), draft, live match, post-game, match report, season review.

| Screen | Contents |
|---|---|
| Home (03) | Next match hero (crests, form, win chance, gold-diff / first-blood / length comparison), Needs your call (offers, expiring contracts, fatigue, cap, cash), squad readiness, league table, this week |
| Live (05) | Player rails (champion, level, K/D/A, CS, teamfight role, HP, ult ready, respawn timer), objectives, map, gold-lead graph, feed, plan change queued to the next reset, pause/1×/2×/4×, skip, click to highlight |
| Post-game (05b) | Winner, player of the game with the reason, team comparison bars, gold graph, both stat tables, report link |
| League (19) | All three tiers of a region with playoff, promotion, play-in and relegation markers |
| Bracket (06) | Upper and lower bracket laid out as in the mockup: match cards (seed, crest, score; date, "Live · Game N" or Final above), elbow connectors along winners' paths, your club's cards and paths in gold, placeholders ("Winner of A / B", "Winner above", "Lower final winner"), click a played series for its report. International knockouts use the same cards in a tree layout |
| International (20) | Vernal / Convergence groups and knockouts |
| Schedule (12) | Month grid with your fixtures and results, events, series counts; upcoming list |
| Awards (07) | One event at a time (year + region split or international): champions hero with final score and roster, Finals MVP and Season/Event MVP with the reason, All-Pro (or All-Event) first team with club and signature champion, stat leaders (KDA, damage share, CS/min, champion pool, rookie). Before the final: placeholders and the live MVP race. Roll of honour, Finals MVPs and Rookies of the Year under their own entry |
| Inbox (17) | Categories (offers, scouting, news, squad, highlights, board), reader with accept/reject for offers, conversation choices, highlight links, archive |
| Club (11) | Finances, facilities, staff, sponsors, Board card (confidence, goals, log, budget request), Manager card (reputation, approaches, history) |
| Jobs | Out of work: offers that fit the manager's reputation, take a job, wait a week, retire |
| Settings (13) | Live speed, sim detail, pause triggers, confirm Continue, autosave, save to slot, download save (.json) |

**States.** Empty states for every list and table, a screen-error state, save error, legacy save found, unreadable save (falls back to the backup), offer rejected / countered, offer expired, scouting in progress, no fixture, playoffs and internationals not started. Checked at 1280 × 800 with no page scroll (long tables scroll inside their card).

## Technical architecture

Plain JavaScript ES modules plus `js/engine.ts`, which imports the TypeScript sim; Node runs it through tsx, and the browser build is still to come (the UI is not yet ported to the new engine).

**Saves.** IndexedDB with three slots plus an autosave (weekly or daily, and after every multi-day sim); each write keeps the previous version as a `.bak`. Saves are gzip-compressed with `CompressionStream` (about 5 MB of JSON per year of history becomes about 1 MB). No localStorage fallback (v0.5): saves can be downloaded as .json from Settings and imported from the main menu instead. `SAVE_VERSION` 4 with a migration chain (v0.4 saves gain the new champions' mastery, drafting plans, the board, the manager and goals; patches, personalities and chemistry fill in lazily); v0.3 saves can't be converted and get a clean "start new" prompt. Save failures open a modal: Try again, Download save, Keep playing.

**Save size.** Per-game player lines are kept for top-league, international and the manager's games of the current season; lower-tier games keep results only. Series detail and games of earlier seasons are pruned at the review; competition results, tables, awards and per-player aggregates stay. Retired players without awards are dropped.

| Module | Responsibility |
|---|---|
| `js/data.js` | Champions, roles, attributes and weights, plan presets, regions, tiers, name tables |
| `js/engine.ts` | Adapter to the Lanebound sim: MatchConfig from lineups, tactics, kit patch, summary |
| `js/fastsim.js` | Statistical engine and `runPayload` (fast or full) |
| `js/draft.js` | 12-step order, AI bans and picks |
| `js/world.js` | World generation, players, clubs, staff, facilities, inbox, auto-starters |
| `js/club.js` | Training, condition, development, contracts, scouting, negotiation, AI market, finances, newgens, retirement |
| `js/calendar.js` | Dated schedule, leagues, brackets, internationals, promotion, games, awards, sim controls, season review |
| `js/stats.js` | Stats-centre scopes, aggregates and CSV |
| `js/meta.js` | Patches, tier list, comfort pool, meta fit |
| `js/board.js` | Board confidence, sacking, job market, manager reputation and history, budget, goals |
| `js/people.js` | Personalities, chemistry, status and promises, conversations, team talks, rivalries |
| `js/scrims.js` | Scrims and the opponent scouting report |
| `js/highlights.js` | Highlight detection and the weekly Top 5 digest |
| `js/cards.js` | Tactic Cards: definitions, ownership from standing, loadout rules, AI loadouts, measured stats, sim specs, rules text (runtime `sim/cards.ts`) |
| `js/news.js` | News stories: triggers, templates, weekly ranking, inbox and Home feed |
| `js/career.js` | Facade re-exporting the career modules |
| `js/worker.js` | Web Worker running full-engine jobs |
| `js/ui/*.js` | `app` (shell, router, menu, new career, settings, inbox, review), `screens` (club side), `comps` (competitions, stats), `matchday` (draft, live, post-game, report), `render` (canvas), `dom`, `state`, `store` |

**Testing.** Run with `npm run manager:test` (tsx resolves the sim's TypeScript). `test/engine.test.mjs` (champion table matches the sim, draft, determinism, replay from the config, bookkeeping, skill matters), `test/fastsim.test.mjs` (fast vs full win rates, same summary shape), `test/fit.mjs` (calibration, not a test), `node test/news.test.mjs` (one season: story types, inbox cap, no broken text), `node test/people.test.mjs` (chemistry growth and engine effect, personalities, promises and conversations, talks, rivalries), `test/stats.test.mjs` (stat invariants on both engines: kills, deaths, score split, captures, score timeline, games and wins per player and team, series scores, champion totals, the series scope), `test/cards.test.mjs` (ownership, loadout rules, Fearless cards, AI loadouts, Classic mode, fast-engine card edge, a full-engine card firing), `test/card-fit.mjs` (card measurements, not a test), `node test/career.test.mjs [years]` (full seasons on the fast engine: every competition completes with the right sizes, promotion keeps tier sizes, rosters stay legal, stats centre and CSV work, save size). A year simulates in about 1.4 s in Node. The UI is checked in headless Chrome with no console errors.

## Roadmap / open work

Everything from P0–P8 (except P7), D0–D5 and News (v0.6) is built. What is left, in suggested order:

| # | Item | Size | Why |
|---|---|---|---|
| 1 | Scouting report feeds the analyst's ban suggestions | S | Today the report is only a panel in the draft |
| 2 | Exhibitions: friendly series on free days, with their own stats scope | S | Fills the empty Exhibitions scope |
| 3 | AI clubs use team talks and scrims | S | Fairness: today only the user benefits |
| 4 | Media days on the schedule (pre-season and before finals): pick answers that move morale and board confidence | M | Ties into People and Career stakes |
| 5 | P7 Ranked solo queue | L | Parked: little value until the rest is deep enough |

Each item ends with passing tests, a headless-Chrome run with no console errors, a GDD update, and a `SAVE_VERSION` bump plus migration if the save shape changes.

## Implementation status & changelog

| Feature | Status | Notes |
|---|---|---|
| P0 Foundation: design system, 8-tab shell, router, main menu, settings, IndexedDB saves, sprites, crests | Done | `tokens.css`, `base.css`, `style.css`, `js/ui/app.js`, `store.js`, `dom.js` |
| P1 Engine v2: arena map, 9 attributes, items, phase plans, teamfight roles, event stream, fast engine | Done | 40 champions with kits, traits and synergy added in v0.5 |
| P2 World v2: 5 regions, 3-tier pyramid, dated calendar, double-elim playoffs, Vernal and Convergence, promotion, awards, review | Done | `js/calendar.js` |
| P3 Squad, club and economy | Done | `js/club.js`; lane swaps use selects rather than drag |
| P4 Draft v2 | Done | Fearless as a setting; drafting plans in v0.5 |
| P5 Live view, post-game, stats centre, match report, dashboard | Done | |
| P6 Replays and highlights | Done (v0.5) | Replays only for full-engine games |
| P7 Ranked solo queue | Not started | |
| P8 Inbox categories and archive, designed states, 1280 × 800 | Done | Exhibitions scope is an empty state until exhibitions exist |
| D1 Champions: 40 champions, ultimates, passives, traits, comps, smart casting, drafting plans, balance | Done (v0.5) | |
| D2 Meta: patches, tier list, comfort pool, meta fit | Done (v0.5) | |
| D3 Career stakes: board confidence, sacking, jobs, manager reputation, goals, budget | Done (v0.5) | |
| D4 People: personalities, chemistry, promises, conversations, team talks, rivalries | Done (v0.5) | |
| D5 Depth: scrims, scouting report, attribute rebalance, replays, save import/export | Done (v0.5) | |

| Date | Version | Change |
|---|---|---|
| 2026-11-26 | v0.9 | Milestones (streaks, shutdowns, anchor, sweeps), five personal-effect cards, rarity-scaled card rest; fast engine refitted with milestones and patches (`npm run manager:refit`), ratings re-centred, sim detail default Top leagues with an Every game option |
| 2026-11-25 | v0.8 | Tactic Cards end to end: sim runtime behind `MatchConfig.cards` (trigger and effect tables, `card_fire`), 26 cards with ownership from role, traits, attributes and overall, loadout rules (3 cards, 6 Focus, 2 per player, Fearless within a series), AI loadouts, Classic mode, measured per-card effects feeding the fast engine, card select step, draft card status, reveal banner, feed lines and post-game card list |
| 2026-11-25 | v0.7 | Career logic on the Lanebound sim: `js/engine.ts` adapter, six sim attributes plus Aggression, Resilience and Clutch, the 14 sim champions, 12-step draft (Fearless removed), plans as sim tactics, patches as a kit patch, fast engine refitted on the sim. EMC lane engine, map, items and balance test removed. `SAVE_VERSION` 5 (no migration) |
| 2026-11-20 | v0.6.1 | Tactic Cards groundwork (CARD_PLAN.md): `js/cards.js` with 6 sample cards and rules text generated from data; `js/ui/cards.js` pixel-art card renderer (full, hand and foil states, rarity borders); dev gallery at `#/dev/cards`. No gameplay effect yet |
| 2026-11-20 | v0.6 | News: `js/news.js` with ten story types (results, streaks, title races, titles, internationals, transfers, milestones, patches, awards, your club), templates, weekly ranking (top 3 to the inbox, one per type), News card on Home, club and player links in the reader, media pressure on board confidence; `test/news.test.mjs` |
| 2026-11-20 | v0.5.2 | Bracket redrawn to mockup 06 (positioned cards, connectors, gold path); highlight titles with context; Top 5 digest to mockup 17b; game recaps and gold graphs in result mails and the report |
| 2026-11-20 | v0.5.1 | Awards screen rebuilt to design 07 and state-empty-awards; awards snapshot club, signature champion, MVP reasons, final score, champion roster and stat leaders; internationals name an Event MVP and All-Event team |
| 2026-11-20 | v0.5 | D5: scrims, opponent scouting panel, attribute rebalance (every attribute matters; mid roams removed; fast engine refitted), replays and highlights with weekly Top 5, save import/export, localStorage fallback removed, `SAVE_VERSION` 4 migration |
| 2026-11-20 | v0.5 | D4 People: hidden personalities, pair chemistry feeding Teamwork and Decision Making, expected status, contract promises, inbox conversations with choices, team talks, rivalries |
| 2026-11-20 | v0.5 | D3 Career stakes: board confidence, warnings and sacking, Jobs screen, approaches, manager reputation and history, long-term goals, budget request; fix: no approach in the week of a sacking |
| 2026-11-20 | v0.5 | D2 Meta: three patches a season from presence and win rate, patch notes, Meta tab tier list, patch filter in champion stats, comfort pool and meta fit, AI practises the meta |
| 2026-11-20 | v0.5 | D1 Champions: 40 champions (16 new), ultimates at level 6, passives, 8 traits, composition tags and counter triangle, smart casting, AI drafting plans, analyst reasons, Fearless on the full 20 steps, balance table |
| 2026-11-20 | v0.4.1 | D0 stats correctness: This-series scope, camp CS, champion KDA only from games with player lines, final team gold, executions in team deaths and in the fast engine, role played and club at match time, stats test |
| 2026-11-20 | v0.4 | New UI on the design system: shell, home, squad, training, tactics, transfers, negotiation, club, competitions, stats centre, inbox, settings, draft v2, live view, post-game, match report, season review |
| 2026-11-20 | v0.4 | Career v2: 5 regions × 3 tiers (120 clubs), dated calendar, double-elimination playoffs, Vernal Invitational, Grand Convergence, promotion and relegation, Rookie of the Year and All-Pro 2nd team |
| 2026-11-20 | v0.4 | Club and economy: 10+10 squads, wage cap, contracts with likelihood, scouting, two-step negotiation with trades, AI offers with expiry, training plan and focus points, condition, traits, facilities, staff, sponsors, ledger, newgens |
| 2026-11-20 | v0.4 | Saves: IndexedDB slots, autosave, backups, gzip, migration chain, save-error modal |
| 2026-11-19 | v0.4 | Engine v2: arena map, 9 attributes, item shop, phase plans queued to the next reset, teamfight roles, event stream, fast statistical engine; Fearless draft logic |
| 2026-11-19 | v0.3 | Full UI, transfers and finances, career mode with 4 regions |
| 2026-11-19 | v0.2 | 5v5 engine, 24 champions, 20-step draft, diagonal map |
| 2026-11-19 | v0.1 | GDD created; 3v3 arena prototype |
