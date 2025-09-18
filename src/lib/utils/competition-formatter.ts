import type { CompetitionInfoResponse, EnhancedCompetitionDisplay } from '../api/official-types';

// Known tournament surfaces based on tournament names/locations
const TOURNAMENT_SURFACES: Record<string, string> = {
  'wimbledon': 'Grass',
  'french open': 'Clay',
  'roland garros': 'Clay',
  'australian open': 'Hard',
  'us open': 'Hard',
  'indian wells': 'Hard',
  'miami': 'Hard',
  'monte carlo': 'Clay',
  'madrid': 'Clay',
  'rome': 'Clay',
  'cincinnati': 'Hard',
  'canada': 'Hard',
  'shanghai': 'Hard',
  'paris': 'Hard (Indoor)',
  'atp finals': 'Hard (Indoor)',
  'wta finals': 'Hard (Indoor)'
};

// Prize money estimates for tournament levels (in USD)
const PRIZE_ESTIMATES: Record<string, number> = {
  'grand_slam': 60000000,
  'atp_1000': 8000000,
  'wta_1000': 8000000,
  'atp_500': 2500000,
  'wta_500': 2500000,
  'atp_250': 700000,
  'wta_250': 250000,
  'wta_125': 125000,
  'atp_world_tour_finals': 15000000,
  'wta_championships': 15000000
};

export class CompetitionFormatter {
  static formatCompetitionInfo(response: CompetitionInfoResponse): EnhancedCompetitionDisplay {
    const competition = response.competition;
    const info = response.info;

    // Extract surface information
    const surface = info?.surface ||
                   this.inferSurfaceFromName(competition.name) ||
                   'Hard'; // Default fallback

    // Extract prize money
    const prizeMoney = info?.prize_money && info?.prize_currency ? {
      amount: info.prize_money,
      currency: info.prize_currency
    } : this.estimatePrizeMoney(competition.level);

    // Extract venue information
    const venue = info?.complex ? {
      complex: info.complex,
      complexId: info.complex_id,
      reducedCapacity: info.venue_reduced_capacity,
      maxCapacity: info.venue_reduced_capacity_max
    } : undefined;

    return {
      id: competition.id,
      name: competition.name,
      level: this.formatLevel(competition.level),
      category: competition.category?.name || 'Unknown',
      type: this.formatType(competition.type),
      gender: this.formatGender(competition.gender),
      surface,
      prizeMoney,
      venue,
      status: info?.competition_status,
      parentTournament: competition.parent_id ? {
        id: competition.parent_id,
        name: this.extractParentName(competition.name)
      } : undefined
    };
  }

  private static inferSurfaceFromName(tournamentName: string): string | undefined {
    const lowerName = tournamentName.toLowerCase();

    for (const [key, surface] of Object.entries(TOURNAMENT_SURFACES)) {
      if (lowerName.includes(key)) {
        return surface;
      }
    }

    return undefined;
  }

  private static estimatePrizeMoney(level: string): { amount: number; currency: string } | undefined {
    const estimate = PRIZE_ESTIMATES[level];
    if (estimate) {
      return {
        amount: estimate,
        currency: 'USD'
      };
    }
    return undefined;
  }

  private static formatLevel(level: string): string {
    const levelMap: Record<string, string> = {
      'grand_slam': 'Grand Slam',
      'atp_1000': 'ATP Masters 1000',
      'atp_500': 'ATP 500',
      'atp_250': 'ATP 250',
      'wta_1000': 'WTA 1000',
      'wta_500': 'WTA 500',
      'wta_250': 'WTA 250',
      'wta_125': 'WTA 125',
      'wta_premier': 'WTA Premier',
      'wta_international': 'WTA International',
      'atp_world_tour_finals': 'ATP Finals',
      'wta_championships': 'WTA Finals',
      'atp_next_generation': 'Next Gen ATP Finals',
      'wta_elite_trophy': 'WTA Elite Trophy'
    };

    return levelMap[level] || level;
  }

  private static formatType(type: string): string {
    const typeMap: Record<string, string> = {
      'singles': 'Singles',
      'doubles': 'Doubles',
      'mixed': 'Mixed Doubles',
      'mixed_doubles': 'Mixed Doubles'
    };

    return typeMap[type] || type;
  }

  private static formatGender(gender: string): string {
    const genderMap: Record<string, string> = {
      'men': "Men's",
      'women': "Women's",
      'mixed': 'Mixed'
    };

    return genderMap[gender] || gender;
  }

  private static extractParentName(competitionName: string): string {
    // Extract parent tournament name (e.g., "Wimbledon" from "Wimbledon Men Singles")
    return competitionName
      .replace(/\s+(Men|Women|Mixed)\s+(Singles|Doubles)/i, '')
      .trim();
  }

  static formatPrizeMoney(prizeMoney: { amount: number; currency: string }, isEstimate = false): string {
    const { amount, currency } = prizeMoney;

    let formattedAmount: string;
    if (amount >= 1000000) {
      formattedAmount = `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      formattedAmount = `${(amount / 1000).toFixed(0)}K`;
    } else {
      formattedAmount = amount.toLocaleString();
    }

    const prefix = isEstimate ? '~' : '';
    return `${prefix}${currency} ${formattedAmount}`;
  }

  static getSurfaceIcon(surface: string): string {
    const surfaceIcons: Record<string, string> = {
      'Hard': '🏟️',
      'Clay': '🟤',
      'Grass': '🌿',
      'Hard (Indoor)': '🏢',
      'Carpet': '🧶'
    };

    return surfaceIcons[surface] || '🎾';
  }

  static getLevelColor(level: string): string {
    const colorMap: Record<string, string> = {
      'grand_slam': 'text-yellow-600 dark:text-yellow-400',
      'atp_1000': 'text-red-600 dark:text-red-400',
      'wta_1000': 'text-red-600 dark:text-red-400',
      'atp_500': 'text-blue-600 dark:text-blue-400',
      'wta_500': 'text-blue-600 dark:text-blue-400',
      'atp_250': 'text-green-600 dark:text-green-400',
      'wta_250': 'text-green-600 dark:text-green-400',
      'wta_125': 'text-gray-600 dark:text-gray-400'
    };

    return colorMap[level] || 'text-gray-600 dark:text-gray-400';
  }
}