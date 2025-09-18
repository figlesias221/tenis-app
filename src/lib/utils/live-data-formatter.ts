// Live Tennis Data Formatter Utility
import type { EnhancedMatch, EnhancedScore, EnhancedPlayer } from '../api/enhanced-types';

export interface FormattedMatchDisplay {
  status: {
    display: string;
    color: string;
    icon: string;
    isLive: boolean;
  };
  tournament: {
    name: string;
    category: string;
    surface: string;
    location: string;
    round: string;
  };
  players: Array<{
    name: string;
    displayName: string;
    country: string;
    flag: string;
    ranking?: number;
    isServing?: boolean;
    isWinner?: boolean;
  }>;
  score: {
    sets: Array<{
      player1: number;
      player2: number;
      winner: number | null;
      tiebreak?: { player1: number; player2: number };
    }>;
    currentGames?: {
      player1: number;
      player2: number;
    };
    matchWinner: number | null;
    setsWon: [number, number];
  } | null;
  time: {
    start?: string;
    duration?: string;
    status: string;
  };
  indicators: {
    setPoint: boolean;
    matchPoint: boolean;
    breakPoint: boolean;
    serving: number | null;
  };
}

export class LiveDataFormatter {
  private static instance: LiveDataFormatter;

  static getInstance(): LiveDataFormatter {
    if (!LiveDataFormatter.instance) {
      LiveDataFormatter.instance = new LiveDataFormatter();
    }
    return LiveDataFormatter.instance;
  }

  formatMatch(match: EnhancedMatch): FormattedMatchDisplay {
    return {
      status: this.formatStatus(match.status),
      tournament: this.formatTournament(match),
      players: this.formatPlayers(match.players, match.score, match.liveIndicators?.serving),
      score: this.formatScore(match.score),
      time: this.formatTime(match),
      indicators: this.formatIndicators(match.liveIndicators)
    };
  }

  private formatStatus(status: EnhancedMatch['status']) {
    const statusMap = {
      'live': { display: 'LIVE', color: 'red', icon: '🔴', isLive: true },
      'completed': { display: 'FINISHED', color: 'green', icon: '✅', isLive: false },
      'scheduled': { display: 'UPCOMING', color: 'blue', icon: '🕒', isLive: false },
      'cancelled': { display: 'CANCELLED', color: 'gray', icon: '❌', isLive: false },
      'walkover': { display: 'WALKOVER', color: 'yellow', icon: '⚠️', isLive: false },
      'retired': { display: 'RETIRED', color: 'orange', icon: '🔄', isLive: false }
    };

    return statusMap[status] || { display: 'UNKNOWN', color: 'gray', icon: '❓', isLive: false };
  }

  private formatTournament(match: EnhancedMatch) {
    const location = this.formatLocation(match.tournament.city, match.tournament.country, match.tournament.location);

    return {
      name: match.tournament.name,
      category: match.tournament.category,
      surface: match.tournament.surface,
      location,
      round: match.round
    };
  }

  private formatLocation(city?: string, country?: string, fallback?: string): string {
    if (city && country) {
      return `${city}, ${country}`;
    }
    if (fallback) {
      return fallback;
    }
    return 'Unknown Location';
  }

  private formatPlayers(
    players: [EnhancedPlayer, EnhancedPlayer],
    score?: EnhancedScore,
    serving?: number
  ) {
    const matchWinner = this.determineMatchWinner(score);

    return players.map((player, index) => ({
      name: player.name,
      displayName: this.formatPlayerName(player.name),
      country: player.nationality,
      flag: this.getFlagUrl(player.countryCode),
      ranking: player.ranking,
      isServing: serving === (index + 1),
      isWinner: matchWinner === index
    }));
  }

  private formatPlayerName(fullName: string): string {
    // Handle "Last, First" format
    if (fullName.includes(', ')) {
      const [last, first] = fullName.split(', ');
      return `${first} ${last}`;
    }
    return fullName;
  }

  private getFlagUrl(countryCode: string): string {
    const code = countryCode.toLowerCase();
    return `https://flagcdn.com/24x18/${code}.png`;
  }

  private formatScore(score?: EnhancedScore) {
    if (!score || !score.sets) return null;

    const setsWon = this.calculateSetsWon(score.sets);
    const matchWinner = this.determineMatchWinner(score);

    return {
      sets: score.sets.map(set => ({
        player1: set.player1,
        player2: set.player2,
        winner: set.player1 > set.player2 ? 0 : (set.player2 > set.player1 ? 1 : null),
        tiebreak: set.tiebreak
      })),
      currentGames: score.games || score.currentSet,
      matchWinner,
      setsWon
    };
  }

  private calculateSetsWon(sets: EnhancedScore['sets']): [number, number] {
    let player1Sets = 0;
    let player2Sets = 0;

    sets.forEach(set => {
      if (set.player1 > set.player2) player1Sets++;
      else if (set.player2 > set.player1) player2Sets++;
    });

    return [player1Sets, player2Sets];
  }

  private determineMatchWinner(score?: EnhancedScore): number | null {
    if (!score?.sets) return null;

    const [player1Sets, player2Sets] = this.calculateSetsWon(score.sets);

    // Best of 3: first to 2
    // Best of 5: first to 3
    if (player1Sets >= 2 && player1Sets > player2Sets) return 0;
    if (player2Sets >= 2 && player2Sets > player1Sets) return 1;

    return null;
  }

