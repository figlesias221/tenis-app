// Official SportRadar Tennis API v3 Types
// Generated from OpenAPI specification

// Basic types
export type SportEventStatus =
  | 'not_started'
  | 'started'
  | 'postponed'
  | 'suspended'
  | 'cancelled'
  | 'delayed'
  | 'live'
  | 'interrupted'
  | 'ended'
  | 'closed'
  | 'abandoned';

export type SurfaceType =
  | 'hard_court'
  | 'grass'
  | 'red_clay'
  | 'green_clay'
  | 'hardcourt_outdoor'
  | 'carpet_indoor'
  | 'synthetic_indoor'
  | 'synthetic_outdoor'
  | 'hardcourt_indoor'
  | 'red_clay_indoor'
  | 'unknown'
  | 'synthetic_grass';

export type Gender = 'male' | 'female' | 'mixed';

// Core schemas from OpenAPI
export interface Competitor {
  id: string; // Competitor URN (sr:competitor:x)
  name: string;
  abbreviation?: string;
  country?: string;
  country_code?: string;
  date_of_birth?: string;
  qualifier?: string;
  virtual?: boolean;
}

export interface Venue {
  id: string; // Venue URN (sr:venue:x)
  name: string;
  city_name?: string;
  country_name?: string;
  country_code?: string; // ISO 3361-1 A3 Country Code
  capacity?: number;
  map_coordinates?: string;
  timezone?: string; // e.g., "Australia/Melbourne"
  changed?: boolean;
  reduced_capacity?: boolean;
  reduced_capacity_max?: number;
}

export interface Competition {
  id: string; // Competition URN (sr:competition:x)
  name: string;
  alternative_name?: string;
  gender?: string;
}

export interface Season {
  id: string; // Season URN (sr:season:x)
  name: string;
  start_date?: string;
  end_date?: string;
  year?: string;
  competition_id?: string;
}

export interface SportEventContext {
  sport: {
    id: string;
    name: string;
  };
  category: {
    id: string;
    name: string;
    country_code?: string;
  };
  competition: Competition;
  season: Season;
  stage?: {
    order: number;
    type: 'cup' | 'league';
    phase: string;
    start_date?: string;
    end_date?: string;
    year?: string;
  };
  round?: {
    type?: string;
    number?: number;
    name?: string;
    other_sport_event_id?: string;
  };
  mode?: {
    best_of?: number;
  };
}

export interface SportEvent {
  id: string; // Sport Event URN (sr:sport_event:x)
  start_time: string; // ISO datetime
  start_time_confirmed: boolean;
  competitors: Competitor[];
  venue?: Venue;
  sport_event_context?: SportEventContext;
  parent_id?: string; // Sport Event URN
  replaced_by?: string; // Sport Event URN
  resume_time?: string; // ISO datetime
  estimated?: boolean;
  type?: 'parent' | 'child';
}

export interface PeriodScore {
  number?: number;
  home_score: number;
  away_score: number;
  home_tiebreak_score?: number;
  away_tiebreak_score?: number;
}

export interface GameState {
  serving?: number; // 1 for home, 2 for away
  advantage?: number; // 1 for home, 2 for away
  last_point_result?: string;
  tie_break?: boolean;
}

export interface SportEventStatusData {
  status: SportEventStatus;
  match_status?: string;
  home_score?: number;
  away_score?: number;
  home_normaltime_score?: number;
  away_normaltime_score?: number;
  home_overtime_score?: number;
  away_overtime_score?: number;
  winner_id?: string; // Competitor URN
  period_scores?: PeriodScore[];
  game_state?: GameState;
  decided_by_fed?: boolean;
  scout_abandoned?: boolean;
}

export interface SportEventStatistics {
  periods?: SportEventStatisticsPeriod[];
  totals?: SportEventStatisticsTotals;
}

export interface SportEventStatisticsPeriod {
  number?: number;
  competitors?: CompetitorStatistics[];
}

