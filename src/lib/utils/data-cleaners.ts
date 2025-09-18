// Data cleaning utilities for tennis match data
// import type { EnhancedMatch, EnhancedPlayer, EnhancedTournament } from '../api/enhanced-types';

export interface DataCleaningOptions {
  fillMissingData?: boolean;
  validateScores?: boolean;
  normalizeName?: boolean;
  defaultLocation?: string;
}

export class TennisDataCleaner {
  private static instance: TennisDataCleaner;

  static getInstance(): TennisDataCleaner {
    if (!TennisDataCleaner.instance) {
      TennisDataCleaner.instance = new TennisDataCleaner();
    }
    return TennisDataCleaner.instance;
  }

  // Clean and normalize match data
  cleanMatch(rawMatch: any, options: DataCleaningOptions = {}): any {
    const defaultOptions: DataCleaningOptions = {
      fillMissingData: true,
      validateScores: true,
      normalizeName: true,
      defaultLocation: 'Unknown Location',
      ...options
    };

    return {
      id: this.cleanString(rawMatch.id) || this.generateMatchId(),
      tournament: this.cleanTournament(rawMatch.tournament, defaultOptions),
      round: this.cleanString(rawMatch.round) || 'Round 1',
      status: this.normalizeStatus(rawMatch.status),
      players: this.cleanPlayers(rawMatch.players, defaultOptions),
      score: this.cleanScore(rawMatch.score, defaultOptions),
      startTime: this.cleanTimestamp(rawMatch.startTime),
      endTime: this.cleanTimestamp(rawMatch.endTime),
      court: this.cleanString(rawMatch.court),
      liveIndicators: rawMatch.liveIndicators || {}
    };
  }

  // Clean tournament data
  private cleanTournament(tournament: any, options: DataCleaningOptions): any {
    if (!tournament) {
      return this.createDefaultTournament(options.defaultLocation || 'Unknown Location');
    }

    return {
      id: this.cleanString(tournament.id) || 'unknown-tournament',
      name: this.cleanTournamentName(tournament.name),
      category: this.normalizeCategory(tournament.category),
      surface: this.normalizeSurface(tournament.surface),
      location: this.cleanLocation(tournament.location, tournament.city, tournament.country, options.defaultLocation),
      city: this.cleanString(tournament.city),
      country: this.cleanString(tournament.country),
      startDate: this.cleanTimestamp(tournament.startDate),
      endDate: this.cleanTimestamp(tournament.endDate),
      level: tournament.level || this.inferTournamentLevel(tournament.category, tournament.name)
    };
  }

  // Clean location with fallbacks
  private cleanLocation(location?: string, city?: string, country?: string, fallback?: string): string {
    // Try to build location from city and country
    if (city && country) {
      return `${city.trim()}, ${country.trim()}`;
    }

    if (city) {
      return city.trim();
    }

    if (country) {
      return country.trim();
    }

    // Clean existing location
    if (location) {
      const cleaned = location.trim();

      // Handle cases like ", • Hard" or "• Hard"
      if (cleaned.startsWith(',') || cleaned.startsWith('•') || cleaned === '') {
        return fallback || 'Unknown Location';
      }

      // Remove surface information if it got mixed in
      return cleaned.replace(/\s*•\s*(Hard|Clay|Grass|Indoor|Carpet).*$/i, '').trim() || fallback || 'Unknown Location';
    }

    return fallback || 'Unknown Location';
  }

  // Clean tournament name
  private cleanTournamentName(name?: string): string {
    if (!name) return 'Unknown Tournament';

    let cleaned = name.trim();

    // Fix common truncation issues
    const truncationFixes = {
      'rounament': 'tournament',
      'tournamen': 'tournament',
      'tourname': 'tournament name',
      'champio': 'championship',
      'masters ser': 'masters series',
      'grand sl': 'grand slam'
    };

    Object.entries(truncationFixes).forEach(([broken, fixed]) => {
      if (cleaned.toLowerCase().includes(broken)) {
        cleaned = cleaned.replace(new RegExp(broken, 'gi'), fixed);
      }
    });

    // If still looks truncated, add indicator
    if (cleaned.length < 5 || cleaned.endsWith(' ') || /[a-z]$/.test(cleaned.slice(-3))) {
      if (!cleaned.includes('Tournament') && !cleaned.includes('Championship') && !cleaned.includes('Open')) {
        cleaned += ' Tournament';
      }
    }

    return cleaned;
  }

