import type {
  TennisApiProvider,
  Rankings,
  LiveMatches,
  CompetitorProfile,
  HeadToHeadData,
  Player,
  RankingEntry,
  Match,
  Tournament,
  MatchSummary
} from "../types";

import {
  loadAtpPlayers,
  loadAtpRankings,
  loadAtpRankingsForYear,
  loadAtpRankingsMultiYear,
  getAvailableRankingYears,
  loadAtpMatches,
  getCurrentRankings,
  getRankingsByDate,
  getAvailableRankingDates,
  formatDate,
  parseDate,
  normalizeCountryCode,
  parseMatchStats,
  analyzeSurfacePerformance,
  analyzeTournamentLevels,
  getTournamentLevelName,
  type AtpPlayer,
  type AtpRanking,
  type AtpMatch
} from "../../utils/csv-parser";

export class LocalDatasetProvider implements TennisApiProvider {
  private playersCache: AtpPlayer[] | null = null;
  private rankingsCache: AtpRanking[] | null = null;
  private matchesCache: Map<number, AtpMatch[]> = new Map();
  private dataPath: string;

  constructor(dataPath = './data') {
    this.dataPath = dataPath;
  }

  private getPlayers(): AtpPlayer[] {
    if (!this.playersCache) {
      this.playersCache = loadAtpPlayers(this.dataPath);
    }
    return this.playersCache;
  }

  private getRankingsData(): AtpRanking[] {
    if (!this.rankingsCache) {
      this.rankingsCache = loadAtpRankings(this.dataPath);
    }
    return this.rankingsCache;
  }

  private getMatches(year: number): AtpMatch[] {
    if (!this.matchesCache.has(year)) {
      const matches = loadAtpMatches(year, this.dataPath);
      this.matchesCache.set(year, matches);
    }
    return this.matchesCache.get(year) || [];
  }

  getAvailableRankingDates(): string[] {
    const allRankings = this.getRankingsData();
    return getAvailableRankingDates(allRankings);
  }

  getAvailableRankingYears(): number[] {
    return getAvailableRankingYears(this.dataPath);
  }

  getRankingsForYear(year: number): AtpRanking[] {
    return loadAtpRankingsForYear(year, this.dataPath);
  }

  // Parse tennis score string into period_scores format
  private parseMatchScore(scoreString: string): any[] {
    if (!scoreString || scoreString.trim() === '') {
      return [];
    }

    // Split score by spaces to get individual sets
    // Examples: "7-6(5) 6-4", "6-4 7-6(0)", "6-3 7-5"
    const sets = scoreString.trim().split(' ').filter(set => set.length > 0);

    return sets.map((set, index) => {
      // Parse individual set score like "7-6(5)" or "6-4"
      const tiebreakMatch = set.match(/(\d+)-(\d+)\((\d+)\)/);
      const regularMatch = set.match(/(\d+)-(\d+)/);

      if (tiebreakMatch) {
        const [, score1, score2, tiebreak1] = tiebreakMatch;
        const winnerScore = parseInt(score1);
        const loserScore = parseInt(score2);
        const winnerTiebreak = parseInt(tiebreak1);

        // Determine loser's tiebreak score
        let loserTiebreak = 0;
        if (winnerTiebreak >= 7) {
          // Standard tiebreak win (7-0 to 7-6, or higher like 10-8)
          loserTiebreak = winnerTiebreak < 10 ? Math.max(0, winnerTiebreak - 2) : winnerTiebreak - 2;
        }

        return {
          number: index + 1,
          home_score: winnerScore, // Winner is always home in our structure
          away_score: loserScore,  // Loser is always away
          home_tiebreak_score: winnerTiebreak,
          away_tiebreak_score: loserTiebreak
        };
      } else if (regularMatch) {
        const [, score1, score2] = regularMatch;
        const winnerScore = parseInt(score1);
        const loserScore = parseInt(score2);

        return {
          number: index + 1,
          home_score: winnerScore, // Winner is always home
          away_score: loserScore   // Loser is always away
        };
      }

      return {
        number: index + 1,
        home_score: 0,
        away_score: 0
      };
    });
  }