export interface CompetitorStatistics {
  id: string;
  name?: string;
  abbreviation?: string;
  country?: string;
  country_code?: string;
  qualifier?: string;
  statistics?: {
    aces?: number;
    double_faults?: number;
    service_points_played?: number;
    service_points_won?: number;
    receiver_points_played?: number;
    receiver_points_won?: number;
    service_games_played?: number;
    service_games_won?: number;
    receiver_games_played?: number;
    receiver_games_won?: number;
    total_points_won?: number;
    [key: string]: any; // Allow for additional statistics
  };
}

export interface SportEventStatisticsTotals {
  competitors?: CompetitorStatistics[];
}

// Main response types
export interface Summary {
  sport_event: SportEvent;
  sport_event_status: SportEventStatusData;
  statistics?: SportEventStatistics;
}

export interface ScheduleLiveSummariesResponse {
  generated_at: string; // ISO datetime
  summaries: Summary[];
}

export interface ScheduleSummariesResponse {
  generated_at: string; // ISO datetime
  summaries: Summary[];
}

export interface SportEventSummaryResponse {
  generated_at: string; // ISO datetime
  sport_event: SportEvent;
  sport_event_status: SportEventStatusData;
  statistics?: SportEventStatistics;
}

// Rankings types
export interface RankingCompetitor {
  rank: number;
  points: number;
  movement: number;
  competitions_played?: number;
  competitor: Competitor;
}

export interface SingleRanking {
  type_id?: number;
  name: string;
  year?: number;
  week?: number;
  gender: 'men' | 'women' | 'mixed';
  competitor_rankings: RankingCompetitor[];
}

export interface RankingsResponse {
  generated_at: string; // ISO datetime
  rankings: SingleRanking[];
}

// Competitor profile types
export interface CompetitorInfo {
  date_of_birth?: string;
  handedness?: 'right' | 'left';
  height?: number; // in centimeters
  weight?: number; // in kilograms
  highest_doubles_ranking?: number;
  highest_doubles_ranking_date?: string;
  highest_singles_ranking?: number;
  highest_singles_ranking_date?: string;
  pro_year?: number;
}

export interface CompetitorRanking {
  competitions_played?: number;
  competitor_id: string;
  movement: number;
  name: string;
  points: number;
  race_ranking: boolean;
  rank: number;
  type: 'singles' | 'doubles' | 'mixed';
}

export interface Surface {
  type: SurfaceType;
  statistics: {
    competitions_played: number;
    competitions_won: number;
    matches_played: number;
    matches_won: number;
  };
}

export interface Period {
  year: number;
  surfaces: Surface[];
}

export interface CompetitorProfile {
  id: string;
  name: string;
  abbreviation?: string;
  country?: string;
  country_code?: string;
  gender: Gender;
  virtual?: boolean;
  info?: CompetitorInfo;
  competitor_rankings?: CompetitorRanking[];
  periods?: Period[];
}

export interface CompetitorProfileResponse {
  generated_at: string;
  competitor: CompetitorProfile;
  info?: CompetitorInfo;
  competitor_rankings?: CompetitorRanking[];
  periods?: Period[];
}

// Helper types for transforming data
export interface TransformedMatch {
  id: string;
  tournament: {
    id: string;
    name: string;
    category: string;
    surface: string;
    location: string;
    startDate?: string;
    endDate?: string;
  };
  round: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled' | 'postponed' | 'suspended';
  players: [TransformedPlayer, TransformedPlayer];
  score?: {
    sets: Array<{
      player1: number;
      player2: number;
      tiebreak?: {
        player1: number;
        player2: number;
      };
    }>;
    games?: {
      player1: number;
      player2: number;
    };
  };
  startTime?: string;
  court?: string;
  liveIndicators?: {
    serving?: 1 | 2;
    advantage?: 1 | 2;
    tieBreak?: boolean;
  };
}

export interface TransformedPlayer {
  id: string;
  name: string;
  nationality: string;
  countryCode: string;
  abbreviation?: string;
}

