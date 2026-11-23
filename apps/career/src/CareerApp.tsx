import { SLOTS } from "@lanebound/match-contract";
import {
  loadSave,
  parseSession,
  selectStarters,
  sessionJson,
  startCareer,
  type CareerSave,
  type CareerSession,
  type Club,
} from "@lanebound/career";
import { useEffect, useState } from "react";
import { readSave, writeSave } from "./save";
import { Button } from "./ui/button";

type Screen = "menu" | "pick" | "home" | "players" | "lineup" | "contracts" | "league" | "bracket" | "fixtures";

type View =
  | { kind: "session"; session: CareerSession }
  | { kind: "season"; save: CareerSave };

const DIFFICULTY = { favourite: "Favourite", mid: "Mid-table", underdog: "Underdog" } as const;
const ROLE = { top: "Top", jungle: "Jungle", mid: "Mid", adc: "ADC", support: "Support" } as const;

function clubName(clubs: readonly Club[], id: string): string {
  return clubs.find((club) => club.id === id)?.name ?? id;
}

function clubTag(clubs: readonly Club[], id: string): string {
  return clubs.find((club) => club.id === id)?.tag ?? id;
}

export function CareerApp() {
  const [screen, setScreen] = useState<Screen>("menu");
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
              className={screen === "league" || screen === "bracket" || screen === "fixtures" ? "tab on" : "tab"}
              onClick={() => setScreen("league")}
            >
              Competitions
            </button>
          </div>
          <div className="sp" />
          <button className="icon-btn" aria-label="Settings" onClick={() => setSettings(true)}>
            Settings
          </button>
          <div className="date">
            Matchday 1 · <b>Bound Circuit</b>
          </div>
          <Button variant="primary" onClick={() => setScreen("fixtures")}>
            Continue ▸
          </Button>
        </header>
      ) : null}

      {screen === "menu" ? (
        <main className="menu" data-screen="menu">
          <div className="card">
            <div className="disp tname">Lanebound</div>
            <p className="note">Bound Circuit. One club. This machine.</p>
            <Button variant="primary" disabled={!hasSave} onClick={() => hasSave && setScreen("home")}>
              Continue ▸
            </Button>
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
        <main className="wrap" data-screen="pick">
          <div className="ch">
            <h2 className="disp">Choose a club</h2>
            <span className="meta">Eight clubs. Juniper Rush is the recommended first save.</span>
          </div>
          <div className="clubs">
            {clubs.length === 0
              ? startCareer("juniper-rush").clubs.map((club) => (
                  <ClubCard key={club.id} club={club} onPick={() => start(club.id)} />
                ))
              : clubs.map((club) => <ClubCard key={club.id} club={club} onPick={() => start(club.id)} />)}
          </div>
        </main>
      ) : null}

      {screen === "home" && mine ? (
        <main className="wrap" data-screen="home">
          <Home clubs={clubs} mine={mine} fixtures={fixtures} standings={standings} players={players} />
        </main>
      ) : null}

      {screen === "players" || screen === "lineup" || screen === "contracts" ? (
        <main className="wrap" data-screen={screen}>
          <div className="sub">
            <Button variant="ghost" className={screen === "players" ? "on" : ""} onClick={() => setScreen("players")}>
              Players
            </Button>
            <Button variant="ghost" className={screen === "lineup" ? "on" : ""} onClick={() => setScreen("lineup")}>
              Lineup
            </Button>
            <Button variant="ghost" className={screen === "contracts" ? "on" : ""} onClick={() => setScreen("contracts")}>
              Contracts
            </Button>
          </div>
          {screen === "players" ? <Players clubs={clubs} players={players} clubId={playerId} /> : null}
          {screen === "lineup" ? <Lineup players={players} clubId={playerId} /> : null}
          {screen === "contracts" ? <Contracts players={players} contracts={contracts} clubId={playerId} /> : null}
        </main>
      ) : null}

      {screen === "league" || screen === "bracket" || screen === "fixtures" ? (
        <main className="wrap" data-screen={screen}>
          <div className="sub">
            <Button variant="ghost" className={screen === "league" ? "on" : ""} onClick={() => setScreen("league")}>
              League
            </Button>
            <Button variant="ghost" className={screen === "bracket" ? "on" : ""} onClick={() => setScreen("bracket")}>
              Bracket
            </Button>
            <Button variant="ghost" className={screen === "fixtures" ? "on" : ""} onClick={() => setScreen("fixtures")}>
              Fixtures
            </Button>
          </div>
          {screen === "league" ? <League clubs={clubs} standings={standings} mine={playerId} /> : null}
          {screen === "bracket" ? <Bracket clubs={clubs} playoff={playoff} /> : null}
          {screen === "fixtures" ? <Fixtures clubs={clubs} fixtures={fixtures} playoff={playoff} /> : null}
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
                  setScreen("pick");
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

function ClubCard({ club, onPick }: { club: Club; onPick: () => void }) {
  return (
    <button
      className={club.recommended_first_save ? "card clubpick on" : "card clubpick"}
      data-testid={`club-${club.id}`}
      onClick={onPick}
    >
      <div className="crest sm">{club.tag}</div>
      <div className="pn">{club.name}</div>
      <div className="note">{DIFFICULTY[club.difficulty]}</div>
      {club.recommended_first_save ? <div className="caps">Recommended</div> : null}
    </button>
  );
}

function Home({
  clubs,
  mine,
  fixtures,
  standings,
  players,
}: {
  clubs: readonly Club[];
  mine: Club;
  fixtures: CareerSession["fixtures"];
  standings: CareerSession["standings"];
  players: CareerSession["players"];
}) {
  const next = fixtures.find((fixture) => fixture.team_ids.includes(mine.id));
  const opponent = next?.team_ids.find((id) => id !== mine.id);
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
          <div className="kick">{next ? `Matchday ${next.matchday} · Best of 3` : "Bound Circuit"}</div>
          <div className="disp vs">VS</div>
          <div className="note">{opponent ? clubName(clubs, opponent) : "Fixture pending"}</div>
        </div>
        <div className="side r">
          <div className="crest">{opponent ? clubTag(clubs, opponent) : "—"}</div>
          <div className="disp tname">{opponent ? clubName(clubs, opponent) : ""}</div>
        </div>
      </section>
      <div className="grid3">
        <section className="card">
          <div className="ch">
            <h3>Saturday lineup</h3>
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
    <table data-testid="league-table">
      <tbody>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th className="n">W–L</th>
          <th className="n">Diff</th>
        </tr>
        {rows.map((row) => (
          <tr key={row.club_id} className={row.finish === 5 ? "cut" : row.club_id === mine ? "me" : ""}>
            <td className="n">{row.finish}</td>
            <td>
              <span className="tm">
                <span className="crest sm">{clubTag(clubs, row.club_id)}</span>
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
    <div className="bracket" data-testid="bracket">
      {slots.map((pair, index) => {
        const fixture = playoff[index];
        const left = fixture ? clubName(clubs, fixture.team_ids[0]) : pair[0];
        const right = fixture ? clubName(clubs, fixture.team_ids[1]) : pair[1];
        return (
          <div className="match" key={pair.join()}>
            <div className="caps">{index === 0 ? "Semifinal · 1 vs 4" : "Semifinal · 2 vs 3"}</div>
            <div>{left}</div>
            <div className="dim">vs</div>
            <div>{right}</div>
          </div>
        );
      })}
      <div className="match">
        <div className="caps">Final</div>
        <div>{playoff[2] ? clubName(clubs, playoff[2].team_ids[0]) : "Winner of 1 vs 4"}</div>
        <div className="dim">vs</div>
        <div>{playoff[2] ? clubName(clubs, playoff[2].team_ids[1]) : "Winner of 2 vs 3"}</div>
      </div>
      {playoff.length === 0 ? <p className="note">Clubs are named after matchday 7.</p> : null}
    </div>
  );
}

function Fixtures({
  clubs,
  fixtures,
  playoff,
}: {
  clubs: readonly Club[];
  fixtures: CareerSession["fixtures"];
  playoff: CareerSession["playoff"];
}) {
  const days = [1, 2, 3, 4, 5, 6, 7];
  return (
    <div data-testid="fixtures">
      {days.map((day) => (
        <section className="card" key={day} style={{ marginBottom: 12 }}>
          <div className="ch">
            <h3>Matchday {day}</h3>
            <span className="meta">Best of 3</span>
          </div>
          {fixtures
            .filter((fixture) => fixture.matchday === day)
            .map((fixture) => (
              <div className="dec" key={fixture.id}>
                <b>
                  {clubName(clubs, fixture.team_ids[0])} vs {clubName(clubs, fixture.team_ids[1])}
                </b>
              </div>
            ))}
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
            <th>Role</th>
            <th>Player</th>
            <th className="n">OVR</th>
          </tr>
          {roster.map((player) => (
            <tr key={player.id}>
              <td>{ROLE[player.primary_slot]}</td>
              <td>{player.name}</td>
              <td className="n">{player.ovr}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
}: {
  players: CareerSession["players"];
  contracts: CareerSession["contracts"];
  clubId: string;
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
            <th>Player</th>
            <th className="n">Years left</th>
            <th>Expiry</th>
          </tr>
          {rows.map((contract) => {
            const player = players.find((item) => item.id === contract.player_id);
            return (
              <tr key={contract.player_id}>
                <td>{player?.name}</td>
                <td className="n">{contract.years_left}</td>
                <td>{contract.years_left === 1 ? "Expires after this season" : `Expires in ${contract.years_left} seasons`}</td>
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