  private findPlayerById(playerId: string): AtpPlayer | undefined {
    return this.getPlayers().find(p => p.player_id === playerId);
  }

  private transformAtpPlayerToPlayer(atpPlayer: AtpPlayer): Player {
    const fullName = `${atpPlayer.name_first} ${atpPlayer.name_last}`.trim();

    return {
      id: atpPlayer.player_id,
      name: fullName,
      nationality: atpPlayer.ioc,
      countryCode: normalizeCountryCode(atpPlayer.ioc),
      abbreviation: `${atpPlayer.name_first.charAt(0)}${atpPlayer.name_last.charAt(0)}`.toUpperCase()
    };
  }

  private transformAtpRankingToRankingEntry(ranking: AtpRanking, player: AtpPlayer): RankingEntry {
    return {
      rank: parseInt(ranking.rank.toString()),
      player: this.transformAtpPlayerToPlayer(player),
      points: parseInt(ranking.points.toString()),
      movement: 0, // Dataset doesn't include movement data
      competitionsPlayed: undefined // Dataset doesn't include this data
    };
  }

  private parseScore(scoreStr: string): Match['score'] | undefined {
    if (!scoreStr || scoreStr === '') return undefined;

    const sets: Array<{ player1: number; player2: number }> = [];

    // Handle different score formats: "6-4 6-3", "7-6(5) 6-4", "6-4 3-6 6-2"
    const setParts = scoreStr.split(' ').filter(part => part.trim());

    for (const setPart of setParts) {
      // Remove tiebreak scores for set parsing (keep for later enhancement)
      const cleanSet = setPart.replace(/\(\d+\)/, '');

      if (cleanSet.includes('-')) {
        const [p1, p2] = cleanSet.split('-');
        const player1Score = parseInt(p1);
        const player2Score = parseInt(p2);

        if (!isNaN(player1Score) && !isNaN(player2Score)) {
          sets.push({ player1: player1Score, player2: player2Score });
        }
      }
    }

    return sets.length > 0 ? { sets } : undefined;
  }

  private determineTournamentCategory(tourneyLevel: string, tourneyName: string): Tournament['category'] {
    const level = tourneyLevel.toUpperCase();
    const name = tourneyName.toLowerCase();

    if (level === 'M' || name.includes('masters') || level === 'F') return 'ATP';
    if (level === 'C' || name.includes('challenger')) return 'Challenger';
    if (name.includes('wta')) return 'WTA';
    return 'ATP'; // Default to ATP
  }

  private determineSurface(surface: string): Tournament['surface'] {
    const s = surface.toLowerCase();
    if (s.includes('hard')) return 'Hard';
    if (s.includes('clay')) return 'Clay';
    if (s.includes('grass')) return 'Grass';
    if (s.includes('indoor')) return 'Indoor';
    return 'Hard'; // Default
  }

  private transformAtpMatchToMatch(atpMatch: AtpMatch): Match {
    const winner = this.findPlayerById(atpMatch.winner_id);
    const loser = this.findPlayerById(atpMatch.loser_id);

    const winnerPlayer: Player = winner
      ? this.transformAtpPlayerToPlayer(winner)
      : {
          id: atpMatch.winner_id,
          name: atpMatch.winner_name,
          nationality: atpMatch.winner_ioc,
          countryCode: normalizeCountryCode(atpMatch.winner_ioc)
        };

    const loserPlayer: Player = loser
      ? this.transformAtpPlayerToPlayer(loser)
      : {
          id: atpMatch.loser_id,
          name: atpMatch.loser_name,
          nationality: atpMatch.loser_ioc,
          countryCode: normalizeCountryCode(atpMatch.loser_ioc)
        };

    const tournament: Tournament = {
      id: atpMatch.tourney_id,
      name: atpMatch.tourney_name,
      category: this.determineTournamentCategory(atpMatch.tourney_level, atpMatch.tourney_name),
      surface: this.determineSurface(atpMatch.surface),
      location: 'Unknown Location', // Dataset doesn't include location
      startDate: formatDate(atpMatch.tourney_date),
      endDate: formatDate(atpMatch.tourney_date)
    };

    return {
      id: `${atpMatch.tourney_id}_${atpMatch.match_num}`,
      tournament,
      round: atpMatch.round,
      status: 'completed', // All matches in dataset are completed
      players: [winnerPlayer, loserPlayer], // Winner first for completed matches
      score: this.parseScore(atpMatch.score),
      startTime: formatDate(atpMatch.tourney_date)
    };
  }

