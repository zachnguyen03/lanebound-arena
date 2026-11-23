/** GDD §8.1 club promises, C-R2-7. Missing ids render no line. */
export const CLUB_PROMISE: Readonly<Record<string, string>> = {
  "iron-lotus": "Win this year, or close.",
  "juniper-rush": "Build toward a title in three to five seasons.",
  "kestrel-row": "A long climb, first title around season six or seven.",
  "hanok-wolves": "Contend from day one, with Neon Tide in the way.",
  "neon-tide": "A title team, if you can get past the Wolves.",
  "vanta-owls": "Close to the top. Beat Iron Lotus and people listen.",
  "sable-comets": "A steady climb, with Juniper Rush as the yardstick.",
  glasswing: "A long climb. Start by beating Kestrel Row.",
};

export function clubPromise(clubId: string): string | undefined {
  const line = CLUB_PROMISE[clubId];
  if (!line) return undefined;
  return line;
}