  // Clean player data
  private cleanPlayers(players: any[], options: DataCleaningOptions): any[] {
    if (!players || !Array.isArray(players) || players.length !== 2) {
      return this.createDefaultPlayers();
    }

    return players.map((player, index) => this.cleanPlayer(player, index + 1, options));
  }

  private cleanPlayer(player: any, playerNumber: number, options: DataCleaningOptions): any {
    if (!player) {
      return this.createDefaultPlayer(playerNumber);
    }

    return {
      id: this.cleanString(player.id) || `player-${playerNumber}`,
      name: this.cleanPlayerName(player.name, playerNumber, options.normalizeName),
      nationality: this.cleanNationality(player.nationality, player.country),
      countryCode: this.cleanCountryCode(player.countryCode, player.country_code, player.nationality),
      abbreviation: this.cleanString(player.abbreviation),
      ranking: this.cleanRanking(player.ranking),
      age: this.cleanNumber(player.age),
      height: this.cleanNumber(player.height),
      weight: this.cleanNumber(player.weight),
      handedness: this.normalizeHandedness(player.handedness),
      seedNumber: this.cleanNumber(player.seedNumber)
    };
  }

  // Clean player name
  private cleanPlayerName(name?: string, playerNumber?: number, normalize = true): string {
    if (!name || name.trim() === '' || name === '-') {
      return `Player ${playerNumber || 'Unknown'}`;
    }

    let cleaned = name.trim();

    // Handle flag emoji or unknown symbols
    cleaned = cleaned.replace(/🏳️|❓|�/g, '').trim();

    if (normalize) {
      // Normalize "Last, First" format to "First Last"
      if (cleaned.includes(', ') && !cleaned.includes('Jr.') && !cleaned.includes('Sr.')) {
        const [last, first] = cleaned.split(', ');
        if (first && last) {
          cleaned = `${first.trim()} ${last.trim()}`;
        }
      }
    }

    return cleaned || `Player ${playerNumber || 'Unknown'}`;
  }

  // Clean nationality
  private cleanNationality(nationality?: string, country?: string): string {
    const value = nationality || country;

    if (!value || value.trim() === '' || value === 'Neutral' || value === 'N/A' || value === '🏳️') {
      return 'Unknown';
    }

    return value.trim();
  }

  // Clean country code
  private cleanCountryCode(countryCode?: string, altCode?: string, nationality?: string): string {
    let code = countryCode || altCode;

    // Handle common invalid codes
    if (!code || code === 'Neutral' || code === 'N/A' || code === 'XX' || code.includes('🏳️')) {
      // Try to infer from nationality
      if (nationality) {
        code = this.inferCountryCode(nationality);
      }
    }

    // Validate format (should be 2 uppercase letters)
    if (code && /^[A-Z]{2}$/.test(code)) {
      return code;
    }

    return 'XX'; // Default for unknown/invalid codes
  }

  // Infer country code from nationality
  private inferCountryCode(nationality: string): string {
    const countryMap: Record<string, string> = {
      'Great Britain': 'GB',
      'United Kingdom': 'GB',
      'England': 'GB',
      'Scotland': 'GB',
      'Wales': 'GB',
      'United States': 'US',
      'USA': 'US',
      'America': 'US',
      'Czechia': 'CZ',
      'Czech Republic': 'CZ',
      'Russia': 'RU',
      'Russian Federation': 'RU',
      'Korea': 'KR',
      'South Korea': 'KR',
      'Taiwan': 'TW',
      'Chinese Taipei': 'TW'
    };

    return countryMap[nationality] || 'XX';
  }

