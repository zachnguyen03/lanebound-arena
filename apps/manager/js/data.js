// Static game data: roles, champions, regions, names. No DOM, so tests and the worker can import it.

export const ROLES = ['Top', 'Jungle', 'Mid', 'Carry', 'Support'];

// hp/atk are level-1 values; range and speed are in map units (map is 108x62).
// as = seconds between auto-attacks; cd = ability cooldown (s).
export const CHAMPS = {
  bulwark:     { name: 'Bulwark',     roles: ['Top', 'Support'],     cls: 'Tank',      hp: 1150, atk: 44, range: 2,   speed: 4.2, as: 1.2,  cd: 10, skill: 'guard',   color: '#9fb4c8' },
  vanguard:    { name: 'Vanguard',    roles: ['Top'],                cls: 'Bruiser',   hp: 1060, atk: 58, range: 2,   speed: 4.4, as: 1.0,  cd: 8,  skill: 'cleave',  color: '#e0a060' },
  duelist:     { name: 'Duelist',     roles: ['Top', 'Mid'],         cls: 'Fighter',   hp: 880,  atk: 64, range: 2,   speed: 4.6, as: 0.9,  cd: 7,  skill: 'lunge',   color: '#f07070' },
  reaper:      { name: 'Reaper',      roles: ['Top', 'Jungle'],      cls: 'Bruiser',   hp: 950,  atk: 58, range: 2,   speed: 4.5, as: 1.0,  cd: 9,  skill: 'harvest', color: '#b08080' },
  stalker:     { name: 'Stalker',     roles: ['Jungle'],             cls: 'Assassin',  hp: 760,  atk: 64, range: 2,   speed: 5.0, as: 0.9,  cd: 10, skill: 'shadow',  color: '#a070f0' },
  ravager:     { name: 'Ravager',     roles: ['Jungle'],             cls: 'Fighter',   hp: 980,  atk: 63, range: 2,   speed: 4.8, as: 0.95, cd: 9,  skill: 'frenzy',  color: '#d05050' },
  thornback:   { name: 'Thornback',   roles: ['Jungle', 'Support'],  cls: 'Tank',      hp: 1150, atk: 46, range: 2,   speed: 4.4, as: 1.15, cd: 10, skill: 'slam',    color: '#70a070' },
  phantom:     { name: 'Phantom',     roles: ['Mid', 'Jungle'],      cls: 'Assassin',  hp: 720,  atk: 66, range: 2,   speed: 5.0, as: 0.9,  cd: 10, skill: 'rift',    color: '#8080c0' },
  hexer:       { name: 'Hexer',       roles: ['Mid'],                cls: 'Mage',      hp: 680,  atk: 58, range: 7,   speed: 4.3, as: 1.1,  cd: 8,  skill: 'nova',    color: '#60b0f0' },
  stormcaller: { name: 'Stormcaller', roles: ['Mid', 'Support'],     cls: 'Mage',      hp: 700,  atk: 52, range: 7,   speed: 4.3, as: 1.1,  cd: 9,  skill: 'tempest', color: '#50d0d0' },
  ranger:      { name: 'Ranger',      roles: ['Carry'],              cls: 'Marksman',  hp: 680,  atk: 57, range: 7,   speed: 4.4, as: 0.85, cd: 7,  skill: 'volley',  color: '#70d090' },
  longbow:     { name: 'Longbow',     roles: ['Carry'],              cls: 'Marksman',  hp: 620,  atk: 74, range: 9,   speed: 4.2, as: 1.3,  cd: 12, skill: 'snipe',   color: '#c0e070' },
  blaster:     { name: 'Blaster',     roles: ['Carry', 'Mid'],       cls: 'Marksman',  hp: 660,  atk: 56, range: 6.5, speed: 4.4, as: 0.9,  cd: 8,  skill: 'scatter', color: '#f0a040' },
  mender:      { name: 'Mender',      roles: ['Support'],            cls: 'Enchanter', hp: 700,  atk: 30, range: 6.5, speed: 4.4, as: 1.0,  cd: 7,  skill: 'mend',    color: '#f0e070' },
  warden:      { name: 'Warden',      roles: ['Support'],            cls: 'Tank',      hp: 1100, atk: 40, range: 2,   speed: 4.4, as: 1.1,  cd: 10, skill: 'bind',    color: '#a0a0d0' },
  oracle:      { name: 'Oracle',      roles: ['Support'],            cls: 'Enchanter', hp: 720,  atk: 34, range: 6.5, speed: 4.4, as: 1.0,  cd: 9,  skill: 'aegis',   color: '#f0b0e0' },
  ironclad:    { name: 'Ironclad',    roles: ['Top'],                cls: 'Tank',      hp: 1200, atk: 44, range: 2,   speed: 4.2, as: 1.2,  cd: 10, skill: 'fortify', color: '#8090a0' },
  berserker:   { name: 'Berserker',   roles: ['Top', 'Jungle'],      cls: 'Fighter',   hp: 920,  atk: 62, range: 2,   speed: 4.6, as: 0.95, cd: 8,  skill: 'leap',    color: '#e07040' },
  spellblade:  { name: 'Spellblade',  roles: ['Mid', 'Top'],         cls: 'Fighter',   hp: 820,  atk: 64, range: 2,   speed: 4.7, as: 0.9,  cd: 7,  skill: 'blink',   color: '#9070e0' },
  wraith:      { name: 'Wraith',      roles: ['Jungle'],             cls: 'Assassin',  hp: 780,  atk: 66, range: 2,   speed: 5.0, as: 0.9,  cd: 9,  skill: 'pounce',  color: '#606080' },
  pyromancer:  { name: 'Pyromancer',  roles: ['Mid'],                cls: 'Mage',      hp: 660,  atk: 56, range: 7,   speed: 4.3, as: 1.1,  cd: 8,  skill: 'inferno', color: '#ff6030' },
  gunslinger:  { name: 'Gunslinger',  roles: ['Carry'],              cls: 'Marksman',  hp: 660,  atk: 55, range: 6.5, speed: 4.5, as: 0.85, cd: 8,  skill: 'fan',     color: '#d0b060' },
  trapper:     { name: 'Trapper',     roles: ['Carry', 'Support'],   cls: 'Marksman',  hp: 680,  atk: 52, range: 6.5, speed: 4.4, as: 0.95, cd: 10, skill: 'snare',   color: '#80a050' },
  chanter:     { name: 'Chanter',     roles: ['Support'],            cls: 'Enchanter', hp: 700,  atk: 32, range: 6.5, speed: 4.5, as: 1.0,  cd: 10, skill: 'haste',   color: '#a0e0f0' },
};
export const CHAMP_IDS = Object.keys(CHAMPS); // grows with the newer champions below

