import { SLOTS } from "@lanebound/match-contract";
import {
  advanceSeason,
  arenaCard,
  chooseSignature,
  loadSave,
  parseSession,
  selectStarters,
  sessionJson,
  startCareer,
  type CareerSave,
  type CareerSession,
  type Club,
} from "@lanebound/career";
import { useEffect, useRef, useState } from "react";
import { MatchDeck } from "./match";
import { clubPromise } from "./promises";
import { readSave, writeSave } from "./save";
import { Button } from "./ui/button";

type Screen = "menu" | "pick" | "home" | "players" | "lineup" | "contracts" | "league" | "bracket" | "fixtures" | "recap" | "cards" | "tactics" | "draft" | "awards";

type View =
  | { kind: "session"; session: CareerSession }
  | { kind: "season"; save: CareerSave };

const DIFFICULTY = { favourite: "Favourite", mid: "Mid", underdog: "Underdog" } as const;
const ROLE = { top: "Top", jungle: "Jungle", mid: "Mid", adc: "ADC", support: "Support" } as const;

function clubName(clubs: readonly Club[], id: string): string {
  return clubs.find((club) => club.id === id)?.name ?? id;
}

function clubTag(clubs: readonly Club[], id: string): string {
  return clubs.find((club) => club.id === id)?.tag ?? id;
}

