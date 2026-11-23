# Appendix R #2 (23 Nov 2026) — additive acceptance tests

These files drop in next to the original S1 suite. **Do not edit the original suite** except, with Anh's permission, to delete the superseded tests listed below.

| file | what |
|---|---|
| `13-gd-rulings.test.ts` | Every ruling in Appendix R #2 (build spec L1895–1905): Break-on-owner for all five passives, OQ-2 same-tick vs next-tick, fear and hex movement, cone and line body-radius edges, clamp / full-length lines, AUTO_WINDUP and missile 18, time-stop own timer and Lock budget, SEPARATION_STRENGTH / SCRIPTED_ARRIVE_R. |
| `kiln-cured-ruled.test.ts` | Replacement for the AMBIGUOUS block of `kiln-cured.test.ts`. Asserts reading A (Break on Mirren) and that Break on the victim or the attacker does **not** turn the amp off. Also the OQ-2 same-tick / next-tick / own-packet cases. |

## Superseded tests in `kiln-cured.test.ts`

Delete **only** these two, and only with Anh's permission. They assert the rejected readings and will fail a correct sim.

Describe block: `Kiln-Cured — AMBIGUOUS: whose Break? (needs GD ruling, see README OQ-1)`

1. `[Reading B — Break on the HEXED TARGET] amp is off`
2. `[Reading C — Break on the ATTACKER whose packet is amped] amp is off`

Leave in place:

- The whole `Kiln-Cured — unambiguous (spec L743, L397)` describe (ten tests). Still correct.
- `[Reading A — Break on MIRREN (the passive's owner)] amp is off; the hex itself still lands` — this is the binding reading. It is now duplicated by `kiln-cured-ruled.test.ts`. Keep or delete as a duplicate; it is **not** wrong.
- `[sanity, all readings] with NO Break the same scenario is amped ×1.12` — still correct; also duplicated in the unambiguous block and in the new file.
