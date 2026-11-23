import { arenaCard, draftPreview, latestMap, loadoutReport, playNextMap, setLoadout, setPreset, skipSeries, ARENA_CARDS, type CareerSession } from "@lanebound/career";
import { useLayoutEffect, useState } from "react";
import { Button } from "./ui/button";

const TACTIC = [
  ["hold", "Hold the Pit"],
  ["hunt", "Hunt"],
  ["starve", "Starve"],
] as const;

const COACH = [
  "Watch the map. Score, zone, and a card when it fires. The three cards stay locked for this series.",
  "Read the recap. Ratings, and which cards fired or expired. Team-fearless: this map cannot repeat the champions from game 1.",
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
  const draft = draftPreview(session);
  const club = session.clubs.find((item) => item.id === session.player_club_id);
  const map = latestMap(session);
  const [hiddenMark, setHiddenMark] = useState<number | null>(null);
  const markIndex = session.maps_played;
  const mark = markIndex >= 1 && markIndex <= 5 && hiddenMark !== markIndex ? COACH[markIndex - 1] : null;
  const coachTarget = markIndex <= 2 ? "recap" : markIndex === 3 ? "draft" : markIndex === 4 ? "tactics" : "play";

  return (
    <main className="wrap matchdeck" data-screen="match">
      <div className="matchscroll">
      <div className="ch">
        <h2 className="disp">{club?.name}</h2>
        <span className="meta">{draft.fixture_id ? `Game ${draft.game_index}` : "Season complete"}</span>
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
            <div className="row">
              {TACTIC.map(([id, label]) => (
                <Button
                  key={id}
                  variant="secondary"
                  disabled={locked}
                  onClick={() => onSession(setPreset(session, id))}
                >
                  {label}
                </Button>
              ))}
            </div>
          </section>
      ) : null}
      {mode === "cards" ? (
          <section className="card" data-screen="cards">
            <div className="ch">
              <h3>Cards</h3>
              <span className="meta">
                {report.cost} / 6 points · {report.cards} / 3 cards
              </span>
            </div>
            <div className="faces">
              {ARENA_CARDS.map((card) => {
                const on = picked.includes(card.id);
                return (
                  <button
                    key={card.id}
                    className={on ? "card clubpick on" : "card clubpick"}
                    disabled={locked}
                    onClick={() => {
                      const next = on ? picked.filter((id) => id !== card.id) : picked.length < 3 ? [...picked, card.id] : [...picked.slice(0, 2), card.id];
                      if (next.length === 3 && !loadoutReport(next).ok) {
                        setCardNote("That set is over the budget.");
                        return;
                      }
                      setCardNote("");
                      setPicked(next);
                      if (next.length === 3) onSession(setLoadout(session, next));
                    }}
                  >
                    <img src={`/cards/${card.id}.png`} alt={card.name} width={120} height={168} />
                    <div className="pn">{card.name}</div>
                    <div className="note">
                      {card.cost} {card.rarity}
                    </div>
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
            {draft.game_index === 2 ? <p className="note">Game 2 cannot repeat game 1.</p> : null}
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
      {mode === "recap" ? <Recap map={map} players={session.players} /> : null}
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
      {mark ? <CoachMark text={`Map ${markIndex}. ${mark}`} target={coachTarget} onClose={() => setHiddenMark(markIndex)} /> : null}
    </main>
  );
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

function Recap({ map, players }: { map: ReturnType<typeof latestMap>; players: CareerSession["players"] }) {
  if (!map) {
    return <section className="empty">No map yet.</section>;
  }
  const name = new Map(players.map((player) => [player.id, player.name]));
  return (
    <section className="card" data-testid="recap" data-screen="recap-fake">
      <div className="ch">
        <h3>Recap</h3>
        <span className="meta">
          source: fake · {map.score_blue}–{map.score_red}
        </span>
      </div>
      <table>
        <tbody>
          <tr>
            <th>Player</th>
            <th className="n">Rating</th>
          </tr>
          {map.players.map((player) => (
            <tr key={player.player_id}>
              <td>{name.get(player.player_id) ?? player.player_id}</td>
              <td className="n">{player.rating.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
