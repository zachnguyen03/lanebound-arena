# Lanebreak Manager — Game Design Document

Updated 2026-11-20 (v0.6). This file is updated every time a feature lands. The parity plan against the LEM feature summary is in `PLAN.md`.

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

The engine advances in fixed ticks of 0.1 s of game time. Each champion re-plans on its own decision tick and executes its current intent on every tick in between. The same seed and inputs always replay the same match.

**Decision tick.** The interval shrinks with Decision Making. On each tick the champion scores every intent (lane, jungle, gank, fight, objective, push, group, defend, retreat, recall) and takes the best. Scores combine game state with the team's current-phase plan, plus noise that also shrinks with Decision Making. Every 2 s a shot-caller may call an objective or a push.

**Phases.** Early runs 0:00–3:00, mid 3:00–6:00, late from 6:00. A game is capped at 10:00, then decided by structures, kills, then gold. About 75% of games end on a Core kill, average length 8:30–8:50, about 16–18 kills.

**Combat.** Auto-attacks roll hit chance from Mechanics. Each champion has a skill with a cooldown, an ultimate that unlocks at level 6, and a passive (see the champion table). Damage scales with level, items, Shrine stacks, Mechanics × champion mastery × the day's form roll, and the multipliers below.

**Smart casting.** Abilities declare when they are worth using (engage, area, burst, execute, save, buff). Decision Making judges the moment: on a good moment the cast fires with chance 0.3 + Decision/140; on a bad one it misfires only with chance (100 − Decision)/8000. Weak Mechanics fumble a cast (40% strength). Crowd-control skills are held for a priority target with chance Decision/110. Clutch boosts ultimate damage by (Clutch − 50)/400 × (1 + stakes). About 15 ultimates a game, 93% on good moments.

**Compositions.** Each side's champions give trait bonuses at 2/3/4 champions sharing a trait, and a composition tag (needs 2+ champions with the same tag, otherwise mixed). Counter triangle: engage beats poke, poke beats protect, protect beats engage, for +8% damage (wins 53–59% between equal teams). A pick comp gets +4% against isolated targets; a split comp +6% against structures.

**Attributes in the engine (9).** Rebalanced in v0.5 so that Mechanics no longer decides games alone. Measured on the full engine with a whole team +15 in one attribute (60 → 75), 800 games each: Mechanics 65%, Positioning 60%, Vision 54–60%, Decision Making 59%, Laning 54–58%, Teamwork 54–60%, Aggression 53%, Resilience and Clutch about 50% (both situational). Before v0.5 only Mechanics (71%) moved results.

| Attribute | Effect |
|---|---|
| Decision Making | Decision interval and quality (less noise); smart casting; +(D − 50)/500 damage to champions (focus fire); coach rating adds (coach − 10) × 0.6 |
| Mechanics | Damage × (0.83 + M/300), hit chance, ability fumbles; multiplied by champion mastery |
| Laning | +(L − 50)/85 damage to champions in the laning phase; minion damage 1.3 + L/100 (farming) |
| Positioning | Takes (P − 50)/255 less damage; ranged champions kite and are harder to reach |
| Vision | Damage edge of (team vision gap)/290 in fights; spots roams; lowers gank success against the player; boosts objective damage; vision score about 2 per minute |
| Aggression | +(A − 50)/425 damage in the laning phase; retreat threshold and engage range (over-extends more) |
| Teamwork | +(T − 50)/190 damage and (T − 50)/300 less damage taken with 2+ allies near |
| Resilience | Narrows the form roll (spread 0.13 − 0.0008 × Resilience); reduces the tilt penalty when 3+ kills behind |
| Clutch | Extra damage in the late phase and on ultimates, scaled by the game's stakes (playoffs, finals, deciders, rivalries) |

Mids no longer roam to gank (it left the lane and lost games); junglers do. Team chemistry adds to Teamwork and Decision Making (see People).

