export function makeSourceKey(source, eventId, league, homeTeamNorm, awayTeamNorm, commenceTime, bookmaker) {
    if (eventId) {
        return `${source}|event|${eventId}|${bookmaker.toLowerCase()}`;
    }
    return [
        source.trim().toLowerCase(),
        league.trim().toLowerCase(),
        homeTeamNorm,
        awayTeamNorm,
        new Date(commenceTime).toISOString(),
        bookmaker.trim().toLowerCase()
    ].join("|");
}
