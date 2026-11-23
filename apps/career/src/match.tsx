import { arenaCard, dismissCoach, draftPreview, latestMap, loadoutReport, playNextMap, setLoadout, setPreset, skipSeries, winsTarget, ARENA_CARDS, type CareerSession } from "@lanebound/career";
import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "./ui/button";

const TACTIC = [
  ["hold", "Hold the Pit", "Occupy and defend the zone; orbs on the way only"],
  ["hunt", "Hunt", "Takedowns and claims; chase until sanctuary / leash"],
  ["starve", "Starve", "Pause ticks, farm orbs and buffs, high commit bar"],
] as const;

const COACH = [
  "Watch the map. Score, zone, and a card when it fires. The three cards stay locked for this series.",
  "Read the recap. Ratings, and which cards fired or expired. Team-fearless: this map cannot repeat the champions from map 1.",
  "The draft is on the screen. Last map's champions stay in the recap.",
  "Hold the Pit, Hunt, or Starve. The plan stays locked until the series ends.",
  "You are the coach now. Tips turn off after this map.",
];

const ROLE = { top: "Top", jungle: "Jungle", mid: "Mid", adc: "ADC", support: "Support" } as const;

const PANES = [
  ["tactics", "Tactics"],
  ["cards", "Cards"],
  ["draft", "Draft"],
  ["recap", "Recap"],
] as const;

export type MatchPane = (typeof PANES)[number][0];

