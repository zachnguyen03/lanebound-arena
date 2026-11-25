// Static game data: roles, champions, regions, names. No DOM, so tests and the worker can import it.

export const ROLES = ['Top', 'Jungle', 'Mid', 'Carry', 'Support'];

// The 14 Lanebound champions (data/champions/defs.ts): role = default_slot, cls = class. The sim owns every stat.
const C = (name, role, cls, color) => ({ name, roles: [role], cls, color });
export const CHAMPS = {
  rhedan: C('Rhedan', 'Top', 'Fighter', '#e0a060'),       brannoch: C('Brannoch', 'Top', 'Tank', '#9fb4c8'),
  sedge: C('Sedge', 'Jungle', 'Mage', '#70a070'),          torun: C('Torun', 'Jungle', 'Tank', '#8090a0'),          tolle: C('Tolle', 'Jungle', 'Tank', '#a0b090'),
  helvar: C('Helvar', 'Mid', 'Mage', '#60b0f0'),           calder: C('Calder', 'Mid', 'Mage', '#ff6030'),           kerrig: C('Kerrig', 'Mid', 'Assassin', '#a070f0'),       mirren: C('Mirren', 'Mid', 'Mage', '#8050c0'),
  huntress: C('Huntress', 'Carry', 'Marksman', '#c0a050'), maelis: C('Maelis', 'Carry', 'Marksman', '#e0d090'),     isra: C('Isra', 'Carry', 'Marksman', '#70d090'),
  ysol: C('Ysol', 'Support', 'Enchanter', '#f0e070'),      saelo: C('Saelo', 'Support', 'Mage', '#a0e0f0'),
};
export const CHAMP_IDS = Object.keys(CHAMPS);

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

// ---- Player attributes (1-99) ----
// The first six feed the sim 1:1 (career 60 = sim 70, see engine.ts); aggression sets the tactics posture,
// resilience and clutch shape the day's form roll.
export const ATTRS = ['aim', 'reflexes', 'execution', 'decision', 'positioning', 'teamwork', 'aggression', 'resilience', 'clutch'];
export const ATTR_LABEL = { aim: 'Aim', reflexes: 'Reflexes', execution: 'Execution', decision: 'Decision Making', positioning: 'Positioning', teamwork: 'Teamwork', aggression: 'Aggression', resilience: 'Resilience', clutch: 'Clutch' };
export const ATTR_SHORT = { aim: 'AIM', reflexes: 'REF', execution: 'EXE', decision: 'DEC', positioning: 'POS', teamwork: 'TMW', aggression: 'AGG', resilience: 'RES', clutch: 'CLU' };

// Overall rating = role-weighted average of the attributes (each row sums to 1).
export const ROLE_WEIGHTS = {
  Top:     { aim: 0.12, reflexes: 0.14, execution: 0.16, decision: 0.12, positioning: 0.14, teamwork: 0.12, aggression: 0.08, resilience: 0.06, clutch: 0.06 },
  Jungle:  { aim: 0.1,  reflexes: 0.12, execution: 0.12, decision: 0.22, positioning: 0.1,  teamwork: 0.14, aggression: 0.08, resilience: 0.06, clutch: 0.06 },
  Mid:     { aim: 0.2,  reflexes: 0.14, execution: 0.16, decision: 0.12, positioning: 0.1,  teamwork: 0.1,  aggression: 0.06, resilience: 0.06, clutch: 0.06 },
  Carry:   { aim: 0.22, reflexes: 0.12, execution: 0.14, decision: 0.08, positioning: 0.18, teamwork: 0.1,  aggression: 0.04, resilience: 0.06, clutch: 0.06 },
  Support: { aim: 0.08, reflexes: 0.14, execution: 0.1,  decision: 0.2,  positioning: 0.14, teamwork: 0.2,  aggression: 0.04, resilience: 0.05, clutch: 0.05 },
};
export const overall = (p, role = p.role) => Math.round(ATTRS.reduce((n, k) => n + (p[k] ?? 50) * ROLE_WEIGHTS[role][k], 0));

// ---- Game plan -> sim tactics (engine.ts simTactics) ----
// preset: hold_the_pit (group on the centre point), hunt (chase fights, take enemy points), starve (spread over the points, avoid fights).
// posture: aggressive | balanced | defensive (team Aggression can shift it one step). focus: auto or an enemy role. protect: peel for the carry.
export const PLAN_PRESETS = {
  standard: { name: 'Standard', preset: 'hold_the_pit', posture: 'balanced', focus: 'auto', protect: true },
  early: { name: 'Early aggression', preset: 'hunt', posture: 'aggressive', focus: 'auto', protect: false },
  scale: { name: 'Scale and teamfight', preset: 'hold_the_pit', posture: 'defensive', focus: 'Carry', protect: true },
  split: { name: 'Split map', preset: 'starve', posture: 'balanced', focus: 'auto', protect: true },
  objective: { name: 'Objective control', preset: 'starve', posture: 'defensive', focus: 'auto', protect: true },
};
export const clonePlan = p => ({ ...(p ?? PLAN_PRESETS.standard) });
export const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export const NAME_A = ['Ka', 'Ze', 'Vo', 'Mi', 'Ru', 'Ny', 'Sol', 'Tor', 'Ax', 'Li', 'Fen', 'Qu', 'Da', 'Ori', 'Bel', 'Cy', 'Jin', 'Mar', 'Pyr', 'Vex', 'Wy', 'Hal', 'Isk', 'Ro'];
export const NAME_B = ['ro', 'ph', 'x', 'ne', 'ka', 'vin', 'ra', 'lo', 'zen', 'ix', 'mo', 'sa', 'th', 'ky', 'rin', 'dan', 'us', 'el', 'on', 'ia', 'ek', 'ar', 'is', 'um'];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