**Teamfight roles.** Each player has a role (Frontline, Initiator, Midline, Backline, Assassin), defaulting from the champion class and settable on Lineup or Tactics. It changes target choice in fights; a Frontline also takes 8% less damage with allies near.

**Items.** Champions bank gold and shop at the fountain on respawn, on recall or while passing through. Each class buys a fixed 6-item build from 12 items (blade, vest, quiver, tome, bulwark, reaver, storm, staff, edge, censer, aegis, crown) giving fractional attack, HP, attack speed, cooldown reduction, damage reduction, lifesteal and heal amp. A recall intent fires when the bank covers the next item. About 3 items per champion by game end.

**Economy.** Last hit 20 gold (1 CS), camp 60 (3 CS), champion kill 300 (assists share 150), tower 150 to each teammate, passive 2 gold/s. Levels 1–12. Respawn 6 s + 1.5 s per level + 1 s per minute.

**Objectives.** The Titan (top pit) spawns at 4:00 and gives +20% damage for 60 s. The Shrine (bottom pit) spawns at 2:00 and gives a permanent +5% stat stack, up to four.

**Game plan** (replaces the old four tactic selects). Per phase: posture (aggressive / balanced / defensive) and style (teamfight / split push / macro). Plus target focus (nearest / weakest / carries), jungle focus (any / top / mid / bot), objective priority (Titan / Shrine / towers) and adapt-when-behind. Presets: Standard, Early aggression, Scale and teamfight, Split map, Objective control. A change made during a live game is queued and applies at the next reset: when the whole team is back within 12 units of the fountain, or after 60 s. AI coaches adapt at half time when behind or far ahead.

**Event stream.** Every game records kills (killer, victim, assists, position, first blood, shutdown, streak), deaths, Titan, Shrine, towers, Core and aces; a gold timeline and all ten positions plus structure states every 5 s; and every plan change. This feeds the live feed, gold graph, post-game, match report and map-at-minute view.

**Fast engine** (`js/fastsim.js`). Background games use a statistical model with the same output shape: a logistic on the effective-strength gap (logit = 0.067·d + 0.00012·d³, refitted after the attribute rebalance), plus +2.6 strength for the side whose composition counters the other and the patch's champion changes, then stat lines drawn from per-role per-minute means measured on the full engine, a gold random walk ending at the final difference, and generated kill and objective events. With a uniform attribute gap of 4/8/16 the full engine wins 59/63/86% and the fast engine 56/64/83% (500–1,500 games each). The manager's games always use the full engine. Setting "Full engine for top leagues" runs top-league and international AI games on the full engine in a Web Worker pool.

## Map & movement

The arena (design handoff §6) is 108 × 62 units, Blue on the left and Red on the right, mirrored left-right and top-bottom.

- **Lanes.** Octagonal top and bottom lanes, a straight mid lane through a central plaza ring.
- **Terrain.** Flat-top hexagon clusters: one big and two small per quarter.
- **Structures per side.** Two towers per lane (outer 1,500 HP, inner 2,000 HP), a base tower (2,200 HP) and a hex Core (2,500 HP). Outer before inner; an inner before the base tower; the base tower before the Core.
- **Camps** two per quarter. Titan pit top-centre, Shrine pit bottom-centre.
- **Movement.** A 1-unit blocked grid and a waypoint graph (nodes every 4 units, all-pairs next hops). Champions walk straight with line of sight, otherwise skip ahead along the route.

The renderer draws hex Cores, square towers (⊠ when destroyed), pits with a gold diamond and respawn timer, champion dots with a side ring, HP arc and initial, 2-second movement trails, dashed rings at base for dead champions, and kill ✕ markers that fade over 8 s.

## 5v5 format, roles & champions

One player per role: Top, Jungle, Mid, Carry, Support. A champion outside its listed roles plays at 85% mastery. 40 champions (Top 12, Jungle 12, Mid 11, Carry 9, Support 13 counting secondary roles). Each has a skill, an ultimate (level 6), a passive, one or two traits and a composition tag. The 16 added in v0.5 use declarative effect lists (damage, execute, stun, slow, pull, shield, heal, buff, zone, untargetable) aimed at a target, self, the lowest foe or ally, or the biggest cluster.

