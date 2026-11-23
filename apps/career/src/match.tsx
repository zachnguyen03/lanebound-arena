import { arenaCard, draftPreview, latestMap, loadoutReport, playNextMap, setLoadout, setPreset, skipSeries, winsTarget, ARENA_CARDS, type CareerSession } from "@lanebound/career";
import { useLayoutEffect, useState } from "react";
import { Button } from "./ui/button";

const TACTIC = [
  ["hold", "Hold the Pit"],
  ["hunt", "Hunt"],
  ["starve", "Starve"],
] as const;

const COACH = [
  "Watch the map. Score, zone, and a card when it fires. The three cards stay locked for this series.",
  "Read the recap. Ratings, and which cards fired or expired. Team-fearless: this map cannot repeat the champions from map 1.",
  "The draft is on the screen. Last map's champions stay in the recap.",
  "Hold the Pit, Hunt, or Starve. The plan stays locked until the series ends.",
  "You are the coach now. Tips turn off after this map.",
];

const PANES = [
  ["tactics", "Tactics"],
  ["cards", "Cards"],
  ["draft", "Draft"],
  ["recap", "Recap"],
] as const;

export type MatchPane = (typeof PANES)[number][0];

export function MatchDeck({
  session,
  mode,
  onSession,
  onMode,
}: {
  session: CareerSession;
  mode: MatchPane;
  onSession: (session: CareerSession) => void;
  onMode: (mode: MatchPane) => void;
}) {
  const locked = session.open_games.length > 0;
  const [picked, setPicked] = useState(session.loadout.map((slot) => slot.id));
  const [cardNote, setCardNote] = useState("");
  const report = loadoutReport(picked);
  function toggleCard(id: string) {
    const on = picked.includes(id);
    const next = on ? picked.filter((item) => item !== id) : picked.length < 3 ? [...picked, id] : [...picked.slice(0, 2), id];
    if (next.length === 3 && !loadoutReport(next).ok) {
      setCardNote("That set is over the budget.");
      return;
    }
    setCardNote("");
    setPicked(next);
    if (next.length === 3) onSession(setLoadout(session, next));
  }
  const draft = draftPreview(session);
  const club = session.clubs.find((item) => item.id === session.player_club_id);
  const [hiddenMark, setHiddenMark] = useState<number | null>(null);
  const markIndex = session.maps_played;
  const mark = markIndex >= 1 && markIndex <= 5 && hiddenMark !== markIndex ? COACH[markIndex - 1] : null;
  const coachTarget = markIndex <= 2 ? "recap" : markIndex === 3 ? "draft" : markIndex === 4 ? "tactics" : "play";
  const mapLabel = draft.fixture_id ? `Map ${draft.game_index} of ${seriesMaps(session, draft.fixture_id)}` : "Season complete";

  return (
    <main className="wrap matchdeck" data-screen="match">
      <div className="matchscroll">
      <div className="ch">
        <h2 className="disp">{club?.name}</h2>
        <span className="meta" data-testid="map-label">{mapLabel}</span>
      </div>
      <div className="subtabs" data-testid="match-tabs">
        {PANES.map(([id, label]) => (
          <button key={id} type="button" className={mode === id ? "on" : ""} data-coach-target={id} onClick={() => onMode(id)}>
            {label}
          </button>
        ))}
      </div>
      {mode === "tactics" ? (
          <section className="card" data-screen="tactics">
            <div className="ch">
              <h3>Tactics</h3>
              <span className="meta">{locked ? "Locked for this series" : "Choose a plan"}</span>
            </div>
            <div className="seg" data-testid="tactic-seg">
              {TACTIC.map(([id, label]) => (
                <button key={id} type="button" className={session.human_preset === id ? "on" : ""} disabled={locked} onClick={() => onSession(setPreset(session, id))}>
                  {label}
                </button>
              ))}
            </div>
          </section>
      ) : null}
      {mode === "cards" ? (
          <section className="card" data-screen="cards">
            <div className="ch">
              <h3>Cards</h3>
            </div>
            <div className="cardtop">
              <div className="pickedfaces">
                {picked.map((id) => {
                  const card = arenaCard(id);
                  if (!card) return null;
                  return (
                    <button key={id} type="button" disabled={locked} onClick={() => toggleCard(id)}>
                      <img src={`/cards/${card.id}.png`} alt={card.name} />
                    </button>
                  );
                })}
              </div>
              <span className="meta">
                {report.cost} / 6 points · {report.cards} / 3 cards
              </span>
            </div>
            <div className="pool" data-testid="card-pool">
              {ARENA_CARDS.filter((card) => card.rarity !== "Signature").map((card) => {
                const on = picked.includes(card.id);
                return (
                  <button key={card.id} type="button" className={on ? "on" : ""} disabled={locked} onClick={() => toggleCard(card.id)}>
                    <img src={`/cards/arena/small/${card.id}.png`} alt={card.name} width={120} height={168} />
                  </button>
                );
              })}
            </div>
            {cardNote ? <p className="note">{cardNote}</p> : null}
          </section>
      ) : null}
      {mode === "draft" ? (
          <section className="card" data-screen="draft" data-testid="draft">
            <div className="ch">
              <h3>Draft</h3>
              <span className="meta">{draft.fearless ? "Team-fearless" : "Fearless reset"}</span>
            </div>
            {draft.game_index === 2 ? <p className="note">Map 2 cannot repeat map 1.</p> : null}
            {draft.blue.map((slot) => (
              <div className="dec" key={slot.player_id}>
                <b>
                  {slot.name} · {slot.champion}
                </b>
                <div className="d">{draft.locked_champions.includes(slot.champion) ? "Fearless lock" : "In the pool"}</div>
              </div>
            ))}
          </section>
      ) : null}
      {mode === "recap" ? <Recap session={session} /> : null}
      </div>
      <div className="matchfoot" data-testid="match-footer">
            <Button
              variant="primary"
              data-testid="play-map"
              data-coach-target="play"
              disabled={!draft.fixture_id}
              onClick={() => {
                onSession(playNextMap(session));
                onMode("recap");
              }}
            >
              Play map
            </Button>
            <Button
              variant="secondary"
              data-testid="skip-series"
              disabled={!draft.fixture_id}
              onClick={() => {
                onSession(skipSeries(session));
                onMode("recap");
              }}
            >
              Skip series
            </Button>
      </div>
      {mark ? (
        <CoachMark
          text={`Map ${markIndex} of ${seriesMaps(session, session.open_fixture_id)}. ${mark}`}
          target={coachTarget}
          onClose={() => setHiddenMark(markIndex)}
        />
      ) : null}
    </main>
  );
}

