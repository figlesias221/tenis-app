export interface Player {
  id: string;
  name: string;
  nationality: string;
  countryCode: string;
  abbreviation?: string;
  imageUrl?: string; // URL to official player photo (e.g., from Wikipedia/Wikidata)
  avatarUrl?: string; // Generated avatar URL using initials as fallback
}

export interface RankingEntry {
  rank: number;
  player: Player;
  points: number;
  movement?: number; // Position change from previous ranking
  competitionsPlayed?: number; // Number of competitions played
}

export interface Rankings {
  type: "ATP" | "WTA";
  rankings: RankingEntry[];
  lastUpdated: string;
  week?: number;
  year?: number;
}

// SportRadar API Response Types
export interface SportRadarCompetitor {
  id: string;
  name: string;
  abbreviation: string;
  country: string;
  country_code: string;
}

export interface SportRadarCompetitorRanking {
  rank: number;
  points: number;
  movement: number;
  competitions_played: number;
  competitor: SportRadarCompetitor;
}

export interface SportRadarRanking {
  type_id: number;
  name: string;
  year: number;
  week: number;
  gender: "men" | "women";
  competitor_rankings: SportRadarCompetitorRanking[];
}

export interface SportRadarRankingsResponse {
  generated_at: string;
  rankings: SportRadarRanking[];
}

// Competitor Profile API Types
export interface CompetitorInfo {
  date_of_birth?: string;
  handedness?: "right" | "left";
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
  type: "singles" | "doubles" | "mixed";
}

export interface Competition {
  gender: "men" | "women" | "mixed";
  id: string;
  level: string;
  name: string;
  parent_id?: string;
  type: "singles" | "doubles" | "mixed" | "mixed_doubles";
}

export interface SurfaceStatistics {
  competitions_played: number;
  competitions_won: number;
  matches_played: number;
  matches_won: number;
}

export interface Surface {
  type: "hard_court" | "grass" | "red_clay" | "green_clay" | "hardcourt_outdoor" |
        "carpet_indoor" | "synthetic_indoor" | "synthetic_outdoor" | "hardcourt_indoor" |
        "red_clay_indoor" | "unknown" | "synthetic_grass";
  statistics: SurfaceStatistics;
}

export interface Period {
  year: number;
  surfaces: Surface[];
}

export interface CompetitorProfile {
  id: string;
  name: string;
  abbreviation: string;
  country: string;
  country_code: string;
  gender: "male" | "female";
  virtual: boolean;
  info: CompetitorInfo;
  competitor_rankings: CompetitorRanking[];
  periods: Period[];
}

export interface CompetitorProfileResponse {
  generated_at: string;
  competitor: CompetitorProfile;
}

export interface Tournament {
  id: string;
  name: string;
  category: "ATP" | "Challenger" | "WTA";
  surface: "Hard" | "Clay" | "Grass" | "Indoor";
  location: string;
  startDate: string;
  endDate: string;
}

export interface Match {
  id: string;
  tournament: Tournament;
  round: string;
  status: "scheduled" | "live" | "completed" | "cancelled";
  players: [Player, Player];
  score?: {
    sets: Array<{
      player1: number;
      player2: number;
    }>;
    games?: {
      player1: number;
      player2: number;
    };
  };
  startTime?: string;
  court?: string;
}

export interface LiveMatches {
  matches: Match[];
  lastUpdated: string;
}

export interface CompetitionsData {
  competitions: Competition[];
  lastUpdated: string;
}

// Head-to-Head Data Types
export interface MatchSummary {
  id: string;
  sport_event: {
    id: string;
    start_time: string;
    competitors: Array<{
      id: string;
      name: string;
      abbreviation?: string;
      country: string;
      country_code: string;
      qualifier: "home" | "away";
    }>;
    sport_event_context: {
      competition: {
        id: string;
        name: string;
        level?: string;
        type: string;
      };
      round: {
        name: string;
        number?: number;
      };
      season: {
        id: string;
        name: string;
        year: string;
      };
    };
    venue?: {
      id: string;
      name: string;
      city_name?: string;
      country_name?: string;
    };
  };
  sport_event_status: {
    status: string;
    match_status: string;
    home_score: number;
    away_score: number;
    winner_id?: string;
    winning_reason?: string;
    period_scores: Array<{
      number: number;
      type: string;
      home_score: number;
      away_score: number;
      home_tiebreak_score?: number;
      away_tiebreak_score?: number;
    }>;
  };
  statistics?: {
    totals: {
      competitors: Array<{
        id: string;
        name: string;
        statistics: {
          aces?: number;
          double_faults?: number;
          first_serve_successful?: number;
          first_serve_points_won?: number;
          second_serve_points_won?: number;
          service_games_won?: number;
          breakpoints_won?: number;
          total_breakpoints?: number;
          points_won?: number;
          games_won?: number;
        };
      }>;
    };
  };
}

export interface HeadToHeadData {
  competitors: Array<{
    id: string;
    name: string;
    abbreviation?: string;
    country: string;
    country_code: string;
    gender: "male" | "female";
  }>;
  last_meetings: MatchSummary[];
  next_meetings: MatchSummary[];
  generated_at: string;
}

export interface TennisApiProvider {
  getRankings(type: "ATP" | "WTA", limit?: number, date?: string): Promise<Rankings>;
  getLiveMatches(): Promise<LiveMatches>;
  getTodayMatches(): Promise<LiveMatches>;
  getMatchesByDate(date: string): Promise<LiveMatches>;
  getCompetitorProfile(competitorId: string): Promise<CompetitorProfile>;
  getCompetitionsByCategory?(categoryId: string): Promise<CompetitionsData>;
  getHeadToHead?(competitor1Id: string, competitor2Id: string): Promise<HeadToHeadData>;
}