**Traits** (bonus at 2/3/4 champions): Vanguard max HP 5/9/14%, Brawler damage reduction 4/7/10%, Arcane ability damage 8/14/20%, Sharpshooter attack speed 6/10/15%, Shadow attack 5/9/13%, Warden heal and shield power 12/20/30%, Wild move speed 4/7/10% plus lifesteal, Mystic cooldown reduction 6/10/14%. Enchanters also get +25% heal power.

**Passives** (12): thick hide, lifesteal, spellweave, guardian, swift, giant, executioner, siege, opener, hunter, bloodlust, farmer.

| Champion | Roles | Class | Tag | Traits | Skill | Ultimate (level 6) | Passive |
|---|---|---|---|---|---|---|---|
| Bulwark | Top, Support | Tank | protect | Vanguard, Warden | Shield self, taunt nearby foes | Iron Bastion: Shield all nearby allies | Thick hide: 6% damage reduction |
| Vanguard | Top | Bruiser | engage | Brawler, Vanguard | Hit all adjacent foes, heal per champion hit | Charge: Dash in, stun and hit a group | Bloodlust: up to +20% damage as own HP drops |
| Duelist | Top, Mid | Fighter | split | Brawler, Shadow | Dash onto target, heavy hit | Riposte: +30% attack, 40% damage reduction for 3s | Opener: +20% damage to targets above 80% HP |
| Reaper | Top, Jungle | Bruiser | split | Shadow, Wild | Execute that scales with missing HP | Reap: Execute: damage scales hard with missing HP | Executioner: +12% damage to champions under 35% HP |
| Stalker | Jungle | Assassin | pick | Shadow, Wild | Blink to the weakest foe, burst | Vanish: Turn untargetable, strike the weakest foe | Executioner: +12% damage to champions under 35% HP |
| Ravager | Jungle | Fighter | engage | Wild, Brawler | +50% attack speed for 4s | Bloodrage: +20% attack, +40% attack speed for 5s | Bloodthirst: 8% lifesteal |
| Thornback | Jungle, Support | Tank | engage | Vanguard, Wild | Stun nearby foes for 1s | Quake: Leap into a group and stun it | Giant: 8% max HP |
| Phantom | Mid, Jungle | Assassin | pick | Shadow, Arcane | Dash, burst, 1s untargetable | Blade Storm: Dash into a group, heavy area damage | Swift: 8% move speed |
| Hexer | Mid | Mage | poke | Arcane, Mystic | Area burst around target | Overload: Massive area burst | Spellweave: 10% cooldown reduction |
| Stormcaller | Mid, Support | Mage | poke | Arcane, Warden | Area damage and 40% slow | Eye of the Storm: Storm zone: damage and slow for 5s | Opener: +20% damage to targets above 80% HP |
| Ranger | Carry | Marksman | poke | Sharpshooter, Wild | Empowered shot | Rain of Arrows: Area damage and slow | Farmer: +25% damage to minions |
| Longbow | Carry | Marksman | poke | Sharpshooter, Shadow | Long-range shot on lowest-HP foe | Skyshot: Map-wide shot on the weakest foe | Opener: +20% damage to targets above 80% HP |
| Blaster | Carry, Mid | Marksman | poke | Sharpshooter, Arcane | Splash shot around target | Rocket: Explosive rocket | Siege: +30% damage to structures |
| Mender | Support | Enchanter | protect | Warden, Mystic | Heal the most-wounded ally | Sanctuary: Big heal on all nearby allies | Guardian: heals and shields 20% stronger |
| Warden | Support | Tank | engage | Vanguard, Warden | Stun target, shield nearest ally | Lockdown: Stun a group for 1.5s | Thick hide: 6% damage reduction |
| Oracle | Support | Enchanter | protect | Warden, Arcane | Shield all nearby allies | Foresight: Shield and speed up nearby allies | Guardian: heals and shields 20% stronger |
| Ironclad | Top | Tank | engage | Vanguard, Brawler | Take 40% less damage for 3s, taunt adjacent foes | Juggernaut: Charge a target, stun it, 40% damage reduction | Giant: 8% max HP |
| Berserker | Top, Jungle | Fighter | split | Brawler, Wild | Leap onto a distant target, 40% slow | Undying Rage: Heal, +30% attack and attack speed | Bloodlust: up to +20% damage as own HP drops |
| Spellblade | Mid, Top | Fighter | pick | Arcane, Shadow | Blink behind target, heavy strike | Arc Slash: Dash through a group | Spellweave: 10% cooldown reduction |
| Wraith | Jungle | Assassin | pick | Shadow, Mystic | Pounce on a weak foe, short stun | Haunt: Dive the weakest foe: execute and stun | Executioner: +12% damage to champions under 35% HP |
| Pyromancer | Mid | Mage | poke | Arcane, Mystic | Set target ablaze: damage over 4s | Firestorm: Burning zone for 4s | Spellweave: 10% cooldown reduction |
| Gunslinger | Carry | Marksman | pick | Sharpshooter, Shadow | Shoot the three nearest foes | Dead or Alive: Long shot that executes | Swift: 8% move speed |
| Trapper | Carry, Support | Marksman | pick | Sharpshooter, Warden | Root target for 1.5s, bonus damage | Net Field: Root a group for 1s | Opener: +20% damage to targets above 80% HP |
| Chanter | Support | Enchanter | protect | Warden, Mystic | Allies heal and gain 30% move and attack speed | Anthem: Allies gain attack, attack and move speed | Guardian: heals and shields 20% stronger |
| Bastion | Top, Support | Tank | engage | Vanguard, Brawler | Rampart: Shield self, slow nearby foes | Earthbreaker: Leap into a group, stun 1.5s | Thick hide: 6% damage reduction |
| Warlord | Top | Bruiser | split | Brawler, Wild | Rend: Heavy hit and slow | Warcry: +30% attack, 20% damage reduction for 6s | Bloodlust: up to +20% damage as own HP drops |
| Sentinel | Top, Jungle | Tank | protect | Vanguard, Warden | Shockwave: Hit and slow nearby foes | Unbreakable: 50% damage reduction for 4s | Giant: 8% max HP |
| Duskblade | Jungle, Mid | Assassin | pick | Shadow, Arcane | Night Cut: Dash and slash | Eclipse: Untargetable dive that executes the weakest foe | Executioner: +12% damage to champions under 35% HP |
| Huntress | Jungle | Fighter | pick | Wild, Sharpshooter | Spear Throw: Ranged spear | Wild Hunt: Allies gain move speed and attack | Hunter: +25% damage to camps, Titan and Shrine |
| Gravewalker | Jungle | Bruiser | engage | Mystic, Brawler | Drain: Hit and heal | Tombstorm: Damage zone around self for 4s | Bloodthirst: 8% lifesteal |
| Arcanist | Mid | Mage | poke | Arcane, Mystic | Arcane Bolt: Long-range bolt | Meteor: Area burst, short stun | Spellweave: 10% cooldown reduction |
| Frostweaver | Mid, Support | Mage | protect | Arcane, Warden | Frost Lance: Damage and 50% slow | Glacier: Freeze a group | Opener: +20% damage to targets above 80% HP |
| Voidcaller | Mid | Mage | poke | Arcane, Shadow | Rift Orb: Area burst | Singularity: Slowing void zone | Executioner: +12% damage to champions under 35% HP |
| Deadeye | Carry | Marksman | poke | Sharpshooter, Shadow | Pierce: Piercing shot | Final Shot: Very long shot that executes | Opener: +20% damage to targets above 80% HP |
| Skirmisher | Carry | Marksman | protect | Sharpshooter, Wild | Tumble: +40% attack speed for 3s | Bullet Storm: +60% attack speed, +15% attack for 5s | Swift: 8% move speed |
| Siegebreaker | Carry, Top | Marksman | split | Sharpshooter, Vanguard | Cannon: Splash shot | Barrage: Shell zone for 5s | Siege: +30% damage to structures |
| Stormarcher | Carry | Marksman | poke | Sharpshooter, Mystic | Chain Shot: Arcing shot that splashes | Thunderhead: Area burst and slow | Farmer: +25% damage to minions |
| Lifebinder | Support | Enchanter | protect | Warden, Mystic | Bloom: Heal the most-wounded ally | Rebirth: Big heal and shield on nearby allies | Guardian: heals and shields 20% stronger |
| Shieldmaiden | Support, Top | Tank | protect | Vanguard, Warden | Shield Bash: Dash, hit and stun | Phalanx: Shield allies, 20% damage reduction | Giant: 8% max HP |
| Hookmaster | Support, Jungle | Tank | pick | Brawler, Shadow | Hook: Pull a foe in and stun it | Chainline: Chain a group: stun 1.5s | Thick hide: 6% damage reduction |

