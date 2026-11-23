import { describe, expect, it } from "vitest";
import type { Fixture } from "./calendar.js";
import { compArchetype } from "./archetype.js";
import { playSeries } from "./runner.js";
import { openingWorld, selectStarters } from "./world.js";

const TAGS = ["Dive", "Peel", "Poke", "Balanced"] as const;
const TACTICS = ["hold", "hunt", "starve"] as const;

function fixture(id: string, teams: [string, string]): Fixture {
  return {
    id,
    competition_id: "bound_circuit",
    season_id: "s1",
    stage: "regular",
    format: "bo3",
    matchday: 1,
    ordinal: 0,
    team_ids: teams,
  };
}

function sample() {
  const world = openingWorld();
  const starters = new Map(world.clubs.map((club) => [club.id, selectStarters(world.players, club.id)]));
  const ai = playSeries({
    careerSeed: 20261123,
    world,
    starters,
    humanClubId: "juniper-rush",
    fixture: fixture("ai-ilo-kst", ["iron-lotus", "kestrel-row"]),
  });
  const human = playSeries({
    careerSeed: 20261123,
    world,
    starters,
    humanClubId: "juniper-rush",
    humanPreset: "starve",
    fixture: fixture("human-jnr-vno", ["juniper-rush", "vanta-owls"]),
  });
  return { games: [...ai.games, ...human.games] };
}

describe("C-R2-8 composition tags", () => {
  it("tags the §6.5.1 recommended lineups as their own names", () => {
    expect(compArchetype(["kerrig", "rhedan", "helvar", "huntress", "saelo"])).toBe("Dive");
    expect(compArchetype(["torun", "brannoch", "ysol", "mirren", "huntress"])).toBe("Peel");
    expect(compArchetype(["tolle", "isra", "helvar", "huntress", "sedge"])).toBe("Poke");
    expect(compArchetype(["brannoch", "rhedan", "kerrig", "helvar", "huntress"])).toBe("Balanced");
  });

  it("keeps hold, hunt, and starve out of archetypes", () => {
    const played = sample();
    for (const game of played.games) {
      expect(TAGS).toContain(game.archetypes.blue);
      expect(TAGS).toContain(game.archetypes.red);
      expect(TACTICS).not.toContain(game.archetypes.blue);
      expect(TACTICS).not.toContain(game.archetypes.red);
    }
  });

  it("records the tactic preset on tactics, beside the composition tag", () => {
    const world = openingWorld();
    const starters = new Map(world.clubs.map((club) => [club.id, selectStarters(world.players, club.id)]));
    const ai = playSeries({
      careerSeed: 20261123,
      world,
      starters,
      humanClubId: "juniper-rush",
      fixture: fixture("ai-ilo-kst", ["iron-lotus", "kestrel-row"]),
    });
    const human = playSeries({
      careerSeed: 20261123,
      world,
      starters,
      humanClubId: "juniper-rush",
      humanPreset: "starve",
      fixture: fixture("human-jnr-vno", ["juniper-rush", "vanta-owls"]),
    });
    expect(ai.games[0]?.tactics).toEqual({ blue: "hold", red: "hunt" });
    expect(human.games[0]?.tactics).toEqual({ blue: "starve", red: "hold" });
    expect(TAGS).toContain(ai.games[0]?.archetypes.blue);
    expect(TAGS).toContain(human.games[0]?.archetypes.blue);
  });
});