export const SKILL_TEXT = {
  guard: 'Shield self, taunt nearby foes',
  cleave: 'Hit all adjacent foes, heal per champion hit',
  lunge: 'Dash onto target, heavy hit',
  harvest: 'Execute that scales with missing HP',
  shadow: 'Blink to the weakest foe, burst',
  frenzy: '+50% attack speed for 4s',
  slam: 'Stun nearby foes for 1s',
  rift: 'Dash, burst, 1s untargetable',
  nova: 'Area burst around target',
  tempest: 'Area damage and 40% slow',
  volley: 'Empowered shot',
  snipe: 'Long-range shot on lowest-HP foe',
  scatter: 'Splash shot around target',
  mend: 'Heal the most-wounded ally',
  bind: 'Stun target, shield nearest ally',
  aegis: 'Shield all nearby allies',
  fortify: 'Take 40% less damage for 3s, taunt adjacent foes',
  leap: 'Leap onto a distant target, 40% slow',
  blink: 'Blink behind target, heavy strike',
  pounce: 'Pounce on a weak foe, short stun',
  inferno: 'Set target ablaze: damage over 4s',
  fan: 'Shoot the three nearest foes',
  snare: 'Root target for 1.5s, bonus damage',
  haste: 'Allies heal and gain 30% move and attack speed',
};

// ---- World (all names invented; see designs/handoff.md §7) ----
export const REGIONS = ['Eastern Crown', 'Jade Delta', 'Westmark', 'Frontier', 'Sunward'];
export const REGION_INFO = {
  'Eastern Crown': { league: 'Eastern Crown League', tag: 'ECL', clubs: 10, sponsor: 1.2, talent: 1.15, blurb: 'Fast, high-skill meta' },
  'Jade Delta':    { league: 'Jade Delta League',    tag: 'JDL', clubs: 14, sponsor: 1.1, talent: 1.1,  blurb: 'Most clubs, deepest talent' },
  'Westmark':      { league: 'Westmark League',      tag: 'WML', clubs: 10, sponsor: 1.0, talent: 1.0,  blurb: 'Slow, objective-driven' },
  'Frontier':      { league: 'Frontier Series',      tag: 'FRS', clubs: 8,  sponsor: 1.05, talent: 0.9, blurb: 'Top-heavy market' },
  'Sunward':       { league: 'Sunward League',       tag: 'SWL', clubs: 8,  sponsor: 0.85, talent: 1.0, blurb: 'Young players, fast growth' },
};
export const TIERS = ['Top league', 'Crown Challengers', 'Open Circuit']; // tier 0, 1 (Tier 2, 8 clubs), 2 (Amateur, 6 clubs)
export const TIER_SIZE = [null, 8, 6];
export const EVENTS = { vernal: 'Vernal Invitational', convergence: 'Grand Convergence' };