**Balance.** A tuned per-champion HP/attack table (`BAL` in `data.js`) keeps every champion at 46–54% win rate over 5,400 full-engine games with equal 60-rated players (`node test/balance.mjs`, report in `test/balance.txt`).

**Patches.** Three a season: pre-season, 6 July (summer split) and 24 September (before the Grand Convergence). Each nerfs the 2–4 strongest champions by presence and win rate in top-league and international games and buffs the 2–4 weakest: 5–12% to HP, attack or cooldown, cumulative, capped at ±25%; unchanged mods decay ×0.7 a patch. Patch notes arrive in the inbox; the Meta tab (Competitions) shows the notes and an S/A/B/C tier list by role. AI clubs practise buffed champions for their role; players with comfort picks in the meta ask for more in transfers.

## Draft

**Standard (20 steps):** bans B R B R B R, picks B R R B B R, bans R B R B, picks R B B R. The higher seed is Blue in game 1; sides alternate within a series.

**Fearless (setting, off by default; Bo3/Bo5 only).** Champions a team played in the previous game are locked for that team. Uses the full 20-step order (the 40-champion pool leaves enough choice).

**Draft screen (04).** Series header with score and turn, a 30-second turn clock (the analyst locks in its suggestion when it runs out), role filters, search, "hide unavailable" with a count, the analyst's pick marked ◆ with a one-line reason, locked tiles greyed with a tooltip reason (banned, picked by Blue/Red, Fearless), "Used this series" pools per team with W/L, the selected champion's detail with mastery, tag, traits and kit, a composition box per side (tag, active traits, counter warning), the opponent's scouting panel (form, plan, chemistry, recent picks, comfort picks once scouted), a team talk once the draft is done, and champion trading between your own players after the draft (click two slots).

