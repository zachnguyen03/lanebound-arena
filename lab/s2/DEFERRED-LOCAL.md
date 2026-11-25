# S2 deferred notes (build-owned, not verifier suite)

Official `tests/acceptance/s2/DEFERRED.md` stays byte-identical to **S2 acceptance v6**
(`sha256 52557931b7dd322c5e76bbf4b4a87fb40a5f7138a6378ca61fd5b7d45550840c`).
Build agents do not edit verifier-owned acceptance files.

## Peel lab measurement on tip `7685c53`

On tip **`7685c53`**, the even-OVR 400-seed peel lab measured **0 of 1200** dives with
`peeler_perceived === true`. Constructed preview rates are not a measurement of the
even lab. Official suite keeps the 400-seed constructed preview as
`it.skip` with reason `deferred to post-game polish (Anh 19:30)` (see official
`DEFERRED.md`).