function seriesMaps(session: CareerSession, fixtureId: string | null): number {
  const id = fixtureId ?? session.series[session.series.length - 1]?.fixture_id ?? null;
  const fixture = session.schedule.find((item) => item.id === id);
  return fixture ? winsTarget(fixture.format) * 2 - 1 : 3;
}

function CoachMark({ text, target, onClose }: { text: string; target: string; onClose: () => void }) {
  const [place, setPlace] = useState({ top: 72, left: 24 });
  useLayoutEffect(() => {
    const el = document.querySelector(`[data-coach-target="${target}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = 320;
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16);
    const top = Math.min(rect.bottom + 12, window.innerHeight - 220);
    setPlace({ top, left });
  }, [target, text]);
  return (
    <aside className="coach" data-composed="coach-mark" data-testid="coach-mark" style={{ top: place.top, left: place.left }}>
      <span className="coachcaret" aria-hidden="true" />
      <p>{text}</p>
      <Button variant="secondary" onClick={onClose}>
        Got it
      </Button>
    </aside>
  );
}

function Recap({ session }: { session: CareerSession }) {
  const map = latestMap(session);
  if (!map) {
    return <section className="empty">No map yet.</section>;
  }
  const fixtureId = session.open_fixture_id ?? session.series[session.series.length - 1]?.fixture_id;
  const fixture = session.schedule.find((item) => item.id === fixtureId);
  const blue = session.clubs.find((club) => club.id === fixture?.team_ids[0]);
  const red = session.clubs.find((club) => club.id === fixture?.team_ids[1]);
  const humanSide = fixture?.team_ids[1] === session.player_club_id ? "red" : "blue";
  const maps = fixture ? winsTarget(fixture.format) * 2 - 1 : map.game_index;
  const name = new Map(session.players.map((player) => [player.id, player.name]));
  const sideRows = (side: "blue" | "red") => map.players.filter((player) => player.side === side);
  return (
    <section className="card" data-testid="recap" data-screen="recap-fake">
      <div className="ch">
        <h3>Recap</h3>
        <span className="meta">source: fake</span>
      </div>
      <div className="result" data-testid="result-strip">
        <div className="crest sm blue">{blue?.tag}</div>
        <div>
          <div className="disp">{map.winner === humanSide ? "W" : "L"}</div>
          <div className="meta">
            {map.score_blue}–{map.score_red}
          </div>
          <div className="meta">
            Map {map.game_index} of {maps}
          </div>
        </div>
        <div className="crest sm red">{red?.tag}</div>
      </div>
      <div className="ratecols">
        {(["blue", "red"] as const).map((side) => (
          <table key={side} data-testid={`ratings-${side}`}>
            <tbody>
              <tr>
                <th>{side === "blue" ? blue?.name : red?.name}</th>
                <th className="n">Rating</th>
              </tr>
              {sideRows(side).map((player) => (
                <tr key={player.player_id}>
                  <td>{name.get(player.player_id) ?? player.player_id}</td>
                  <td className="n">{player.rating.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
      {map.cards.map((card, index) => (
        <div className="dec" key={`${card.card_id}-${index}`}>
          <b>{arenaCard(card.card_id)?.name ?? card.card_id}</b>
          <div className="d">
            {card.side === "blue" ? "Blue" : "Red"} · {card.outcome === "fired" ? "Fired" : "Expired"}
          </div>
        </div>
      ))}
    </section>
  );
}