  // Clean score data
  private cleanScore(score: any, options: DataCleaningOptions): any {
    if (!score) return undefined;

    const cleanedSets = this.cleanSets(score.sets || []);
    const cleanedGames = this.cleanGames(score.games);

    if (cleanedSets.length === 0 && !cleanedGames) {
      return undefined;
    }

    return {
      sets: cleanedSets,
      games: cleanedGames,
      currentSet: this.cleanGames(score.currentSet)
    };
  }

  private cleanSets(sets: any[]): any[] {
    if (!Array.isArray(sets)) return [];

    return sets
      .map(set => this.cleanSet(set))
      .filter(set => set !== null);
  }

  private cleanSet(set: any): any | null {
    if (!set) return null;

    const player1 = this.parseScore(set.player1);
    const player2 = this.parseScore(set.player2);

    // Skip sets with invalid scores
    if (player1 === null && player2 === null) return null;

    return {
      player1: player1 ?? 0,
      player2: player2 ?? 0,
      tiebreak: set.tiebreak ? {
        player1: this.parseScore(set.tiebreak.player1) ?? 0,
        player2: this.parseScore(set.tiebreak.player2) ?? 0
      } : undefined
    };
  }

  private cleanGames(games: any): any | undefined {
    if (!games) return undefined;

    const player1 = this.parseScore(games.player1);
    const player2 = this.parseScore(games.player2);

    if (player1 === null && player2 === null) return undefined;

    return {
      player1: player1 ?? 0,
      player2: player2 ?? 0
    };
  }