const CLUB_A = ['Hanok', 'Neon', 'Iron', 'Coral Bay', 'Vanta', 'Sable', 'Northgate', 'Juniper', 'Plum', 'Velum', 'Gilded', 'Harbor', 'Ashen', 'Cobalt', 'Saffron', 'Granite', 'Willow', 'Ember', 'Quartz', 'Lumen', 'Cinder', 'Mistral', 'Onyx', 'Tidal', 'Copper', 'Verdant', 'Basalt', 'Indigo', 'Marble', 'Thistle', 'Cedar', 'Hollow', 'Brass', 'Pale', 'Scarlet', 'Silver', 'Kestrel', 'Lantern', 'Moss', 'Rune'];
const CLUB_B = ['Wolves', 'Tide', 'Lotus', 'Ravens', 'Owls', 'Comets', 'Foxes', 'Rush', 'Ward', 'Knights', 'Tern', 'Nine', 'Union', 'Herons', 'Lynx', 'Pilots', 'Vipers', 'Guard', 'Monarchs', 'Drift', 'Spark', 'Bastion', 'Hounds', 'Crows', 'Rangers', 'Order', 'Stags', 'Harriers', 'Lancers', 'Wardens', 'Sharks', 'Echo', 'Collective', 'Gale', 'Sentinels', 'Embers', 'Orbit', 'Crowns', 'Falcons', 'Saints'];
export const CLUB_PARTS = [CLUB_A, CLUB_B];
export const TEAM_COLORS = ['#4DA3FF', '#FF5C6C', '#F2C14E', '#3DDC97', '#B48CFF', '#FF8FD0', '#46D7E0', '#FF9A4D', '#9FB4C8', '#E06C9F', '#7BD65A', '#E8E06A'];

// ---- Player attributes (1-100) ----
export const ATTRS = ['decision', 'mech', 'laning', 'positioning', 'vision', 'aggression', 'teamwork', 'resilience', 'clutch'];
export const ATTR_LABEL = { decision: 'Decision Making', mech: 'Mechanics', laning: 'Laning', positioning: 'Positioning', vision: 'Vision', aggression: 'Aggression', teamwork: 'Teamwork', resilience: 'Resilience', clutch: 'Clutch' };
export const ATTR_SHORT = { decision: 'DEC', mech: 'MEC', laning: 'LAN', positioning: 'POS', vision: 'VIS', aggression: 'AGG', teamwork: 'TMW', resilience: 'RES', clutch: 'CLU' };

// Overall rating = role-weighted average of the attributes.
export const ROLE_WEIGHTS = {
  Top:     { decision: 0.12, mech: 0.2,  laning: 0.2,  positioning: 0.08, vision: 0.05, aggression: 0.08, teamwork: 0.12, resilience: 0.08, clutch: 0.07 },
  Jungle:  { decision: 0.25, mech: 0.15, laning: 0.03, positioning: 0.07, vision: 0.14, aggression: 0.1,  teamwork: 0.12, resilience: 0.07, clutch: 0.07 },
  Mid:     { decision: 0.12, mech: 0.27, laning: 0.17, positioning: 0.1,  vision: 0.05, aggression: 0.06, teamwork: 0.1,  resilience: 0.06, clutch: 0.07 },
  Carry:   { decision: 0.08, mech: 0.27, laning: 0.17, positioning: 0.17, vision: 0.03, aggression: 0.05, teamwork: 0.1,  resilience: 0.06, clutch: 0.07 },
  Support: { decision: 0.2,  mech: 0.08, laning: 0.07, positioning: 0.15, vision: 0.2,  aggression: 0.05, teamwork: 0.15, resilience: 0.05, clutch: 0.05 },
};
export const overall = (p, role = p.role) => Math.round(ATTRS.reduce((n, k) => n + (p[k] ?? 50) * ROLE_WEIGHTS[role][k], 0));

// ---- Teamfight roles ----
export const TF_ROLES = ['Frontline', 'Initiator', 'Midline', 'Backline', 'Assassin'];
export const TF_DEFAULT = { Tank: 'Frontline', Bruiser: 'Initiator', Fighter: 'Initiator', Assassin: 'Assassin', Mage: 'Midline', Marksman: 'Backline', Enchanter: 'Backline' };