  async getRankings(type: "ATP" | "WTA", limit?: number, date?: string): Promise<Rankings> {
    // Dataset only has ATP rankings, return empty for WTA
    if (type === "WTA") {
      return {
        type: "WTA",
        rankings: [],
        lastUpdated: new Date().toISOString(),
        week: undefined,
        year: new Date().getFullYear()
      };
    }

    const allRankings = this.getRankingsData();
    const targetRankings = date ? getRankingsByDate(allRankings, date) : getCurrentRankings(allRankings);
    const players = this.getPlayers();

    const limitedRankings = limit ? targetRankings.slice(0, limit) : targetRankings;
    const transformedRankings: RankingEntry[] = limitedRankings
      .map(ranking => {
        const player = players.find(p => p.player_id === ranking.player);
        if (!player) {
          // Create a placeholder player if not found
          return {
            rank: parseInt(ranking.rank.toString()),
            player: {
              id: ranking.player,
              name: `Player ${ranking.player}`,
              nationality: 'Unknown',
              countryCode: 'XX'
            },
            points: parseInt(ranking.points.toString()),
            movement: 0
          };
        }
        return this.transformAtpRankingToRankingEntry(ranking, player);
      })
      .filter(entry => entry !== null);

    // Get the latest ranking date for metadata
    const latestDate = targetRankings.length > 0 ? targetRankings[0].ranking_date : '';
    const year = latestDate ? parseInt(latestDate.slice(0, 4)) : new Date().getFullYear();

    return {
      type: "ATP",
      rankings: transformedRankings,
      lastUpdated: latestDate ? formatDate(latestDate) : new Date().toISOString(),
      week: undefined, // Could be calculated from date if needed
      year
    };
  }

  async getLiveMatches(): Promise<LiveMatches> {
    // Dataset has no live matches, return empty
    return {
      matches: [],
      lastUpdated: new Date().toISOString()
    };
  }

  async getTodayMatches(): Promise<LiveMatches> {
    const today = new Date().toISOString().split('T')[0];
    return this.getMatchesByDate(today);
  }

  async getMatchesByDate(date: string): Promise<LiveMatches> {
    const targetDate = parseDate(date);
    const year = parseInt(date.slice(0, 4));

    const matches = this.getMatches(year);
    const dayMatches = matches.filter(match => match.tourney_date === targetDate);

    const transformedMatches = dayMatches.map(match => this.transformAtpMatchToMatch(match));

    return {
      matches: transformedMatches,
      lastUpdated: new Date().toISOString()
    };
  }

  async getCompetitorProfile(competitorId: string): Promise<CompetitorProfile> {
    const player = this.findPlayerById(competitorId);

    if (!player) {
      throw new Error(`Player not found: ${competitorId}`);
    }

    // Get current ranking if available
    const rankings = getCurrentRankings(this.getRankingsData());
    const currentRanking = rankings.find(r => r.player === competitorId);

    // Get player's match history for statistical analysis
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];

    const allMatches: AtpMatch[] = [];
    for (const year of years) {
      const yearMatches = this.getMatches(year);
      const playerMatches = yearMatches.filter(match =>
        match.winner_id === competitorId || match.loser_id === competitorId
      );
      allMatches.push(...playerMatches);
    }

    // Calculate surface and tournament level performance
    const surfacePerformance = analyzeSurfacePerformance(allMatches, competitorId);
    const tournamentLevelPerformance = analyzeTournamentLevels(allMatches, competitorId);

    // Calculate overall win-loss record
    const totalWins = allMatches.filter(match => match.winner_id === competitorId).length;
    const totalLosses = allMatches.filter(match => match.loser_id === competitorId).length;
    const winPercentage = totalWins + totalLosses > 0 ? (totalWins / (totalWins + totalLosses)) * 100 : 0;

