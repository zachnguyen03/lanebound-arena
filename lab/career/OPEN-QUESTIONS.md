# Open questions

Binding inputs, both hashes checked:

- `lanebound-career-meta-gdd-v1.md` v1.1.3, sha256 `4575e2540e16f75bf4e6233fb8f76cd738243a25571d9e21e3181084044059fa`
- `career-plan-v1.md`, sha256 `b175c2340b7cc5534cfdab987772c7a962ab8d7d123fae45ec3066003da22140`

Nothing below was treated as a rule. Where the season still needs a number, the assumption is named in `lab/career/REPORT.md` and in the code comment next to the constant.

1. **Opening world.** C-R2-3 replaces the invented stand-in with the paper model's `opening_world(random.Random(20261123))`, frozen in `packages/career/data/opening-world-20261123.json`. The dump script is `lab/career/dump-opening-world.py` and is not part of the runtime. Ids are `standin-{pid}` and names are the model's `P####` placeholders, with `shippable: false`, until GD-15. The old `P0001`–`P0080` sequence and `standin-{tag}-{slot}-{depth}` ids are gone.

2. **§14.5 distributions that the GDD does not finish.** Inverse-CDF endpoints, the sudden-death "reached 10" split, tiebreak score weights other than the coin-flip 10–9 case, the score-part noise, role weights, claim totals, and the shrunk `z`. The engineering plan says to freeze a recipe in the C0 report. Those recipes are assumptions, not rulings.

3. **Card budget.** No card catalogue or point costs were in the sources. This slice does not enforce the 6-point / 1-Signature loadout cap, and it does not invent a cost table. Loadouts are three `NONSHIPPABLE-card-*` placeholders. Card identity does not move `team_strength` (C-R-3).

4. **AI draft and tactics.** C-R-3 defines the strength formula, not who picks the tactic. Build-spec draft utility was not in the inputs. The runner's Hold-only tactics and mastery-ordered picks are assumptions.

5. **Placement points.** §7.2 marks the 12–1 table and the +12 / +7 / +4 playoff bonuses as a proposal Anh has not confirmed, and also says v1 still writes them. This slice writes that table. It does not invent a per-map point row. Points and the Glicko triple are on the save's ranking log. They were not added as required `career-match/1` fields, because §14's `SeriesResult` / `MatchResult` do not have them and C-R says not to break §14.

6. **Signatures for Deadeye, Shepherd, and Zonekeeper.** C-R-6 names signatures only for Split MVP (*Pillar of the Split*) and Finals MVP (*Finals Poise*). C-R-7 gives the final's starters *Convergence Crown* only. No other signature is granted.

7. **Several signatures on one player at season end.** C-R-6's "keep the new one" does not say the order when Pillar, Crown, and Finals Poise land together. The order used here is an assumption.

8. **Series MVP ties.** §14.4 says highest mean rating. C-R-6 adds tie-breaks for Finals MVP. Every series MVP uses those tie-breaks so the final's `mvp_player_id` is the Finals MVP. That extension beyond the final is an assumption.

9. **Glicko non-competitors.** Glickman 2013 step 6 inflates RD when a player sits out. C-R-8 says idle clubs stay unchanged, so that step is not applied. The published example is only the three-game update.

10. **Wage on screen.** C-R-9 keeps wage in the data. Anh's roster note hides it in the UI. There is no UI in this slice.