// ---- Items (bought at the fountain; each class follows its build order) ----
// atk/hp are fractions of the champion's base values; as = attack speed, cdr = cooldown reduction,
// dr = damage reduction, ls = lifesteal, heal = bonus to heals and shields given.
export const ITEMS = {
  blade:   { name: 'Longblade',       short: 'LB', cost: 450,  atk: 0.08 },
  vest:    { name: 'Padded Vest',     short: 'PV', cost: 400,  hp: 0.1 },
  quiver:  { name: 'Swift Quiver',    short: 'SQ', cost: 500,  as: 0.08 },
  tome:    { name: 'Apprentice Tome', short: 'AT', cost: 450,  atk: 0.06, cdr: 0.05 },
  bulwark: { name: 'Tower Plate',     short: 'TP', cost: 900,  hp: 0.2, dr: 0.05 },
  reaver:  { name: 'Reaver Axe',      short: 'RA', cost: 950,  atk: 0.13, ls: 0.08 },
  storm:   { name: 'Stormbow',        short: 'SB', cost: 1000, atk: 0.11, as: 0.1 },
  staff:   { name: 'Arc Staff',       short: 'AS', cost: 950,  atk: 0.15, cdr: 0.1 },
  edge:    { name: 'Nightedge',       short: 'NE', cost: 950,  atk: 0.16 },
  censer:  { name: 'Warm Censer',     short: 'WC', cost: 850,  hp: 0.1, cdr: 0.12, heal: 0.15 },
  aegis:   { name: 'Oath Aegis',      short: 'OA', cost: 1100, hp: 0.22, dr: 0.06 },
  crown:   { name: 'Last Crown',      short: 'LC', cost: 1300, atk: 0.2, as: 0.06 },
};
export const BUILDS = {
  Tank: ['vest', 'bulwark', 'tome', 'aegis', 'censer', 'reaver'],
  Bruiser: ['blade', 'vest', 'reaver', 'bulwark', 'aegis', 'crown'],
  Fighter: ['blade', 'reaver', 'vest', 'edge', 'aegis', 'crown'],
  Assassin: ['blade', 'edge', 'vest', 'reaver', 'crown', 'aegis'],
  Mage: ['tome', 'staff', 'vest', 'censer', 'crown', 'aegis'],
  Marksman: ['quiver', 'blade', 'storm', 'edge', 'crown', 'vest'],
  Enchanter: ['tome', 'censer', 'vest', 'aegis', 'staff', 'bulwark'],
};

export const NAME_A = ['Ka', 'Ze', 'Vo', 'Mi', 'Ru', 'Ny', 'Sol', 'Tor', 'Ax', 'Li', 'Fen', 'Qu', 'Da', 'Ori', 'Bel', 'Cy', 'Jin', 'Mar', 'Pyr', 'Vex', 'Wy', 'Hal', 'Isk', 'Ro'];
export const NAME_B = ['ro', 'ph', 'x', 'ne', 'ka', 'vin', 'ra', 'lo', 'zen', 'ix', 'mo', 'sa', 'th', 'ky', 'rin', 'dan', 'us', 'el', 'on', 'ia', 'ek', 'ar', 'is', 'um'];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- Champion kits v2: passive, ultimate (level 6+), 2 traits, composition tag ----
// Ability defs (ultimates and the new champions' base skills) are effect lists run by sim.js castFx:
//   aim: target | self | lowestFoe | lowestAlly | cluster (best enemy cluster in range)
//   when: engage | aoe | burst | execute | save | buff  (what the caster waits for; Decision Making judges it)
//   range, r (radius around the aim point), dash, fx: { dmg, exec, stun, slow:[pct,s], pull, shield, heal, buff:{atk,as,dr,speed,dur}, zone:{dps,dur,slow}, untarget }
//   Effects on allies (shield, heal, buff) hit allies within r of the aim point; damage effects hit enemies.
export const PASSIVES = {
  thick: 'Thick hide: 6% damage reduction', lifesteal: 'Bloodthirst: 8% lifesteal', spellweave: 'Spellweave: 10% cooldown reduction',
  guardian: 'Guardian: heals and shields 20% stronger', swift: 'Swift: 8% move speed', giant: 'Giant: 8% max HP',
  executioner: 'Executioner: +12% damage to champions under 35% HP', siege: 'Siege: +30% damage to structures', opener: 'Opener: +20% damage to targets above 80% HP',
  hunter: 'Hunter: +25% damage to camps, Titan and Shrine', bloodlust: 'Bloodlust: up to +20% damage as own HP drops', farmer: 'Farmer: +25% damage to minions',
};
export const TRAITS = {
  Vanguard: { stat: 'hp', label: 'max HP', v: [0.05, 0.09, 0.14] }, Brawler: { stat: 'dr', label: 'damage reduction', v: [0.04, 0.07, 0.1] },
  Arcane: { stat: 'skill', label: 'ability damage', v: [0.08, 0.14, 0.2] }, Sharpshooter: { stat: 'as', label: 'attack speed', v: [0.06, 0.1, 0.15] },
  Shadow: { stat: 'atk', label: 'attack', v: [0.05, 0.09, 0.13] }, Warden: { stat: 'heal', label: 'heal and shield power', v: [0.12, 0.2, 0.3] },
  Wild: { stat: 'speed', label: 'move speed and lifesteal', v: [0.04, 0.07, 0.1] }, Mystic: { stat: 'cdr', label: 'cooldown reduction', v: [0.06, 0.1, 0.14] },
};
export const traitTier = n => (n >= 4 ? 3 : n >= 3 ? 2 : n >= 2 ? 1 : 0); // 2/3/4 champions with the trait
export const COMP_TAGS = ['engage', 'poke', 'pick', 'split', 'protect'];
export const COMP_BEATS = { engage: 'poke', poke: 'protect', protect: 'engage' }; // counter triangle; pick and split are side plans
export const COMP_TEXT = { engage: 'Engage: dive in together', poke: 'Poke: chip from range', pick: 'Pick: catch isolated targets', split: 'Split: pressure side lanes', protect: 'Protect: keep the carry alive', mixed: 'Mixed: no clear identity' };