    // Find highest ranking achieved (lowest number is best)
    let highestRanking = currentRanking ? parseInt(currentRanking.rank.toString()) : undefined;
    let highestRankingDate = undefined;

    // Check historical rankings for better ranking
    const allPlayerRankings = this.getRankingsData().filter(r => r.player === competitorId);
    if (allPlayerRankings.length > 0) {
      const bestRankingEntry = allPlayerRankings.reduce((best, current) => {
        const currentRank = parseInt(current.rank.toString());
        const bestRank = parseInt(best.rank.toString());
        return currentRank < bestRank ? current : best;
      });
      highestRanking = parseInt(bestRankingEntry.rank.toString());
      highestRankingDate = formatDate(bestRankingEntry.ranking_date);
    }

    // Calculate age from date of birth
    let age = undefined;
    if (player.dob && player.dob.length === 8) {
      const birthDate = new Date(
        parseInt(player.dob.slice(0, 4)),
        parseInt(player.dob.slice(4, 6)) - 1,
        parseInt(player.dob.slice(6, 8))
      );
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      if (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())) {
        age--;
      }
    }

    // Create periods data with surface statistics
    const periods = Object.entries(surfacePerformance).map(([surfaceType, stats]) => ({
      year: currentYear, // Simplified - could be more detailed
      surfaces: [{
        type: surfaceType.toLowerCase() as any,
        statistics: {
          competitions_played: stats.totalMatches,
          competitions_won: tournamentLevelPerformance['Grand Slam']?.titles || 0,
          matches_played: stats.totalMatches,
          matches_won: stats.wins
        }
      }]
    }));

    const profile: CompetitorProfile = {
      id: player.player_id,
      name: `${player.name_first} ${player.name_last}`,
      abbreviation: `${player.name_first.charAt(0)}${player.name_last.charAt(0)}`.toUpperCase(),
      country: player.ioc,
      country_code: normalizeCountryCode(player.ioc),
      gender: "male", // Dataset is ATP (male) only
      virtual: false,
      info: {
        date_of_birth: player.dob ? formatDate(player.dob) : undefined,
        handedness: player.hand === 'R' ? 'right' : player.hand === 'L' ? 'left' : undefined,
        height: player.height ? parseInt(player.height) : undefined,
        weight: undefined, // Not available in dataset
        highest_doubles_ranking: undefined, // Could be calculated if we had doubles data
        highest_doubles_ranking_date: undefined,
        highest_singles_ranking: highestRanking,
        highest_singles_ranking_date: highestRankingDate,
        pro_year: undefined, // Could be estimated from first match
        // Additional derived stats
        age: age,
        career_win_loss: {
          wins: totalWins,
          losses: totalLosses,
          win_percentage: Math.round(winPercentage * 100) / 100
        },
        surface_performance: surfacePerformance,
        tournament_level_performance: tournamentLevelPerformance,
        total_career_titles: Object.values(tournamentLevelPerformance)
          .reduce((total, level) => total + (level.titles || 0), 0)
      } as any,
      competitor_rankings: currentRanking ? [{
        competitions_played: undefined,
        competitor_id: competitorId,
        movement: 0,
        name: "ATP Singles",
        points: parseInt(currentRanking.points.toString()),
        race_ranking: false,
        rank: parseInt(currentRanking.rank.toString()),
        type: "singles"
      }] : [],
      periods
    };

    return profile;
  }

  async getHeadToHead(competitor1Id: string, competitor2Id: string): Promise<HeadToHeadData> {
    const player1 = this.findPlayerById(competitor1Id);
    const player2 = this.findPlayerById(competitor2Id);

    if (!player1 || !player2) {
      throw new Error(`One or both players not found: ${competitor1Id}, ${competitor2Id}`);
    }

    // Search for matches between these players in recent years
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];

    const allMatches: AtpMatch[] = [];
    for (const year of years) {
      const yearMatches = this.getMatches(year);
      allMatches.push(...yearMatches);
    }

    // Find matches between these two players
    const headToHeadMatches = allMatches.filter(match =>
      (match.winner_id === competitor1Id && match.loser_id === competitor2Id) ||
      (match.winner_id === competitor2Id && match.loser_id === competitor1Id)
    );

    // Sort by date (most recent first)
    headToHeadMatches.sort((a, b) => b.tourney_date.localeCompare(a.tourney_date));

    // Transform to MatchSummary format (simplified)
    const lastMeetings: MatchSummary[] = headToHeadMatches.map(match => ({
      id: `${match.tourney_id}_${match.match_num}`,
      sport_event: {
        id: `${match.tourney_id}_${match.match_num}`,
        start_time: formatDate(match.tourney_date),
        competitors: [
          {
            id: match.winner_id,
            name: match.winner_name,
            country: match.winner_ioc,
            country_code: normalizeCountryCode(match.winner_ioc),
            qualifier: "home" as const
          },
          {
            id: match.loser_id,
            name: match.loser_name,
            country: match.loser_ioc,
            country_code: normalizeCountryCode(match.loser_ioc),
            qualifier: "away" as const
          }
        ],
        sport_event_context: {
          competition: {
            id: match.tourney_id,
            name: match.tourney_name,
            level: match.tourney_level,
            type: "singles"
          },
          round: {
            name: match.round
          },
          season: {
            id: match.tourney_date.slice(0, 4),
            name: match.tourney_date.slice(0, 4),
            year: match.tourney_date.slice(0, 4)
          }
        }
      },
      sport_event_status: {
        status: "ended",
        match_status: "ended",
        home_score: 0,
        away_score: 0,
        winner_id: match.winner_id,
        period_scores: this.parseMatchScore(match.score)
      }
    }));

    return {
      competitors: [
        {
          id: player1.player_id,
          name: `${player1.name_first} ${player1.name_last}`,
          country: player1.ioc,
          country_code: normalizeCountryCode(player1.ioc),
          gender: "male"
        },
        {
          id: player2.player_id,
          name: `${player2.name_first} ${player2.name_last}`,
          country: player2.ioc,
          country_code: normalizeCountryCode(player2.ioc),
          gender: "male"
        }
      ],
      last_meetings: lastMeetings,
      next_meetings: [], // No future matches in historical dataset
      generated_at: new Date().toISOString()
    };
  }

  // Clear cache method for testing/debugging
  clearCache(): void {
    this.playersCache = null;
    this.rankingsCache = null;
    this.matchesCache.clear();
  }

  async getCompetitionsByCategory(categoryId: string): Promise<any> {
    // For ATP data, we'll extract unique tournaments from our match data
    const currentYear = new Date().getFullYear();
    const matches2024 = this.getMatches(currentYear);
    const matches2023 = this.getMatches(currentYear - 1);

    // Combine recent matches to get tournament list
    const allMatches = [...matches2024, ...matches2023];

    // Extract unique tournaments
    const tournamentMap = new Map<string, any>();

    allMatches.forEach(match => {
      if (!tournamentMap.has(match.tourney_id)) {
        const level = getTournamentLevelName(match.tourney_level);
        tournamentMap.set(match.tourney_id, {
          id: match.tourney_id,
          name: match.tourney_name,
          gender: "men" as const, // ATP is men's tennis
          level: match.tourney_level,
          level_name: level,
          type: "singles" as const,
          surface: match.surface,
          date: formatDate(match.tourney_date)
        });
      }
    });

    // Convert to array and sort by importance (Grand Slams first, then Masters, etc.)
    const tournaments = Array.from(tournamentMap.values()).sort((a, b) => {
      const levelOrder: Record<string, number> = {
        'G': 1, // Grand Slam
        'M': 2, // Masters 1000
        'F': 3, // ATP Finals
        'A': 4, // ATP 500/250
        'C': 5, // Challenger
        'D': 6  // Davis Cup
      };

      const aOrder = levelOrder[a.level] || 7;
      const bOrder = levelOrder[b.level] || 7;

      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      // If same level, sort by name
      return a.name.localeCompare(b.name);
    });

    return {
      competitions: tournaments,
      lastUpdated: new Date().toISOString()
    };
  }

  // Get cache statistics
  getCacheStats(): { players: number; rankings: number; matchYears: number[] } {
    return {
      players: this.playersCache?.length || 0,
      rankings: this.rankingsCache?.length || 0,
      matchYears: Array.from(this.matchesCache.keys())
    };
  }
}