**AI drafting.** Bans target the opponent's comfort picks plus the patch's strongest champions. Picks score mastery for the best open slot, plus small leans for completing a trait, matching the club's drafting plan (auto, engage, poke, pick, split, protect; set on Tactics for the manager) and countering the opponent's tag, minus a lean when countered; penalties for no frontline or no ranged damage; Fearless locks respected. The analyst's suggestion shows the reason.

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

**Profile.** Name, region, age, main and secondary role, the 9 attributes (1–99), potential, traits, professionalism (1–20), morale, condition (20–100), form (last 5 ratings), champion mastery per champion (S ≥ 1.08, A ≥ 0.98, B ≥ 0.85, else C), wage and contract end.

**Traits** modify attributes in the engine: Aggressive laner, Tilts when behind, Clutch performer, Shotcaller, Ward master, Team player, Hot-headed, Ice cold, Inconsistent, Professional (grows faster).

**Squad.** Up to 10 first-team and 10 academy players, at least 5 first-team. Starters play at 95% in their secondary role and 88% elsewhere; morale and condition scale attributes. Promote and demote between academy and first team.

**Condition.** Each training session costs condition by drill; weekends and Rest restore it; every game costs 7. Professionalism scales the fatigue.

**Training (08).** A weekly plan of 10 sessions (Mon–Fri, AM/PM) chosen from nine drills, each with attributes it trains and a fatigue cost: Laning drills, Mechanics, Teamfight scrim, VOD review, Macro rotations, Mental coaching, Skirmish drills, Champion practice, Rest. Each player can also have one focus: an attribute (2 points) or a champion (1 point) from 15 focus points. The screen shows a 7-day condition forecast per player.

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