  private formatTime(match: EnhancedMatch) {
    const time = {
      start: match.startTime ? this.formatTimeString(match.startTime) : undefined,
      duration: match.stats?.duration ? this.formatDuration(match.stats.duration) : undefined,
      status: this.getTimeStatus(match)
    };

    return time;
  }

  private formatTimeString(timestamp: string): string {
    try {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return timestamp;
    }
  }

  private formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  private getTimeStatus(match: EnhancedMatch): string {
    const now = new Date();

    if (match.startTime) {
      const startTime = new Date(match.startTime);

      if (match.status === 'scheduled') {
        const diffMs = startTime.getTime() - now.getTime();
        const diffHours = Math.round(diffMs / (1000 * 60 * 60));

        if (diffHours < 0) return 'Should have started';
        if (diffHours === 0) return 'Starting soon';
        if (diffHours < 24) return `In ${diffHours}h`;
        return `In ${Math.round(diffHours / 24)}d`;
      }
    }

    if (match.endTime) {
      const endTime = new Date(match.endTime);
      const diffMs = now.getTime() - endTime.getTime();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));

      if (diffHours < 1) return 'Just finished';
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.round(diffHours / 24)}d ago`;
    }

    return match.status === 'live' ? 'In progress' : 'Time unknown';
  }

  private formatIndicators(liveIndicators?: EnhancedMatch['liveIndicators']) {
    return {
      setPoint: liveIndicators?.setPoint || false,
      matchPoint: liveIndicators?.matchPoint || false,
      breakPoint: liveIndicators?.breakPoint || false,
      serving: liveIndicators?.serving || null
    };
  }

  // Format data for compact display (mobile-friendly)
  formatCompactMatch(match: EnhancedMatch) {
    const formatted = this.formatMatch(match);

    return {
      ...formatted,
      players: formatted.players.map(player => ({
        ...player,
        displayName: this.getLastName(player.name)
      }))
    };
  }

  private getLastName(fullName: string): string {
    if (fullName.includes(', ')) {
      return fullName.split(', ')[0]; // "Last, First" -> "Last"
    }

    const parts = fullName.split(' ');
    return parts[parts.length - 1]; // Get last word
  }

  // Format multiple matches for list display
  formatMatchList(matches: EnhancedMatch[], options: { compact?: boolean; groupByStatus?: boolean } = {}) {
    const formattedMatches = matches.map(match =>
      options.compact ? this.formatCompactMatch(match) : this.formatMatch(match)
    );

    if (options.groupByStatus) {
      return this.groupMatchesByStatus(formattedMatches);
    }

    return formattedMatches;
  }

  private groupMatchesByStatus(matches: FormattedMatchDisplay[]) {
    const groups = {
      live: matches.filter(m => m.status.isLive),
      upcoming: matches.filter(m => m.status.display === 'UPCOMING'),
      completed: matches.filter(m => m.status.display === 'FINISHED'),
      other: matches.filter(m => !m.status.isLive && !['UPCOMING', 'FINISHED'].includes(m.status.display))
    };

    return groups;
  }

  // Real-time score animation helpers
  generateScoreAnimation(oldScore?: EnhancedScore, newScore?: EnhancedScore) {
    if (!oldScore || !newScore) return null;

    const changes = {
      sets: [] as Array<{ setIndex: number; player: number; change: number }>,
      games: null as { player: number; change: number } | null,
      newSet: false
    };

    // Check for set changes
    for (let i = 0; i < Math.max(oldScore.sets.length, newScore.sets.length); i++) {
      const oldSet = oldScore.sets[i];
      const newSet = newScore.sets[i];

      if (!oldSet && newSet) {
        changes.newSet = true;
      } else if (oldSet && newSet) {
        if (newSet.player1 > oldSet.player1) {
          changes.sets.push({ setIndex: i, player: 1, change: newSet.player1 - oldSet.player1 });
        }
        if (newSet.player2 > oldSet.player2) {
          changes.sets.push({ setIndex: i, player: 2, change: newSet.player2 - oldSet.player2 });
        }
      }
    }

    // Check for games changes
    if (oldScore.games && newScore.games) {
      if (newScore.games.player1 > oldScore.games.player1) {
        changes.games = { player: 1, change: newScore.games.player1 - oldScore.games.player1 };
      } else if (newScore.games.player2 > oldScore.games.player2) {
        changes.games = { player: 2, change: newScore.games.player2 - oldScore.games.player2 };
      }
    }

    return changes;
  }
}

// Export singleton instance
export const liveDataFormatter = LiveDataFormatter.getInstance();

// Utility functions for direct import
export function formatMatchForDisplay(match: EnhancedMatch): FormattedMatchDisplay {
  return liveDataFormatter.formatMatch(match);
}

export function formatCompactMatch(match: EnhancedMatch) {
  return liveDataFormatter.formatCompactMatch(match);
}

export function formatMatchList(matches: EnhancedMatch[], options?: { compact?: boolean; groupByStatus?: boolean }) {
  return liveDataFormatter.formatMatchList(matches, options);
}