/** Coach step 1–5, and the tab that step belongs on. */
const MARK_TAB: Record<number, MatchPane> = { 1: "recap", 2: "recap", 3: "draft", 4: "tactics", 5: "recap" };

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
  const mapLabel = stepLabel(session, mode);
  const step = session.maps_played;
  const mark =
    step >= 1 && step <= 5 && MARK_TAB[step] === mode && !session.coach_dismissed.includes(step) ? COACH[step - 1] : null;

  return (
    <main className="wrap matchdeck" data-screen="match">
      <div className="matchscroll">
      <div className="ch">
        <h2 className="disp">{club?.name}</h2>
        <span className="meta" data-testid="map-label">{mapLabel}</span>
      </div>
      <div className="subtabs" data-testid="match-tabs">
        {PANES.map(([id, label]) => (
          <button key={id} type="button" className={mode === id ? "on" : ""} onClick={() => onMode(id)}>
            {label}
          </button>
        ))}
      </div>
      {mode === "tactics" ? (
          <section className="card" data-screen="tactics" data-coach-target="tactics">
            <div className="ch">
              <h3 data-coach-avoid="">Tactics</h3>
              <span className="meta">{locked ? "Locked for this series" : "Choose a plan"}</span>
            </div>
            <div className="seg" data-testid="tactic-seg" data-coach-avoid="">
              {TACTIC.map(([id, label]) => (
                <button key={id} type="button" className={session.human_preset === id ? "on" : ""} disabled={locked} onClick={() => onSession(setPreset(session, id))}>
                  {label}
                </button>
              ))}
            </div>
            <p className="note tacticline">{TACTIC.find(([id]) => id === session.human_preset)?.[2]}</p>
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
            <div className="poolwrap">
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
            </div>
            {cardNote ? <p className="note">{cardNote}</p> : null}
          </section>
      ) : null}
      {mode === "draft" ? (
          <section className="card" data-screen="draft" data-testid="draft" data-coach-target="draft">
            <div className="ch">
              <h3>Draft</h3>
              <span className="meta">{draft.fearless ? "Team-fearless" : "Fearless reset"}</span>
            </div>
            <div className="inset">
            {draft.game_index === 2 ? <p className="note">Map 2 cannot repeat map 1.</p> : null}
            <table>
              <tbody>
                <tr data-coach-avoid="">
                  <th>Role</th>
                  <th>Player</th>
                  <th>Champion</th>
                  <th>Status</th>
                </tr>
                {draft.blue.map((slot, index) => (
                  <tr key={slot.player_id} data-coach-avoid={index === 0 ? "" : undefined}>
                    <td>{ROLE[slot.slot as keyof typeof ROLE]}</td>
                    <td>{slot.name}</td>
                    <td>{championName(slot.champion)}</td>
                    <td>{draft.locked_champions.includes(slot.champion) ? "Fearless lock" : "In the pool"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>
      ) : null}
      {mode === "recap" ? <Recap session={session} mapLabel={mapLabel} /> : null}
      </div>
      <div className="matchfoot" data-testid="match-footer">
            <Button
              variant="primary"
              data-testid="play-map"
              data-coach-avoid=""
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
          text={`${mapLabel}. ${mark}`}
          target={mode}
          onClose={() => onSession(dismissCoach(session, step))}
        />
      ) : null}
    </main>
  );
}

function championName(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function seriesMaps(session: CareerSession, fixtureId: string | null): number {
  const id = fixtureId ?? session.series[session.series.length - 1]?.fixture_id ?? null;
  const fixture = session.schedule.find((item) => item.id === id);
  return fixture ? winsTarget(fixture.format) * 2 - 1 : 3;
}

/** Series map index for the step on screen. Recap names the map just played; the other tabs name the map about to be played. */
function stepLabel(session: CareerSession, mode: MatchPane): string {
  if (mode === "recap") {
    const map = latestMap(session);
    if (!map) return "Season complete";
    const fixtureId = session.open_fixture_id ?? session.series[session.series.length - 1]?.fixture_id ?? null;
    return `Map ${map.game_index} of ${seriesMaps(session, fixtureId)}`;
  }
  const draft = draftPreview(session);
  if (!draft.fixture_id) return "Season complete";
  return `Map ${draft.game_index} of ${seriesMaps(session, draft.fixture_id)}`;
}

function CoachMark({ text, target, onClose }: { text: string; target: string; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const [box, setBox] = useState({ top: 88, left: 24, caret: 28, side: false });
  useLayoutEffect(() => {
    const place = () => {
      const anchor = document.querySelector(`[data-coach-target="${target}"]`);
      const mark = ref.current;
      if (!anchor || !mark) return;
      const rect = anchor.getBoundingClientRect();
      const width = 320;
      const height = mark.offsetHeight || 168;
      const footer = document.querySelector("[data-testid='match-footer']")?.getBoundingClientRect();
      const limitBottom = (footer?.top ?? window.innerHeight) - 12;
      const avoid = Array.from(
        document.querySelectorAll("[data-coach-avoid], [data-testid='match-tabs'], [data-testid='match-footer']"),
        (el) => el.getBoundingClientRect(),
      );
      const overlaps = (top: number, left: number) =>
        avoid.some((item) => left < item.right && left + width > item.left && top < item.bottom && top + height > item.top);
      const inside = (top: number, left: number) =>
        left >= 8 && top >= 8 && left + width <= window.innerWidth - 8 && top + height <= limitBottom && !overlaps(top, left);
      const aligned = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16);
      const candidates = [
        { top: rect.bottom + 12, left: aligned, side: false },
        { top: Math.max(16, rect.top), left: rect.right + 12, side: true },
        { top: Math.max(16, limitBottom - height), left: Math.max(16, window.innerWidth - width - 16), side: false },
      ];
      let chosen = candidates.find((item) => inside(item.top, item.left));
      if (!chosen) {
        const right = Math.max(16, window.innerWidth - width - 16);
        let top = limitBottom - height;
        while (top > 16 && !inside(top, right)) top -= 16;
        chosen = inside(top, right)
          ? { top, left: right, side: false }
          : { top: Math.max(16, limitBottom - height), left: right, side: false };
      }
      const caret = chosen.side
        ? Math.min(height - 24, Math.max(16, rect.top + Math.min(rect.height, 48) / 2 - chosen.top - 6))
        : Math.min(width - 24, Math.max(16, rect.left + rect.width / 2 - chosen.left - 6));
      setBox((prev) =>
        prev.top === chosen.top && prev.left === chosen.left && prev.caret === caret && prev.side === chosen.side
          ? prev
          : { top: chosen.top, left: chosen.left, caret, side: chosen.side },
      );
    };
    place();
    const scroller = document.querySelector(".matchscroll");
    scroller?.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    const anchor = document.querySelector(`[data-coach-target="${target}"]`);
    const observer = anchor ? new ResizeObserver(place) : null;
    if (anchor) observer?.observe(anchor);
    return () => {
      scroller?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
      observer?.disconnect();
    };
  }, [target, text]);
  return (
    <aside ref={ref} className="coach" data-composed="coach-mark" data-testid="coach-mark" style={{ top: box.top, left: box.left }}>
      <span className={box.side ? "coachcaret side" : "coachcaret"} style={box.side ? { top: box.caret } : { left: box.caret }} aria-hidden="true" />
      <p>{text}</p>
      <Button variant="secondary" onClick={onClose}>
        Got it
      </Button>
    </aside>
  );
}

function Recap({ session, mapLabel }: { session: CareerSession; mapLabel: string }) {
  const map = latestMap(session);
  if (!map) {
    return <section className="empty">No map yet.</section>;
  }
  const fixtureId = session.open_fixture_id ?? session.series[session.series.length - 1]?.fixture_id;
  const fixture = session.schedule.find((item) => item.id === fixtureId);
  const blue = session.clubs.find((club) => club.id === fixture?.team_ids[0]);
  const red = session.clubs.find((club) => club.id === fixture?.team_ids[1]);
  const humanSide = fixture?.team_ids[1] === session.player_club_id ? "red" : "blue";
  const ourClub = humanSide === "blue" ? blue : red;
  const theirClub = humanSide === "blue" ? red : blue;
  const ourScore = humanSide === "blue" ? map.score_blue : map.score_red;
  const theirScore = humanSide === "blue" ? map.score_red : map.score_blue;
  const name = new Map(session.players.map((player) => [player.id, player.name]));
  const sideRows = (side: "blue" | "red") => map.players.filter((player) => player.side === side);
  const columns = [humanSide, humanSide === "blue" ? "red" : "blue"] as const;
  return (
    <section className="card" data-testid="recap" data-screen="recap-fake" data-coach-target="recap">
      <div className="ch">
        <h3>Recap</h3>
        <span className="meta">source: fake</span>
      </div>
      <div className="result" data-testid="result-strip">
        <div className={`crest sm ${humanSide}`}>{ourClub?.tag}</div>
        <div>
          <div className="disp">{map.winner === humanSide ? "W" : "L"}</div>
          <div className="meta" data-testid="scoreline">
            {ourClub?.tag} {ourScore}–{theirScore} {theirClub?.tag}
          </div>
          <div className="meta">{mapLabel}</div>
        </div>
        <div className={`crest sm ${humanSide === "blue" ? "red" : "blue"}`}>{theirClub?.tag}</div>
      </div>
      <div className="ratecols">
        {columns.map((side) => (
          <table key={side} data-testid={`ratings-${side}`}>
            <tbody>
              <tr data-coach-avoid="">
                <th>{side === humanSide ? ourClub?.name : theirClub?.name}</th>
                <th className="n">Rating</th>
              </tr>
              {sideRows(side).map((player, index) => (
                <tr key={player.player_id} data-coach-avoid={index === 0 ? "" : undefined}>
                  <td>{name.get(player.player_id) ?? player.player_id}</td>
                  <td className="n">{player.rating.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
      <div className="ch cardgap">
        <h3>Cards</h3>
      </div>
      <div className="inset">
        <table data-testid="card-events">
          <tbody>
            <tr data-coach-avoid="">
              <th>Card</th>
              <th>Side</th>
              <th>Status</th>
            </tr>
            {map.cards.map((card, index) => (
              <tr key={`${card.card_id}-${index}`} data-coach-avoid={index === 0 ? "" : undefined}>
                <td>{arenaCard(card.card_id)?.name ?? card.card_id}</td>
                <td>
                  <span className={`sidechip ${card.side}`}>{card.side === "blue" ? "Blue" : "Red"}</span>
                </td>
                <td className={card.outcome === "fired" ? "fired" : "expired"}>{card.outcome === "fired" ? "Fired" : "Expired"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