export interface TransformedTournament {
  id: string;
  name: string;
  category: string;
  surface: string;
  location: string;
  startDate?: string;
  endDate?: string;
}

// Error types
export interface ApiError {
  message: string;
  code?: number;
  details?: any;
}

// Competitions types
export interface CompetitionCategory {
  id: string; // Category URN (sr:category:x)
  name: string; // e.g., "ATP", "WTA", "ITF"
  country_code?: string;
}

export interface CompetitionInfo {
  id: string; // Competition URN (sr:competition:x)
  name: string; // e.g., "Wimbledon Men Singles"
  gender: 'men' | 'women' | 'mixed';
  level: 'grand_slam' | 'atp_1000' | 'atp_500' | 'atp_250' | 'wta_premier' | 'wta_international' | 'atp_world_tour_finals' | 'wta_championships' | 'atp_next_generation' | 'wta_elite_trophy' | 'wta_master' | 'wta_500' | 'wta_250' | 'wta_1000' | 'wta_125';
  type: 'singles' | 'doubles' | 'mixed' | 'mixed_doubles';
  parent_id?: string; // Parent competition URN for grouping
  category: CompetitionCategory;
}

export interface CompetitionsByCategoryResponse {
  generated_at: string; // ISO datetime
  competitions: CompetitionInfo[];
}

// Competition Info types - Enhanced to match Sportradar API schema
export interface CompetitionDetails {
  alternative_name?: string;
  category: CompetitionCategory;
  children?: CompetitionChild[];
  gender: string; // Changed to string to match API response
  id: string;
  level: 'grand_slam' | 'atp_1000' | 'atp_500' | 'atp_250' | 'wta_premier' | 'wta_international' | 'atp_world_tour_finals' | 'wta_championships' | 'atp_next_generation' | 'wta_elite_trophy' | 'wta_master' | 'wta_500' | 'wta_250' | 'wta_1000' | 'wta_125' | string;
  name: string;
  parent_id?: string;
  type: string;
}

export interface CompetitionChild {
  competition: CompetitionDetails;
}

export interface CompetitionExtraInfo {
  competition_status?: 'delayed' | 'cancelled' | 'active' | 'ended' | string;
  complex?: string;
  complex_id?: string;
  prize_currency?: string;
  prize_money?: number;
  surface?: string;
  venue_reduced_capacity?: boolean;
  venue_reduced_capacity_max?: number;
}

// Helper type for displaying tournament information with fallbacks
export interface EnhancedCompetitionDisplay {
  id: string;
  name: string;
  level: string;
  category: string;
  type: string;
  gender: string;
  surface?: string;
  prizeMoney?: {
    amount: number;
    currency: string;
  };
  venue?: {
    complex: string;
    complexId?: string;
    reducedCapacity?: boolean;
    maxCapacity?: number;
  };
  status?: string;
  parentTournament?: {
    id: string;
    name: string;
  };
}

export interface CompetitionInfoResponse {
  generated_at: string; // ISO datetime
  competition: CompetitionDetails;
  info?: CompetitionExtraInfo;
}

// API Provider interface compatible with existing code
export interface OfficialTennisApiProvider {
  getRankings(type: "ATP" | "WTA", limit?: number): Promise<RankingsResponse>;
  getLiveMatches(): Promise<ScheduleLiveSummariesResponse>;
  getTodayMatches(): Promise<ScheduleSummariesResponse>;
  getCompetitorProfile(competitorId: string): Promise<CompetitorProfileResponse>;
  getCompetitionsByCategory(categoryId: string): Promise<CompetitionsByCategoryResponse>;
  getCompetitionInfo(competitionId: string): Promise<CompetitionInfoResponse>;
}