  // Parse score with handling for various formats
  private parseScore(score: any): number | null {
    if (typeof score === 'number') return score;
    if (typeof score === 'string') {
      const cleaned = score.trim();
      if (cleaned === '' || cleaned === '-' || cleaned === 'N/A') return null;

      const parsed = parseInt(cleaned, 10);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  // Utility methods
  private cleanString(value: any): string | undefined {
    if (typeof value === 'string') {
      const cleaned = value.trim();
      return cleaned === '' ? undefined : cleaned;
    }
    return undefined;
  }

  private cleanNumber(value: any): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseInt(value.trim(), 10);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  private cleanTimestamp(value: any): string | undefined {
    if (!value) return undefined;

    try {
      const date = new Date(value);
      return isNaN(date.getTime()) ? undefined : date.toISOString();
    } catch {
      return undefined;
    }
  }

  private cleanRanking(ranking: any): number | undefined {
    const cleaned = this.cleanNumber(ranking);
    return cleaned && cleaned > 0 ? cleaned : undefined;
  }

  private normalizeStatus(status: any): string {
    if (!status) return 'scheduled';

    const statusMap: Record<string, string> = {
      'ft': 'completed',
      'finished': 'completed',
      'final': 'completed',
      'ended': 'completed',
      'live': 'live',
      'inprogress': 'live',
      'in progress': 'live',
      'scheduled': 'scheduled',
      'upcoming': 'scheduled',
      'cancelled': 'cancelled',
      'canceled': 'cancelled',
      'walkover': 'walkover',
      'wo': 'walkover',
      'retired': 'retired',
      'ret': 'retired'
    };

    const normalized = status.toString().toLowerCase().trim();
    return statusMap[normalized] || 'scheduled';
  }

  private normalizeCategory(category: any): string {
    if (!category) return 'Unknown';

    const categoryMap: Record<string, string> = {
      'atp': 'ATP',
      'wta': 'WTA',
      'challenger': 'Challenger',
      'itf': 'ITF',
      'exhibition': 'Exhibition'
    };

    const normalized = category.toString().toLowerCase().trim();
    return categoryMap[normalized] || category.toString();
  }

  private normalizeSurface(surface: any): string {
    if (!surface) return 'Hard';

    const surfaceMap: Record<string, string> = {
      'hard': 'Hard',
      'hardcourt': 'Hard',
      'clay': 'Clay',
      'red clay': 'Clay',
      'grass': 'Grass',
      'indoor': 'Indoor',
      'carpet': 'Carpet'
    };

    const normalized = surface.toString().toLowerCase().trim();
    return surfaceMap[normalized] || surface.toString();
  }

  private normalizeHandedness(handedness: any): 'right' | 'left' | undefined {
    if (!handedness) return undefined;

    const hand = handedness.toString().toLowerCase().trim();
    if (hand.includes('left') || hand === 'l') return 'left';
    if (hand.includes('right') || hand === 'r') return 'right';

    return undefined;
  }

  private inferTournamentLevel(category?: string, name?: string): string | undefined {
    if (!category || !name) return undefined;

    const lowerName = name.toLowerCase();

    if (lowerName.includes('grand slam') ||
        lowerName.includes('wimbledon') ||
        lowerName.includes('us open') ||
        lowerName.includes('french open') ||
        lowerName.includes('australian open')) {
      return 'Grand Slam';
    }

    if (lowerName.includes('masters') && category === 'ATP') {
      return 'Masters 1000';
    }

    if (category === 'ATP') {
      if (lowerName.includes('500')) return 'ATP 500';
      if (lowerName.includes('250')) return 'ATP 250';
    }

    if (category === 'WTA') {
      if (lowerName.includes('1000')) return 'WTA 1000';
      if (lowerName.includes('500')) return 'WTA 500';
      if (lowerName.includes('250')) return 'WTA 250';
    }

    return undefined;
  }

  // Default data creators
  private createDefaultTournament(location: string): any {
    return {
      id: 'unknown-tournament',
      name: 'Unknown Tournament',
      category: 'Unknown',
      surface: 'Hard',
      location,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    };
  }

  private createDefaultPlayers(): any[] {
    return [
      this.createDefaultPlayer(1),
      this.createDefaultPlayer(2)
    ];
  }

  private createDefaultPlayer(number: number): any {
    return {
      id: `player-${number}`,
      name: `Player ${number}`,
      nationality: 'Unknown',
      countryCode: 'XX'
    };
  }

  private generateMatchId(): string {
    return `match-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Export singleton instance
export const tennisDataCleaner = TennisDataCleaner.getInstance();

// Convenience functions
export function cleanMatchData(rawMatch: any, options?: DataCleaningOptions) {
  return tennisDataCleaner.cleanMatch(rawMatch, options);
}

export function analyzeDataQuality(matches: any[]): {
  totalMatches: number;
  missingData: {
    location: number;
    scores: number;
    playerNames: number;
    countryData: number;
  };
  recommendations: string[];
} {
  const issues = {
    location: 0,
    scores: 0,
    playerNames: 0,
    countryData: 0
  };

  matches.forEach(match => {
    // Check location issues
    if (!match.tournament?.location ||
        match.tournament.location.includes(', •') ||
        match.tournament.location.trim() === '') {
      issues.location++;
    }

    // Check score issues
    if (match.score?.sets?.some((set: any) =>
        set.player1 === '-' || set.player2 === '-' ||
        set.player1 === null || set.player2 === null)) {
      issues.scores++;
    }

    // Check player name issues
    if (match.players?.some((player: any) =>
        !player.name || player.name === '-' || player.name.includes('🏳️'))) {
      issues.playerNames++;
    }

    // Check country data issues
    if (match.players?.some((player: any) =>
        player.countryCode === 'XX' || player.nationality === 'Neutral' ||
        player.nationality === 'Unknown')) {
      issues.countryData++;
    }
  });

  const recommendations = [];
  if (issues.location > 0) recommendations.push('Improve tournament location data parsing');
  if (issues.scores > 0) recommendations.push('Handle missing or invalid scores gracefully');
  if (issues.playerNames > 0) recommendations.push('Add fallbacks for missing player names');
  if (issues.countryData > 0) recommendations.push('Enhance country code inference from nationality');

  return {
    totalMatches: matches.length,
    missingData: issues,
    recommendations
  };
}