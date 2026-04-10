export function makeSourceKey(
  source: string,
  fixtureId: number | undefined,
  league: string,
  homeTeamNorm: string,
  awayTeamNorm: string,
  commenceTime: string
): string {
  if (fixtureId) {
    return `${source}|fixture|${fixtureId}`;
  }

  return [
    source.trim().toLowerCase(),
    league.trim().toLowerCase(),
    homeTeamNorm,
    awayTeamNorm,
    new Date(commenceTime).toISOString()
  ].join("|");
}