export function CareerApp() {
  const [screen, setScreenState] = useState<Screen>("menu");
  const screenRef = useRef<Screen>("menu");

  function setScreen(next: Screen) {
    screenRef.current = next;
    setScreenState(next);
    const state = history.state as { app?: string; screen?: Screen; guard?: boolean } | null;
    if (state?.app === "career" && state.screen === next && !state.guard) return;
    history.pushState({ app: "career", screen: next }, "");
  }

  useEffect(() => {
    history.replaceState({ app: "career", guard: true }, "");
    history.pushState({ app: "career", screen: "menu" }, "");
    const onPop = (event: PopStateEvent) => {
      const next = event.state as { app?: string; screen?: Screen; guard?: boolean } | null;
      if (!next || next.app !== "career" || next.guard || !next.screen) {
        history.pushState({ app: "career", screen: screenRef.current }, "");
        return;
      }
      screenRef.current = next.screen;
      setScreenState(next.screen);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [picked, setPicked] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [hasSave, setHasSave] = useState(false);
  const [settings, setSettings] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    readSave()
      .then((json) => {
        if (!json) return;
        try {
          setView({ kind: "session", session: parseSession(JSON.parse(json)) });
          setHasSave(true);
        } catch {
          setRejected(json);
        }
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (view?.kind !== "session") return;
    const json = sessionJson(view.session);
    writeSave(json).then(() => setHasSave(true));
  }, [view]);

  function acceptText(text: string) {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      setRejected(text);
      return;
    }
    const record = value as { session_version?: unknown };
    try {
      if (record && record.session_version === 1) {
        setView({ kind: "session", session: parseSession(value) });
        setRejected(null);
        setScreen("home");
        return;
      }
      const save = loadSave(text);
      setView({ kind: "season", save });
      setRejected(null);
      setScreen("home");
    } catch {
      setRejected(text);
    }
  }

  function start(clubId: string) {
    setView({ kind: "session", session: startCareer(clubId) });
    setScreen("home");
  }

  const clubs = view?.kind === "session" ? view.session.clubs : view?.save.clubs ?? [];
  const playerId = view?.kind === "session" ? view.session.player_club_id : view?.save.player_club_id ?? "";
  const standings = view?.kind === "session" ? view.session.standings : view?.save.standings ?? [];
  const fixtures = view?.kind === "session" ? view.session.fixtures : view?.save.regular_fixtures ?? [];
  const playoff = view?.kind === "session" ? view.session.playoff : view?.save.playoff_fixtures ?? [];
  const players = view?.kind === "session" ? view.session.players : view?.save.players ?? [];
  const contracts = view?.kind === "session" ? view.session.contracts : view?.save.contracts ?? [];
  const mine = clubs.find((club) => club.id === playerId);
  const session = view?.kind === "session" ? view.session : null;
  const played = new Set(
    (session ? session.series : view?.kind === "season" ? view.save.series : []).map((item) => item.fixture_id).filter((id): id is string => typeof id === "string"),
  );
  const nextFixture = session
    ? session.schedule.find((fixture) => fixture.id === session.open_fixture_id) ?? session.schedule.find((fixture) => !played.has(fixture.id))
    : undefined;
  const dayLabel = nextFixture ? `Matchday ${nextFixture.matchday}` : view ? "Season complete" : "Matchday 1";
  const saveSummary = mine && view ? `${mine.name} · ${dayLabel}` : null;

  if (!ready) {
    return (
      <div className="menu">
        <p className="dim">Loading career</p>
      </div>
    );
  }

  return (
    <>
      {screen !== "menu" && screen !== "pick" ? (
        <header className="top" data-composed="trimmed-nav">
          <div className="wm">
            LANE<i>/</i>BOUND
          </div>
          <div className="tabs">
            <button className={screen === "home" ? "tab on" : "tab"} onClick={() => setScreen("home")}>
              Home
            </button>
            <button
              className={screen === "players" || screen === "lineup" || screen === "contracts" ? "tab on" : "tab"}
              onClick={() => setScreen("players")}
            >
              Squad
            </button>
            <button
              className={screen === "league" || screen === "bracket" || screen === "fixtures" || screen === "awards" ? "tab on" : "tab"}
              onClick={() => setScreen("league")}
            >
              Competitions
            </button>
          </div>
          <div className="sp" />
          <button className="icon-btn" aria-label="Settings" onClick={() => setSettings(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
            </svg>
          </button>
          <div className="date">
            {dayLabel} · <b>Bound Circuit</b>
          </div>
          <Button
            variant={
              screen === "tactics" ||
              screen === "cards" ||
              screen === "draft" ||
              screen === "recap" ||
              (screen === "awards" && Boolean(session && session.awards.length > 0 && !session.pending_signature && !session.advanced))
                ? "secondary"
                : "primary"
            }
            onClick={() => setScreen("tactics")}
          >
            Continue ▸
          </Button>
        </header>
      ) : null}

      {screen === "menu" ? (
        <main className="menu" data-screen="menu">
          <div className="card">
            <div className="disp tname">Lanebound</div>
            <p className="note">Bound Circuit</p>
            <Button variant="primary" disabled={!hasSave} onClick={() => hasSave && setScreen("home")}>
              Continue ▸
            </Button>
            {hasSave && saveSummary ? <p className="note">{saveSummary}</p> : null}
            <Button
              variant="secondary"
              onClick={() => {
                setScreen("pick");
              }}
            >
              New career
            </Button>
          </div>
        </main>
      ) : null}

      {screen === "pick" ? (
        <main className="wrap pick" data-screen="pick">
          <div className="ch">
            <h2 className="disp">Choose a club</h2>
            <span className="meta">Eight clubs. Juniper Rush is the recommended first save.</span>
          </div>
          <div className="clubs">
            {(clubs.length === 0 ? startCareer("juniper-rush").clubs : clubs).map((club) => (
              <ClubCard key={club.id} club={club} selected={picked === club.id} onPick={() => setPicked(club.id)} />
            ))}
          </div>
          <div className="pickbar">
            <Button variant="primary" disabled={!picked} onClick={() => picked && start(picked)}>
              Start career
            </Button>
          </div>
        </main>
      ) : null}

      {session && (screen === "recap" || screen === "cards" || screen === "tactics" || screen === "draft") ? (
        <MatchDeck
          session={session}
          mode={screen}
          onSession={(next) => setView({ kind: "session", session: next })}
          onMode={setScreen}
        />
      ) : null}

      {screen === "home" && mine ? (
        <main className="wrap" data-screen="home">
          <Home clubs={clubs} mine={mine} fixtures={fixtures} standings={standings} players={players} played={played} />
        </main>
      ) : null}

      {screen === "players" || screen === "lineup" || screen === "contracts" ? (
        <main className="wrap" data-screen={screen}>
          <SubTabs
            current={screen}
            onPick={setScreen}
            tabs={[
              { id: "players", label: "Players" },
              { id: "lineup", label: "Lineup" },
              { id: "contracts", label: "Contracts" },
            ]}
          />
          {screen === "players" ? <Players clubs={clubs} players={players} clubId={playerId} /> : null}
          {screen === "lineup" ? <Lineup players={players} clubId={playerId} /> : null}
          {screen === "contracts" ? (
            <Contracts players={players} contracts={contracts} clubId={playerId} seasonIndex={session ? (session.advanced ? 2 : 1) : 2} />
          ) : null}
        </main>
      ) : null}

      {screen === "league" || screen === "bracket" || screen === "fixtures" || screen === "awards" ? (
        <main className="wrap" data-screen={screen}>
          <SubTabs
            current={screen}
            onPick={setScreen}
            tabs={[
              { id: "league", label: "League" },
              { id: "bracket", label: "Bracket" },
              { id: "fixtures", label: "Fixtures" },
              { id: "awards", label: "Awards" },
            ]}
          />
          {screen === "league" ? (
            <section className="card">
              <div className="ch">
                <h3>Bound Circuit</h3>
                <span className="meta">Top 4 to the bracket</span>
              </div>
              <League clubs={clubs} standings={standings} mine={playerId} />
            </section>
          ) : null}
          {screen === "bracket" ? <Bracket clubs={clubs} playoff={playoff} /> : null}
          {screen === "fixtures" ? (
            <Fixtures clubs={clubs} fixtures={fixtures} playoff={playoff} mine={playerId} played={played} />
          ) : null}
          {screen === "awards" ? (
            <Awards
              awards={session ? session.awards : view?.kind === "season" ? view.save.awards : []}
              players={players}
              clubs={clubs}
              clubId={playerId}
              series={session ? session.series : view?.kind === "season" ? view.save.series : []}
              advanced={session?.advanced ?? true}
              canAdvance={Boolean(session && session.awards.length > 0 && !session.pending_signature && !session.advanced)}
              onAdvance={() => {
                if (!session) return;
                setView({ kind: "session", session: advanceSeason(session) });
              }}
            />
          ) : null}
        </main>
      ) : null}

      {settings ? (
        <div className="overlay" data-overlay="settings">
          <div className="card">
            <h2 className="disp">Settings</h2>
            <p className="note">The career stays on this machine. Export the save, or import one.</p>
            <div className="row">
              <Button
                variant="primary"
                onClick={() => {
                  if (view?.kind === "session") download("lanebound-career.json", sessionJson(view.session));
                  if (view?.kind === "season") download("lanebound-career.json", JSON.stringify(view.save));
                }}
              >
                Export save
              </Button>
              <label className="btn btn-secondary">
                Import save
                <input
                  className="file"
                  type="file"
                  accept="application/json"
                  data-testid="import-file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    file.text().then((text) => {
                      acceptText(text);
                      setSettings(false);
                    });
                  }}
                />
              </label>
              <Button
                variant="ghost"
                onClick={() => {
                  setSettings(false);
                  setPicked(null);
                  setScreen("pick");
                  // The second click of a double-click would land on the club card that sat under this button.
                  window.addEventListener(
                    "click",
                    function swallow(event) {
                      window.removeEventListener("click", swallow, true);
                      if (event.detail > 1) {
                        event.stopPropagation();
                        event.preventDefault();
                      }
                    },
                    true,
                  );
                }}
              >
                New career
              </Button>
              <Button variant="ghost" onClick={() => setSettings(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {session?.pending_signature ? (
        <div className="overlay" data-overlay="signature" data-composed="signature-choice">
          <div className="card">
            <h2 className="disp">Signature</h2>
            <div className="sigfaces">
              <img src={`/cards/arena/small/${session.pending_signature.held}.png`} alt={arenaCard(session.pending_signature.held)?.name ?? ""} width={120} height={168} />
              <img src={`/cards/arena/small/${session.pending_signature.incoming}.png`} alt={arenaCard(session.pending_signature.incoming)?.name ?? ""} width={120} height={168} />
            </div>
            <p>
              {players.find((player) => player.id === session.pending_signature?.player_id)?.name} holds{" "}
              <b data-testid="held-signature">{arenaCard(session.pending_signature.held)?.name}</b>.{" "}
              {arenaCard(session.pending_signature.incoming)?.name} is offered.
            </p>
            <p className="note">The other card leaves the archive.</p>
            <div className="row">
              <Button variant="secondary" onClick={() => setView({ kind: "session", session: chooseSignature(session, "keep") })}>
                Keep {arenaCard(session.pending_signature.held)?.name}
              </Button>
              <Button variant="secondary" onClick={() => setView({ kind: "session", session: chooseSignature(session, "replace") })}>
                Take {arenaCard(session.pending_signature.incoming)?.name}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {rejected !== null ? (
        <div className="overlay" data-screen="state-error-save" data-overlay="error">
          <div className="card">
            <h2 className="disp">Save could not be read</h2>
            <p className="note">This file is not a career save. Nothing was replaced.</p>
            <div className="row">
              <label className="btn btn-primary">
                Try again
                <input
                  className="file"
                  type="file"
                  accept="application/json"
                  data-testid="retry-file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    file.text().then(acceptText);
                  }}
                />
              </label>
              <Button variant="secondary" onClick={() => download("lanebound-career-rejected.json", rejected)}>
                Download save file
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setRejected(null);
                  if (!view) setScreen("menu");
                }}
              >
                Keep playing unsaved
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ClubCard({ club, selected, onPick }: { club: Club; selected: boolean; onPick: () => void }) {
  const promise = clubPromise(club.id);
  return (
    <button
      className={`card clubpick${club.recommended_first_save ? " rec" : ""}${selected ? " on" : ""}`}
      data-testid={`club-${club.id}`}
      onClick={onPick}
    >
      <div className="crest sm">{club.tag}</div>
      <div className="pn">{club.name}</div>
      <span className="pillwrap">
        <span className="pill">{DIFFICULTY[club.difficulty]}</span>
      </span>
      {promise ? <div className="note">{promise}</div> : null}
      {club.recommended_first_save ? <div className="caps">Recommended</div> : null}
    </button>
  );
}

function SubTabs({
  tabs,
  current,
  onPick,
}: {
  tabs: readonly { id: Screen; label: string }[];
  current: Screen;
  onPick: (id: Screen) => void;
}) {
  return (
    <div className="subtabs">
      {tabs.map((tab) => (
        <button key={tab.id} type="button" className={current === tab.id ? "on" : ""} onClick={() => onPick(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function Home({
  clubs,
  mine,
  fixtures,
  standings,
  players,
  played,
}: {
  clubs: readonly Club[];
  mine: Club;
  fixtures: CareerSession["fixtures"];
  standings: CareerSession["standings"];
  players: CareerSession["players"];
  played: Set<string>;
}) {
  const upcoming = fixtures.filter((fixture) => fixture.team_ids.includes(mine.id) && !played.has(fixture.id)).slice(0, 3);
  const next = upcoming[0];
  const side = next && next.team_ids[0] === mine.id ? "Blue" : "Red";
  const opponentId = next?.team_ids.find((id) => id !== mine.id);
  const opponent = clubs.find((club) => club.id === opponentId);
  const opponentSide = side === "Blue" ? "red" : "blue";
  const starters = selectStarters(players, mine.id);
  return (
    <>
      <section className="hero">
        <div className="side">
          <div className="crest">{mine.tag}</div>
          <div>
            <div className="disp tname">{mine.name}</div>
            <div className="note">{DIFFICULTY[mine.difficulty]}</div>
          </div>
        </div>
        <div className="mid">
          <div className="kick">{next ? "Best of 3" : "Bound Circuit"}</div>
          <div className="disp vs">VS</div>
          <div className="note">
            {next ? (
              <>
                Matchday {next.matchday} · <span className={side === "Blue" ? "blue" : "red"}>{side} side</span>
              </>
            ) : (
              "Fixture pending"
            )}
          </div>
        </div>
        <div className="side r">
          {opponent ? (
            <>
              <div className={`crest ${opponentSide}`}>{opponent.tag}</div>
              <div>
                <div className="disp tname">{opponent.name}</div>
              </div>
            </>
          ) : null}
        </div>
      </section>
      <div className="grid3">
        <section className="card">
          <div className="ch">
            <h3>{next ? `Matchday ${next.matchday} lineup` : "Lineup"}</h3>
            <span className="meta">{starters.length} starters</span>
          </div>
          {starters.map((player, index) => (
            <div className="ros" key={player.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr 48px", padding: "10px 18px" }}>
              <div className="role">{ROLE[SLOTS[index]!]}</div>
              <div className="pn">{player.name}</div>
              <div className="mono">{player.ovr}</div>
            </div>
          ))}
        </section>
        <section className="card">
          <div className="ch">
            <h3>Bound Circuit</h3>
            <span className="meta">Top 4 to the bracket</span>
          </div>
          <League clubs={clubs} standings={standings} mine={mine.id} />
        </section>
        <section className="card">
          <div className="ch">
            <h3>Next fixtures</h3>
          </div>
          <div className="next3">
            {upcoming.map((fixture) => {
              const other = fixture.team_ids.find((id) => id !== mine.id) ?? fixture.team_ids[1];
              const ours = fixture.team_ids[0] === mine.id ? "blue" : "red";
              const theirs = ours === "blue" ? "red" : "blue";
              return (
                <div className="tm" key={fixture.id}>
                  <span className="dim">MD {fixture.matchday}</span>
                  <span className={`crest xs ${ours}`}>{mine.tag}</span>
                  <span className="dim">vs</span>
                  <span className={`crest xs ${theirs}`}>{clubTag(clubs, other)}</span>
                  <span>{clubTag(clubs, other)}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

function League({
  clubs,
  standings,
  mine,
}: {
  clubs: readonly Club[];
  standings: CareerSession["standings"];
  mine: string;
}) {
  const rows = [...standings].sort((a, b) => a.finish - b.finish);
  return (
    <table className="board" data-testid="league-table">
      <tbody>
        <tr>
          <th>Team</th>
          <th className="n">W–L</th>
          <th className="n">Diff</th>
        </tr>
        {rows.map((row) => (
          <tr key={row.club_id} className={[row.finish === 5 ? "cut" : "", row.club_id === mine ? "me" : ""].filter(Boolean).join(" ")}>
            <td>
              <span className="tm">
                <span className="mono">{row.finish}</span>
                <span className="crest xs">{clubTag(clubs, row.club_id)}</span>
                {clubName(clubs, row.club_id)}
              </span>
            </td>
            <td className="n">
              {row.series_wins}–{row.series_losses}
            </td>
            <td className="n dim">{row.map_diff > 0 ? `+${row.map_diff}` : row.map_diff}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Bracket({ clubs, playoff }: { clubs: readonly Club[]; playoff: CareerSession["playoff"] }) {
  const slots = [
    ["Seed 1", "Seed 4"],
    ["Seed 2", "Seed 3"],
  ];
  return (
    <div data-testid="bracket">
      <div className="bracket">
        <div className="semis">
          {slots.map((pair, index) => {
            const fixture = playoff[index];
            const left = fixture ? clubName(clubs, fixture.team_ids[0]) : pair[0];
            const right = fixture ? clubName(clubs, fixture.team_ids[1]) : pair[1];
            return (
              <div className="match" key={pair.join()}>
                <div className="caps">
                  {index === 0 ? "Semifinal · 1 vs 4" : "Semifinal · 2 vs 3"} <span className="pill">Bo5</span>
                </div>
                <div>{left}</div>
                <div className="dim">vs</div>
                <div>{right}</div>
              </div>
            );
          })}
        </div>
        <div className="bridge" />
        <div className="match">
          <div className="caps">
            Final <span className="pill">Bo5</span>
          </div>
          <div>{playoff[2] ? clubName(clubs, playoff[2].team_ids[0]) : "Winner of 1 vs 4"}</div>
          <div className="dim">vs</div>
          <div>{playoff[2] ? clubName(clubs, playoff[2].team_ids[1]) : "Winner of 2 vs 3"}</div>
        </div>
      </div>
      {playoff.length === 0 ? <p className="note">Clubs are named after matchday 7.</p> : null}
    </div>
  );
}

function Fixtures({
  clubs,
  fixtures,
  playoff,
  mine,
  played,
}: {
  clubs: readonly Club[];
  fixtures: CareerSession["fixtures"];
  playoff: CareerSession["playoff"];
  mine: string;
  played: Set<string>;
}) {
  const days = [1, 2, 3, 4, 5, 6, 7];
  const current = fixtures.find((fixture) => !played.has(fixture.id))?.matchday ?? 1;
  return (
    <div className="days" data-testid="fixtures">
      {days.map((day) => (
        <section className={day === current ? "card now" : "card"} key={day}>
          <div className="ch">
            <h3>Matchday {day}</h3>
            {day === current ? <span className="pill">Next</span> : <span className="meta">Best of 3</span>}
          </div>
          <table>
            <tbody>
              {fixtures
                .filter((fixture) => fixture.matchday === day)
                .map((fixture) => (
                  <tr key={fixture.id} className={fixture.team_ids.includes(mine) ? "me" : ""}>
                    <td>
                      <span className="tm">
                        <span className="crest xs blue">{clubTag(clubs, fixture.team_ids[0])}</span>
                        <span>{clubTag(clubs, fixture.team_ids[0])}</span>
                        <span className="dim">vs</span>
                        <span className="crest xs red">{clubTag(clubs, fixture.team_ids[1])}</span>
                        <span>{clubTag(clubs, fixture.team_ids[1])}</span>
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ))}
      <p className="note">
        {playoff.length === 0
          ? "Playoff days open after matchday 7. Semifinals are 1 vs 4 and 2 vs 3, then the final."
          : `${playoff.length} playoff series.`}
      </p>
    </div>
  );
}

function Players({
  clubs,
  players,
  clubId,
}: {
  clubs: readonly Club[];
  players: CareerSession["players"];
  clubId: string;
}) {
  const roster = players.filter((player) => player.club_id === clubId);
  return (
    <section className="card">
      <div className="ch">
        <h3>{clubName(clubs, clubId)}</h3>
        <span className="meta">
          {roster.length} in the squad. A roster holds 8–12.
        </span>
      </div>
      <table>
        <tbody>
          <tr>
            <th className="rolecol">Role</th>
            <th>Player</th>
            <th className="n">OVR</th>
          </tr>
          {roster.map((player) => (
            <tr key={player.id}>
              <td className="rolecol">{ROLE[player.primary_slot]}</td>
              <td>{player.name}</td>
              <td className="n">{player.ovr}</td>
              <td data-testid={`signature-${player.id}`}>{arenaCard(player.signature_archive[0] ?? "")?.name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="card" data-composed="split-stub">
        <div className="ch">
          <h3>Training focus</h3>
        </div>
        <p className="note splitline">Opens after the first Split</p>
      </section>
    </section>
  );
}

const AWARD_NAME = {
  split_mvp: "Split MVP",
  finals_mvp: "Finals MVP",
  zonekeeper: "Zonekeeper",
  deadeye: "Deadeye",
  shepherd: "Shepherd",
} as const;

function Awards({
  awards,
  players,
  clubs,
  clubId,
  series,
  advanced,
  canAdvance,
  onAdvance,
}: {
  awards: CareerSession["awards"];
  players: CareerSession["players"];
  clubs: readonly Club[];
  clubId: string;
  series: CareerSession["series"];
  advanced: boolean;
  canAdvance: boolean;
  onAdvance: () => void;
}) {
  if (awards.length === 0) {
    return (
      <section className="empty" data-screen="state-empty-awards" data-testid="awards-empty">
        <div className="caps">Not announced yet</div>
        <p>Awards come after the final.</p>
        <p className="note">Split MVP, Finals MVP, Zonekeeper, Deadeye, and Shepherd.</p>
      </section>
    );
  }
  const final = series.find((item) => item.stage === "final");
  const winner = clubs.find((club) => club.id === final?.winner_team_id);
  const blue = clubs.find((club) => club.id === final?.team_ids[0]);
  const red = clubs.find((club) => club.id === final?.team_ids[1]);
  return (
    <section className="card" data-testid="awards" data-screen="awards">
      <div className="ch">
        <h3>Awards</h3>
        <span className="meta">
          {final && blue && red ? `${blue.name} ${final.series_score[0]}–${final.series_score[1]} ${red.name}` : winner ? `${winner.name} won the final` : ""}
        </span>
      </div>
      <table>
        <tbody>
          <tr>
            <th>Award</th>
            <th>Player</th>
            <th>Club</th>
          </tr>
          {awards.map((award) => {
            const player = players.find((item) => item.id === award.player_id);
            return (
              <tr key={award.kind} className={player?.club_id === clubId ? "me" : ""}>
                <td>{AWARD_NAME[award.kind]}</td>
                <td>{player?.name}</td>
                <td>{clubName(clubs, player?.club_id ?? "")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {canAdvance ? (
        <div className="awardbar">
          <Button variant="primary" data-testid="advance-season" onClick={onAdvance}>
            Advance season
          </Button>
        </div>
      ) : null}
      {advanced ? <p className="note awardbar">Contracts carried into next season.</p> : null}
    </section>
  );
}

function Lineup({ players, clubId }: { players: CareerSession["players"]; clubId: string }) {
  const roster = players.filter((player) => player.club_id === clubId);
  const starters = selectStarters(players, clubId);
  return (
    <section className="card" data-testid="lineup">
      <div className="ch">
        <h3>Lineup</h3>
        <span className="meta">Highest in-slot overall. Off-slot starts are allowed.</span>
      </div>
      {starters.map((player, index) => {
        const slot = SLOTS[index]!;
        const off = player.primary_slot !== slot;
        return (
          <div className="dec" key={player.id}>
            <b>
              {ROLE[slot]} · {player.name}
            </b>
            <div className="d">{off ? "Off slot" : "In slot"} · OVR {player.ovr}</div>
          </div>
        );
      })}
      <p className="note">
        {roster.length} in the squad, {roster.length - starters.length} outside the five.
      </p>
    </section>
  );
}

function Contracts({
  players,
  contracts,
  clubId,
  seasonIndex,
}: {
  players: CareerSession["players"];
  contracts: CareerSession["contracts"];
  clubId: string;
  seasonIndex: number;
}) {
  const ids = new Set(players.filter((player) => player.club_id === clubId).map((player) => player.id));
  const rows = contracts.filter((contract) => ids.has(contract.player_id));
  return (
    <section className="card" data-testid="contracts">
      <div className="ch">
        <h3>Contracts</h3>
        <span className="meta">Length and expiry</span>
      </div>
      <table>
        <tbody>
          <tr>
            <th className="rolecol">Role</th>
            <th>Player</th>
            <th className="n">Years left</th>
            <th>Expiry</th>
          </tr>
          {rows.map((contract) => {
            const player = players.find((item) => item.id === contract.player_id);
            return (
              <tr key={contract.player_id}>
                <td className="rolecol">{player ? ROLE[player.primary_slot] : ""}</td>
                <td>{player?.name}</td>
                <td className="n">{contract.years_left}</td>
                <td>End of S{seasonIndex + contract.years_left - 1}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