const U = (name, text, cd, def) => ({ name, text, cd, ...def });
const KITS = {
  bulwark:     { passive: 'thick', traits: ['Vanguard', 'Warden'], tag: 'protect', ult: U('Iron Bastion', 'Shield all nearby allies', 75, { aim: 'self', when: 'save', r: 5, fx: { shield: 300 } }) },
  vanguard:    { passive: 'bloodlust', traits: ['Brawler', 'Vanguard'], tag: 'engage', ult: U('Charge', 'Dash in, stun and hit a group', 80, { aim: 'cluster', when: 'engage', range: 8, r: 3, dash: true, fx: { dmg: 1.5, stun: 1 } }) },
  duelist:     { passive: 'opener', traits: ['Brawler', 'Shadow'], tag: 'split', ult: U('Riposte', '+30% attack, 40% damage reduction for 3s', 60, { aim: 'self', when: 'buff', fx: { buff: { atk: 0.3, dr: 0.4, dur: 3 } } }) },
  reaper:      { passive: 'executioner', traits: ['Shadow', 'Wild'], tag: 'split', ult: U('Reap', 'Execute: damage scales hard with missing HP', 70, { aim: 'target', when: 'execute', range: 3, fx: { dmg: 1, exec: 0.45 } }) },
  stalker:     { passive: 'executioner', traits: ['Shadow', 'Wild'], tag: 'pick', ult: U('Vanish', 'Turn untargetable, strike the weakest foe', 70, { aim: 'lowestFoe', when: 'burst', range: 10, dash: true, fx: { dmg: 2.5, untarget: 1.5 } }) },
  ravager:     { passive: 'lifesteal', traits: ['Wild', 'Brawler'], tag: 'engage', ult: U('Bloodrage', '+20% attack, +40% attack speed for 5s', 65, { aim: 'self', when: 'buff', fx: { buff: { atk: 0.2, as: 0.4, dur: 5 } } }) },
  thornback:   { passive: 'giant', traits: ['Vanguard', 'Wild'], tag: 'engage', ult: U('Quake', 'Leap into a group and stun it', 85, { aim: 'cluster', when: 'engage', range: 8, r: 4, dash: true, fx: { dmg: 1, stun: 1.25 } }) },
  phantom:     { passive: 'swift', traits: ['Shadow', 'Arcane'], tag: 'pick', ult: U('Blade Storm', 'Dash into a group, heavy area damage', 75, { aim: 'cluster', when: 'aoe', range: 7, r: 3, dash: true, fx: { dmg: 2 } }) },
  hexer:       { passive: 'spellweave', traits: ['Arcane', 'Mystic'], tag: 'poke', ult: U('Overload', 'Massive area burst', 70, { aim: 'cluster', when: 'aoe', range: 9, r: 3, fx: { dmg: 2.6 } }) },
  stormcaller: { passive: 'opener', traits: ['Arcane', 'Warden'], tag: 'poke', ult: U('Eye of the Storm', 'Storm zone: damage and slow for 5s', 80, { aim: 'cluster', when: 'aoe', range: 9, r: 4, fx: { zone: { dps: 0.8, dur: 5, slow: 0.35 } } }) },
  ranger:      { passive: 'farmer', traits: ['Sharpshooter', 'Wild'], tag: 'poke', ult: U('Rain of Arrows', 'Area damage and slow', 70, { aim: 'cluster', when: 'aoe', range: 10, r: 3.5, fx: { dmg: 1.8, slow: [0.4, 2] } }) },
  longbow:     { passive: 'opener', traits: ['Sharpshooter', 'Shadow'], tag: 'poke', ult: U('Skyshot', 'Map-wide shot on the weakest foe', 80, { aim: 'lowestFoe', when: 'execute', range: 30, fx: { dmg: 2.8, exec: 0.2 } }) },
  blaster:     { passive: 'siege', traits: ['Sharpshooter', 'Arcane'], tag: 'poke', ult: U('Rocket', 'Explosive rocket', 65, { aim: 'cluster', when: 'aoe', range: 11, r: 2.5, fx: { dmg: 2.4 } }) },
  mender:      { passive: 'guardian', traits: ['Warden', 'Mystic'], tag: 'protect', ult: U('Sanctuary', 'Big heal on all nearby allies', 80, { aim: 'self', when: 'save', r: 7, fx: { heal: 250 } }) },
  warden:      { passive: 'thick', traits: ['Vanguard', 'Warden'], tag: 'engage', ult: U('Lockdown', 'Stun a group for 1.5s', 85, { aim: 'cluster', when: 'engage', range: 6, r: 3, fx: { stun: 1.5, dmg: 0.6 } }) },
  oracle:      { passive: 'guardian', traits: ['Warden', 'Arcane'], tag: 'protect', ult: U('Foresight', 'Shield and speed up nearby allies', 75, { aim: 'self', when: 'save', r: 7, fx: { shield: 260, buff: { speed: 0.25, dur: 3 } } }) },
  ironclad:    { passive: 'giant', traits: ['Vanguard', 'Brawler'], tag: 'engage', ult: U('Juggernaut', 'Charge a target, stun it, 40% damage reduction', 80, { aim: 'target', when: 'engage', range: 8, r: 2, dash: true, fx: { stun: 1, dmg: 0.8, buff: { dr: 0.4, dur: 4 } } }) },
  berserker:   { passive: 'bloodlust', traits: ['Brawler', 'Wild'], tag: 'split', ult: U('Undying Rage', 'Heal, +30% attack and attack speed', 70, { aim: 'self', when: 'buff', fx: { heal: 200, buff: { atk: 0.3, as: 0.3, dur: 4 } } }) },
  spellblade:  { passive: 'spellweave', traits: ['Arcane', 'Shadow'], tag: 'pick', ult: U('Arc Slash', 'Dash through a group', 70, { aim: 'cluster', when: 'aoe', range: 7, r: 2.5, dash: true, fx: { dmg: 2 } }) },
  wraith:      { passive: 'executioner', traits: ['Shadow', 'Mystic'], tag: 'pick', ult: U('Haunt', 'Dive the weakest foe: execute and stun', 75, { aim: 'lowestFoe', when: 'execute', range: 9, dash: true, fx: { dmg: 1.2, exec: 0.4, stun: 0.5 } }) },
  pyromancer:  { passive: 'spellweave', traits: ['Arcane', 'Mystic'], tag: 'poke', ult: U('Firestorm', 'Burning zone for 4s', 75, { aim: 'cluster', when: 'aoe', range: 9, r: 3.5, fx: { zone: { dps: 1.2, dur: 4 } } }) },
  gunslinger:  { passive: 'swift', traits: ['Sharpshooter', 'Shadow'], tag: 'pick', ult: U('Dead or Alive', 'Long shot that executes', 70, { aim: 'lowestFoe', when: 'execute', range: 11, fx: { dmg: 2.2, exec: 0.3 } }) },
  trapper:     { passive: 'opener', traits: ['Sharpshooter', 'Warden'], tag: 'pick', ult: U('Net Field', 'Root a group for 1s', 75, { aim: 'cluster', when: 'engage', range: 9, r: 3, fx: { stun: 1, dmg: 0.8, slow: [0.4, 2] } }) },
  chanter:     { passive: 'guardian', traits: ['Warden', 'Mystic'], tag: 'protect', ult: U('Anthem', 'Allies gain attack, attack and move speed', 75, { aim: 'self', when: 'buff', r: 7, fx: { buff: { atk: 0.15, as: 0.3, speed: 0.3, dur: 6 } } }) },
};
// 16 newer champions: base skill is an effect list too (skill: 'fx').
const NEW = {
  bastion:      ['Bastion', ['Top', 'Support'], 'Tank', 1180, 44, 2, 4.2, 1.2, 'thick', ['Vanguard', 'Brawler'], 'engage', U('Rampart', 'Shield self, slow nearby foes', 10, { aim: 'self', when: 'buff', r: 3, fx: { shield: 220, slow: [0.35, 2] } }), U('Earthbreaker', 'Leap into a group, stun 1.5s', 85, { aim: 'cluster', when: 'engage', range: 8, r: 3.5, dash: true, fx: { dmg: 1, stun: 1.5 } }), '#a0b090'],
  warlord:      ['Warlord', ['Top'], 'Bruiser', 1040, 60, 2, 4.4, 1.0, 'bloodlust', ['Brawler', 'Wild'], 'split', U('Rend', 'Heavy hit and slow', 8, { aim: 'target', when: 'burst', range: 2.5, fx: { dmg: 1.5, slow: [0.3, 2] } }), U('Warcry', '+30% attack, 20% damage reduction for 6s', 70, { aim: 'self', when: 'buff', fx: { buff: { atk: 0.3, dr: 0.2, dur: 6 } } }), '#c08050'],
  sentinel:     ['Sentinel', ['Top', 'Jungle'], 'Tank', 1160, 46, 2, 4.3, 1.15, 'giant', ['Vanguard', 'Warden'], 'protect', U('Shockwave', 'Hit and slow nearby foes', 9, { aim: 'self', when: 'aoe', r: 2.5, fx: { dmg: 1, slow: [0.35, 2] } }), U('Unbreakable', '50% damage reduction for 4s', 70, { aim: 'self', when: 'buff', fx: { buff: { dr: 0.5, dur: 4 } } }), '#90a0b8'],
  duskblade:    ['Duskblade', ['Jungle', 'Mid'], 'Assassin', 740, 66, 2, 5.0, 0.9, 'executioner', ['Shadow', 'Arcane'], 'pick', U('Night Cut', 'Dash and slash', 9, { aim: 'target', when: 'burst', range: 6, dash: true, fx: { dmg: 1.8 } }), U('Eclipse', 'Untargetable dive that executes the weakest foe', 75, { aim: 'lowestFoe', when: 'execute', range: 9, dash: true, fx: { dmg: 1, exec: 0.4, untarget: 1 } }), '#5a4a8a'],
  huntress:     ['Huntress', ['Jungle'], 'Fighter', 900, 62, 2, 4.8, 0.95, 'hunter', ['Wild', 'Sharpshooter'], 'pick', U('Spear Throw', 'Ranged spear', 8, { aim: 'target', when: 'burst', range: 7, fx: { dmg: 1.6 } }), U('Wild Hunt', 'Allies gain move speed and attack', 75, { aim: 'self', when: 'engage', r: 8, fx: { buff: { speed: 0.3, atk: 0.1, dur: 5 } } }), '#c0a050'],
  gravewalker:  ['Gravewalker', ['Jungle'], 'Bruiser', 1000, 56, 2, 4.5, 1.0, 'lifesteal', ['Mystic', 'Brawler'], 'engage', U('Drain', 'Hit and heal', 9, { aim: 'target', when: 'burst', range: 2.5, fx: { dmg: 1.3, heal: 100 } }), U('Tombstorm', 'Damage zone around self for 4s', 80, { aim: 'self', when: 'aoe', r: 3, fx: { zone: { dps: 0.9, dur: 4 } } }), '#708070'],
  arcanist:     ['Arcanist', ['Mid'], 'Mage', 660, 58, 7.5, 4.3, 1.1, 'spellweave', ['Arcane', 'Mystic'], 'poke', U('Arcane Bolt', 'Long-range bolt', 8, { aim: 'target', when: 'burst', range: 8.5, fx: { dmg: 2 } }), U('Meteor', 'Area burst, short stun', 80, { aim: 'cluster', when: 'aoe', range: 10, r: 3, fx: { dmg: 3, stun: 0.75 } }), '#7090ff'],
  frostweaver:  ['Frostweaver', ['Mid', 'Support'], 'Mage', 700, 52, 7, 4.3, 1.1, 'opener', ['Arcane', 'Warden'], 'protect', U('Frost Lance', 'Damage and 50% slow', 8, { aim: 'target', when: 'burst', range: 7.5, fx: { dmg: 1.3, slow: [0.5, 2] } }), U('Glacier', 'Freeze a group', 85, { aim: 'cluster', when: 'engage', range: 9, r: 3.5, fx: { stun: 1.25, dmg: 1.2 } }), '#a0e0ff'],
  voidcaller:   ['Voidcaller', ['Mid'], 'Mage', 680, 56, 7, 4.3, 1.1, 'executioner', ['Arcane', 'Shadow'], 'poke', U('Rift Orb', 'Area burst', 8, { aim: 'target', when: 'aoe', range: 7.5, r: 2, fx: { dmg: 1.3 } }), U('Singularity', 'Slowing void zone', 80, { aim: 'cluster', when: 'aoe', range: 9, r: 3.5, fx: { zone: { dps: 1.1, dur: 4, slow: 0.4 } } }), '#8050c0'],
  deadeye:      ['Deadeye', ['Carry'], 'Marksman', 640, 70, 8.5, 4.3, 1.15, 'opener', ['Sharpshooter', 'Shadow'], 'poke', U('Pierce', 'Piercing shot', 9, { aim: 'target', when: 'burst', range: 8.5, r: 1.5, fx: { dmg: 1.8 } }), U('Final Shot', 'Very long shot that executes', 80, { aim: 'lowestFoe', when: 'execute', range: 14, fx: { dmg: 2.5, exec: 0.25 } }), '#e0d090'],
  skirmisher:   ['Skirmisher', ['Carry'], 'Marksman', 680, 54, 6.5, 4.6, 0.85, 'swift', ['Sharpshooter', 'Wild'], 'protect', U('Tumble', '+40% attack speed for 3s', 8, { aim: 'self', when: 'buff', fx: { buff: { as: 0.4, dur: 3 } } }), U('Bullet Storm', '+60% attack speed, +15% attack for 5s', 70, { aim: 'self', when: 'buff', fx: { buff: { as: 0.6, atk: 0.15, dur: 5 } } }), '#60c0a0'],
  siegebreaker: ['Siegebreaker', ['Carry', 'Top'], 'Marksman', 720, 58, 7, 4.2, 1.0, 'siege', ['Sharpshooter', 'Vanguard'], 'split', U('Cannon', 'Splash shot', 9, { aim: 'target', when: 'aoe', range: 7.5, r: 1.5, fx: { dmg: 1.6 } }), U('Barrage', 'Shell zone for 5s', 75, { aim: 'cluster', when: 'aoe', range: 10, r: 3, fx: { zone: { dps: 0.9, dur: 5 } } }), '#b09070'],
  stormarcher:  ['Stormarcher', ['Carry'], 'Marksman', 660, 56, 7, 4.4, 0.9, 'farmer', ['Sharpshooter', 'Mystic'], 'poke', U('Chain Shot', 'Arcing shot that splashes', 8, { aim: 'target', when: 'aoe', range: 7.5, r: 2, fx: { dmg: 1.4 } }), U('Thunderhead', 'Area burst and slow', 75, { aim: 'cluster', when: 'aoe', range: 10, r: 3, fx: { dmg: 2.2, slow: [0.4, 2] } }), '#70b0e0'],
  lifebinder:   ['Lifebinder', ['Support'], 'Enchanter', 710, 32, 6.5, 4.4, 1.0, 'guardian', ['Warden', 'Mystic'], 'protect', U('Bloom', 'Heal the most-wounded ally', 7, { aim: 'lowestAlly', when: 'save', range: 7, fx: { heal: 140 } }), U('Rebirth', 'Big heal and shield on nearby allies', 85, { aim: 'self', when: 'save', r: 7, fx: { heal: 200, shield: 150 } }), '#90f0a0'],
  shieldmaiden: ['Shieldmaiden', ['Support', 'Top'], 'Tank', 1120, 42, 2, 4.4, 1.1, 'giant', ['Vanguard', 'Warden'], 'protect', U('Shield Bash', 'Dash, hit and stun', 10, { aim: 'target', when: 'engage', range: 5, dash: true, fx: { dmg: 1, stun: 0.75 } }), U('Phalanx', 'Shield allies, 20% damage reduction', 80, { aim: 'self', when: 'save', r: 6, fx: { shield: 220, buff: { dr: 0.2, dur: 4 } } }), '#d0c0a0'],
  hookmaster:   ['Hookmaster', ['Support', 'Jungle'], 'Tank', 1100, 44, 2, 4.3, 1.15, 'thick', ['Brawler', 'Shadow'], 'pick', U('Hook', 'Pull a foe in and stun it', 12, { aim: 'target', when: 'engage', range: 7.5, fx: { pull: true, stun: 0.75, dmg: 0.8 } }), U('Chainline', 'Chain a group: stun 1.5s', 85, { aim: 'cluster', when: 'engage', range: 7, r: 3, fx: { stun: 1.5, dmg: 1 } }), '#807060'],
};
for (const [id, k] of Object.entries(KITS)) Object.assign(CHAMPS[id], k);
for (const [id, [name, roles, cls, hp, atk, range, speed, as, passive, traits, tag, skill, ult, color]] of Object.entries(NEW)) {
  CHAMPS[id] = { name, roles, cls, hp, atk, range, speed, as, cd: skill.cd, skill: 'fx', fx: skill, passive, traits, tag, ult, color };
  CHAMP_IDS.push(id);
}
export const skillText = id => { const c = CHAMPS[id]; return c.skill === 'fx' ? `${c.fx.name}: ${c.fx.text}` : SKILL_TEXT[c.skill]; };
export const kitText = id => { const c = CHAMPS[id]; return { skill: skillText(id), ult: `${c.ult.name}: ${c.ult.text}`, passive: PASSIVES[c.passive], traits: c.traits, tag: c.tag }; };
// Composition of a lineup of champion ids: most common tag (needs 2+), trait counts, active trait tiers.
export function compOf(ids) {
  const tags = {}, traits = {};
  for (const id of ids.filter(Boolean)) { const c = CHAMPS[id]; tags[c.tag] = (tags[c.tag] ?? 0) + 1; for (const t of c.traits) traits[t] = (traits[t] ?? 0) + 1; }
  const [tag, n] = Object.entries(tags).sort((a, b) => b[1] - a[1])[0] ?? ['mixed', 0];
  return { tag: n >= 2 ? tag : 'mixed', tags, traits, active: Object.fromEntries(Object.entries(traits).filter(([, n]) => n >= 2).map(([t, n]) => [t, traitTier(n)])) };
}
// Balance pass (test/balance.mjs): per-champion scale on base HP and attack, tuned toward 50% win rate.
export const BAL = {bulwark: 1.092,vanguard: 0.954,duelist: 0.934,reaper: 0.972,stalker: 0.947,ravager: 0.955,thornback: 0.981,phantom: 0.94,hexer: 0.976,stormcaller: 0.986,ranger: 0.915,longbow: 0.829,blaster: 0.948,mender: 1.262,warden: 0.972,oracle: 1.267,ironclad: 1.175,berserker: 0.938,spellblade: 0.946,wraith: 0.96,pyromancer: 0.996,gunslinger: 0.944,trapper: 1.028,chanter: 1.059,bastion: 1.104,warlord: 0.929,sentinel: 1.088,duskblade: 0.996,huntress: 0.866,gravewalker: 1.102,arcanist: 0.968,frostweaver: 1.009,voidcaller: 0.981,deadeye: 0.832,skirmisher: 1.012,siegebreaker: 0.948,stormarcher: 1.031,lifebinder: 1.229,shieldmaiden: 1.179,hookmaster: 1.024};
for (const [id, f] of Object.entries(BAL)) { CHAMPS[id].hp = Math.round(CHAMPS[id].hp * f); CHAMPS[id].atk = Math.round(CHAMPS[id].atk * f * 10) / 10; }