// Transformation utilities
export class SportRadarTransformer {
  static transformSummaryToMatch(summary: Summary): TransformedMatch {
    const event = summary.sport_event;
    const status = summary.sport_event_status;

    // Extract tournament info
    const tournament: TransformedTournament = {
      id: event.sport_event_context?.competition?.id || event.id,
      name: event.sport_event_context?.competition?.name || 'Unknown Tournament',
      category: this.determineTournamentCategory(event.sport_event_context?.competition?.name || ''),
      surface: this.normalizeSurface(event.venue?.country_name), // This needs to be improved
      location: this.formatLocation(event.venue?.city_name, event.venue?.country_name),
      startDate: event.sport_event_context?.season?.start_date,
      endDate: event.sport_event_context?.season?.end_date
    };

    // Extract players
    const competitors = event.competitors || [];
    const players: [TransformedPlayer, TransformedPlayer] = [
      {
        id: competitors[0]?.id || '',
        name: competitors[0]?.name || 'Player 1',
        nationality: competitors[0]?.country || 'Unknown',
        countryCode: competitors[0]?.country_code || 'XX',
        abbreviation: competitors[0]?.abbreviation
      },
      {
        id: competitors[1]?.id || '',
        name: competitors[1]?.name || 'Player 2',
        nationality: competitors[1]?.country || 'Unknown',
        countryCode: competitors[1]?.country_code || 'XX',
        abbreviation: competitors[1]?.abbreviation
      }
    ];

    return {
      id: event.id,
      tournament,
      round: event.sport_event_context?.round?.name || 'Round 1',
      status: this.mapStatus((status as any).status),
      players,
      score: this.transformScore(status),
      startTime: event.start_time,
      court: event.venue?.name,
      liveIndicators: {
        serving: status.game_state?.serving as (1 | 2) | undefined,
        advantage: status.game_state?.advantage as (1 | 2) | undefined,
        tieBreak: status.game_state?.tie_break
      }
    };
  }

  private static determineTournamentCategory(name: string): string {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('atp') || lowerName.includes('masters')) return 'ATP';
    if (lowerName.includes('wta')) return 'WTA';
    if (lowerName.includes('challenger')) return 'Challenger';
    if (lowerName.includes('itf')) return 'ITF';
    return 'Unknown';
  }

  private static normalizeSurface(surface?: string): string {
    if (!surface) return 'Hard';
    // This is a placeholder - surface info should come from sport_event_context
    return 'Hard';
  }

  private static formatLocation(city?: string, country?: string): string {
    if (city && country) return `${city}, ${country}`;
    if (city) return city;
    if (country) return country;
    return 'Unknown Location';
  }

  private static mapStatus(status: SportEventStatus): TransformedMatch['status'] {
    switch (status) {
      case 'live':
      case 'started':
        return 'live';
      case 'ended':
      case 'closed':
        return 'completed';
      case 'cancelled':
        return 'cancelled';
      case 'postponed':
        return 'postponed';
      case 'suspended':
        return 'suspended';
      default:
        return 'scheduled';
    }
  }

  private static transformScore(status: SportEventStatusData): TransformedMatch['score'] | undefined {
    if (!status.period_scores || status.period_scores.length === 0) {
      // Check for current games
      if (status.home_score !== undefined && status.away_score !== undefined) {
        return {
          sets: [],
          games: {
            player1: status.home_score,
            player2: status.away_score
          }
        };
      }
      return undefined;
    }

    const sets = status.period_scores.map(period => {
      const setScore = {
        player1: period.home_score,
        player2: period.away_score
      };

      // Add tiebreak scores if available
      if (period.home_tiebreak_score !== undefined && period.away_tiebreak_score !== undefined) {
        return {
          ...setScore,
          tiebreak: {
            player1: period.home_tiebreak_score,
            player2: period.away_tiebreak_score
          }
        };
      }

      return setScore;
    });

    const score: TransformedMatch['score'] = { sets };

    // Add current games if match is live
    if (status.status === 'live' && status.home_score !== undefined && status.away_score !== undefined) {
      score.games = {
        player1: status.home_score,
        player2: status.away_score
      };
    }

    return score;
  }
}