**Per game:** K/D/A (deaths include executions by towers and minions, about 0.4 per kill; team deaths are the sum of player deaths), CS (minions and camps), gold, damage, damage taken, healing, tower damage, objectives, vision score, damage share and a 1–10 rating; plus the draft (picks and bans), gold and objective totals.

**Stats centre (14).** Scope bar: Season, Career, Archive (any past year), Exhibitions (empty for now), This series (only the games of your latest series). Player rows show the role played most and the club of the latest game in scope. Champion K/D/A comes only from games with player lines (top leagues, internationals and your own games); otherwise it shows –. Filters: region, tier, role, minimum games. Tabs: Overview (leaders and top champions and teams), Players, Champions (picks, bans, presence, pick %, ban %, win %, KDA), Teams, Games (with report links), Economy (the club ledger). Every table sorts by any column and exports to CSV.

**Replays and highlights (P6).** Stats › Replays lists every kept report (your games and finals, latest 40) with its two best moments. Full-engine games play back on the report's map at 20× (play/pause, scrub, jump to a highlight). Highlights get a one-line title: multi-kills with context ("Triple kill with Ranger under the enemy tower", "…to force an ace", "…to open up the Titan", "…in the laning phase", "…including a shutdown"), solo outplays ("1v2 outplay: solo double kill with Wraith"), ultimates catching 3+ champions and the kills that follow, aces ("Ace to close the game"), shutdowns, solo first bloods, comebacks from 2.5k+ gold down, and Titans. Every Monday the inbox gets the Top 5 plays of the week (best play per kept game) as in mockup 17b: rank, champion, title, player · champion · match · minute, Watch ▸ opening the replay 5 s before.

**Result mails.** Each game of a finished series gets a recap (winner, score, length, peak gold lead, first blood, key moment, MVP line) and a small gold-lead graph; the match report header shows the same recap.

**Match report (15).** Per-game tabs within the series, the gold timeline with a minute marker, the map at any minute (scrub in 5 s steps) for full-engine games, highlight chips, both teams' stat lines and bans, the phase plans used, and the key events.

## UI

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
| Settings (13) | Live speed, sim detail, Fearless, pause triggers, confirm Continue, autosave, save to slot, download save (.json) |

**States.** Empty states for every list and table, a screen-error state, save error, legacy save found, unreadable save (falls back to the backup), offer rejected / countered, offer expired, scouting in progress, no fixture, playoffs and internationals not started. Checked at 1280 × 800 with no page scroll (long tables scroll inside their card).

## Technical architecture

Plain JavaScript ES modules, no build step, no runtime dependencies (fonts from Google Fonts). Served as static files, for example `python3 -m http.server`.

