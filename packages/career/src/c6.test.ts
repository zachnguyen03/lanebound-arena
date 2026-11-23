import { describe, expect, it } from "vitest";
import { advanceSeason, chooseSignature, skipSeries } from "./play.js";
import { seasonPointTotal } from "./points.js";
import { startCareer } from "./session.js";

function finishYear(clubId: string) {
  let session = startCareer(clubId);
  for (let guard = 0; guard < 40; guard++) {
    try {
      session = skipSeries(session);
    } catch {
      break;
    }
  }
  return session;
}

describe("C6 awards and signatures", () => {
  it("lets the human club keep the signature it already holds", () => {
    let session = finishYear("iron-lotus");
    const pending = session.pending_signature;
    expect(pending).not.toBeNull();
    const held = pending!.held;
    session = chooseSignature(session, "keep");
    expect(session.pending_signature).toBeNull();
    const player = session.players.find((item) => item.id === pending!.player_id);
    expect(player?.signature_archive).toEqual([held]);
    const before = session.contracts.map((contract) => contract.years_left);
    session = advanceSeason(session);
    expect(session.contracts.reduce((sum, contract) => sum + contract.years_left, 0)).toBeLessThan(before.reduce((sum, years) => sum + years, 0));
    expect(session.club_state.reduce((sum, club) => sum + club.points, 0)).toBe(seasonPointTotal());
    expect(session.awards.map((award) => award.kind)).toEqual(["split_mvp", "deadeye", "shepherd", "zonekeeper", "finals_mvp"]);
  });

  it("replaces the held signature when the club says replace", () => {
    let session = finishYear("iron-lotus");
    const pending = session.pending_signature!;
    session = chooseSignature(session, "replace");
    const player = session.players.find((item) => item.id === pending.player_id);
    expect(player?.signature_archive).toEqual([pending.incoming]);
  });
});
