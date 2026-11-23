# C-R2-8 mapping mutation

Swapping the Dive and Peel target mixes in `packages/career/src/archetype.ts` makes `compArchetype(["kerrig", "rhedan", "helvar", "huntress", "saelo"])` return `Peel`.

`npx vitest run packages/career/src/archetype.test.ts` then exited 1:

`expected 'Peel' to be 'Dive'`

The file was restored. The same test exits 0 on the restored mapping.