**Saves.** IndexedDB with three slots plus an autosave (weekly or daily, and after every multi-day sim); each write keeps the previous version as a `.bak`. Saves are gzip-compressed with `CompressionStream` (about 5 MB of JSON per year of history becomes about 1 MB). No localStorage fallback (v0.5): saves can be downloaded as .json from Settings and imported from the main menu instead. `SAVE_VERSION` 4 with a migration chain (v0.4 saves gain the new champions' mastery, drafting plans, the board, the manager and goals; patches, personalities and chemistry fill in lazily); v0.3 saves can't be converted and get a clean "start new" prompt. Save failures open a modal: Try again, Download save, Keep playing.

**Save size.** Per-game player lines are kept for top-league, international and the manager's games of the current season; lower-tier games keep results only. Series detail and games of earlier seasons are pruned at the review; competition results, tables, awards and per-player aggregates stay. Retired players without awards are dropped.

| Module | Responsibility |
|---|---|
| `js/data.js` | Champions, roles, attributes and weights, items and builds, teamfight roles, regions, tiers, name tables |
| `js/map.js` | Arena geometry, structures, camps, pits, blocked grid, waypoint graph, line of sight |
| `js/sim.js` | Full match engine, plans, items, event stream, summaries |
| `js/fastsim.js` | Statistical engine and `runPayload` (fast or full) |
| `js/draft.js` | Standard and Fearless orders, locks, AI bans and picks |
| `js/world.js` | World generation, players, clubs, staff, facilities, inbox, auto-starters |
| `js/club.js` | Training, condition, development, contracts, scouting, negotiation, AI market, finances, newgens, retirement |
| `js/calendar.js` | Dated schedule, leagues, brackets, internationals, promotion, games, awards, sim controls, season review |
| `js/stats.js` | Stats-centre scopes, aggregates and CSV |
| `js/meta.js` | Patches, tier list, comfort pool, meta fit |
| `js/board.js` | Board confidence, sacking, job market, manager reputation and history, budget, goals |
| `js/people.js` | Personalities, chemistry, status and promises, conversations, team talks, rivalries |
| `js/scrims.js` | Scrims and the opponent scouting report |
| `js/highlights.js` | Highlight detection and the weekly Top 5 digest |
| `js/cards.js` | Tactic Card definitions, rarity scaling and rules text (runtime comes in CARD_PLAN C1) |
| `js/news.js` | News stories: triggers, templates, weekly ranking, inbox and Home feed |
| `js/career.js` | Facade re-exporting the career modules |
| `js/worker.js` | Web Worker running full-engine jobs |
| `js/ui/*.js` | `app` (shell, router, menu, new career, settings, inbox, review), `screens` (club side), `comps` (competitions, stats), `matchday` (draft, live, post-game, report), `render` (canvas), `dom`, `state`, `store` |

**Testing.** `node test/sim.test.mjs` (determinism, bookkeeping, items, events, Fearless), `node test/fastsim.test.mjs` (fast vs full win rates), `node test/news.test.mjs` (one season: story types, inbox cap, no broken text), `node test/people.test.mjs` (chemistry growth and engine effect, personalities, promises and conversations, talks, rivalries), `node test/balance.mjs` (champion win rates), `node test/stats.test.mjs` (stat invariants on both engines: kills, deaths with executions, gold, objectives, games and wins per player and team, series scores, champion totals, the series scope), `node test/career.test.mjs [years]` (full seasons on the fast engine: every competition completes with the right sizes, promotion keeps tier sizes, rosters stay legal, stats centre and CSV work, save size). A year simulates in about 1.4 s in Node. The UI is checked in headless Chrome with no console errors.

## Roadmap / open work

Everything from P0–P8 (except P7), D0–D5 and News (v0.6) is built. What is left, in suggested order:

| # | Item | Size | Why |
|---|---|---|---|
| 1 | Scouting report feeds the analyst's ban suggestions | S | Today the report is only a panel in the draft |
| 2 | Exhibitions: friendly series on free days, with their own stats scope | S | Fills the empty Exhibitions scope |
| 3 | AI clubs use team talks and scrims | S | Fairness: today only the user benefits |
| 4 | Titan steals detected as highlights | S | Big moments are missing from the Top 5 |
| 5 | Mid roams with a lane-safety check | M | Roams were removed because they lost games |
| 6 | Media days on the schedule (pre-season and before finals): pick answers that move morale and board confidence | M | Ties into People and Career stakes |
| 7 | P7 Ranked solo queue | L | Parked: little value until the rest is deep enough |

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
