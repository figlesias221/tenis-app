import type {
  TennisApiProvider,
  Rankings,
  LiveMatches,
  Player,
  RankingEntry,
  Match,
  Tournament,
  SportRadarRankingsResponse,
  CompetitorProfile,
  CompetitorProfileResponse
} from "../types";
import { tennisDataCleaner } from "../../utils/data-cleaners";

export class SportRadarProvider implements TennisApiProvider {
  private apiKey: string;
  private baseUrl = "https://api.sportradar.com/tennis/trial/v3/en";
  private cache = new Map<string, { data: any, timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string): Promise<T> {
    // Check cache first
    const cacheKey = endpoint;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log(`Cache hit for ${endpoint}`);
      return cached.data;
    }

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-key': this.apiKey,
          'cache-control': 'max-age=300' // 5 minutes
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SportRadar API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      // Cache the response
      this.cache.set(cacheKey, { data, timestamp: Date.now() });

      return data;
    } catch (error) {
      console.error(`SportRadar API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  async getRankings(type: "ATP" | "WTA", limit = 100, date?: string): Promise<Rankings> {
    try {
      // Use the correct SportRadar Tennis Rankings endpoint
      const data: SportRadarRankingsResponse = await this.request("/rankings.json");

      // Debug: Log the API response structure (reduced for performance)
      console.log(`SportRadar Rankings: Found ${data.rankings?.length || 0} ranking types`);

      // The API returns an array of ranking objects (ATP, WTA, etc.)
      if (!data.rankings || !Array.isArray(data.rankings)) {
        throw new Error(`No rankings found in API response. Available data keys: ${Object.keys(data).join(', ')}`);
      }

      // Find the correct ranking by type and gender
      const targetGender = type === "ATP" ? "men" : "women";
      const targetRanking = data.rankings.find(ranking =>
        ranking.gender === targetGender &&
        ranking.name.toLowerCase().includes(type.toLowerCase())
      );

      if (!targetRanking) {
        console.log('Available rankings:', data.rankings.map(r => ({ name: r.name, gender: r.gender })));
        throw new Error(`No ${type} (${targetGender}) rankings found. Available: ${data.rankings.map(r => `${r.name} (${r.gender})`).join(', ')}`);
      }

      // Check if competitor_rankings exists
      if (!targetRanking.competitor_rankings || !Array.isArray(targetRanking.competitor_rankings)) {
        throw new Error(`No competitor rankings found in ${type} data`);
      }

      // Transform SportRadar response to our format
      const rankings: RankingEntry[] = targetRanking.competitor_rankings.slice(0, limit).map((entry) => {
        // Defensive programming - handle missing competitor data
        if (!entry.competitor) {
          console.warn('Entry missing competitor data:', entry);
          throw new Error('Ranking entry missing competitor data');
        }

        return {
          rank: entry.rank || 0,
          player: {
            id: entry.competitor.id || 'unknown',
            name: entry.competitor.name || 'Unknown Player',
            nationality: entry.competitor.country || 'Unknown',
            countryCode: entry.competitor.country_code || 'XX',
            abbreviation: entry.competitor.abbreviation
          },
          points: entry.points || 0,
          movement: entry.movement || 0,
          competitionsPlayed: entry.competitions_played
        };
      });

      console.log(`Processed ${rankings.length} ${type} rankings`);

      return {
        type,
        rankings,
        lastUpdated: data.generated_at,
        week: targetRanking.week,
        year: targetRanking.year
      };
    } catch (error) {
      console.error('Failed to fetch rankings from SportRadar API:', error);
      throw new Error(`Failed to fetch ${type} rankings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getLiveMatches(): Promise<LiveMatches> {
    try {
      const data = await this.request<any>(`/schedules/live/summaries.json`);

      const matches: Match[] = (data.summaries || [])
        .map((summary: any) => this.transformMatch(summary))
        .map((match: any) => tennisDataCleaner.cleanMatch(match, {
          fillMissingData: true,
          validateScores: true,
          defaultLocation: 'Unknown Location'
        }));

      return {
        matches,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to fetch live matches from SportRadar API:', error);
      throw new Error(`Failed to fetch live matches: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTodayMatches(): Promise<LiveMatches> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await this.request<any>(`/schedules/${today}/summaries.json`);

      const matches: Match[] = (data.summaries || [])
        .map((summary: any) => this.transformMatch(summary))
        .map((match: any) => tennisDataCleaner.cleanMatch(match, {
          fillMissingData: true,
          validateScores: true,
          defaultLocation: 'Unknown Location'
        }));

      return {
        matches,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to fetch today matches from SportRadar API:', error);
      throw new Error(`Failed to fetch today's matches: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getMatchesByDate(date: string): Promise<LiveMatches> {
    try {
      const data = await this.request<any>(`/schedules/${date}/summaries.json`);

      const matches: Match[] = (data.summaries || [])
        .map((summary: any) => this.transformMatch(summary))
        .map((match: any) => tennisDataCleaner.cleanMatch(match, {
          fillMissingData: true,
          validateScores: true,
          defaultLocation: 'Unknown Location'
        }));

      return {
        matches,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to fetch matches for date ${date} from SportRadar API:`, error);
      throw new Error(`Failed to fetch matches for ${date}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private transformMatch(summary: any): Match {
    // Extract tournament info from the sport_event structure
    const tournament: Tournament = {
      id: summary.sport_event?.tournament?.id || summary.sport_event?.competition?.id || '',
      name: summary.sport_event?.tournament?.name || summary.sport_event?.competition?.name || 'Unknown Tournament',
      category: this.determineTournamentCategory(summary.sport_event?.tournament?.name || summary.sport_event?.competition?.name || ''),
      surface: summary.sport_event?.venue?.surface || 'Hard',
      location: `${summary.sport_event?.venue?.city_name || ''}, ${summary.sport_event?.venue?.country_name || ''}`.replace(', ,', '').trim() || 'Unknown',
      startDate: summary.sport_event?.tournament?.start_date || '',
      endDate: summary.sport_event?.tournament?.end_date || ''
    };

    // Extract players from competitors
    const competitors = summary.sport_event?.competitors || [];
    const players: [Player, Player] = [
      {
        id: competitors[0]?.id || '',
        name: competitors[0]?.name || 'Player 1',
        nationality: competitors[0]?.country || 'Unknown',
        countryCode: competitors[0]?.country_code || 'XX'
      },
      {
        id: competitors[1]?.id || '',
        name: competitors[1]?.name || 'Player 2',
        nationality: competitors[1]?.country || 'Unknown',
        countryCode: competitors[1]?.country_code || 'XX'
      }
    ];

    return {
      id: summary.sport_event?.id || '',
      tournament,
      round: summary.sport_event?.tournament_round?.name || summary.sport_event?.round?.name || 'Round 1',
      status: this.mapStatus(summary.sport_event_status?.status),
      players,
      score: this.transformScore(summary.sport_event_status),
      startTime: summary.sport_event?.start_time,
      court: summary.sport_event?.venue?.name
    };
  }

  private determineTournamentCategory(tournamentName: string): "ATP" | "Challenger" {
    const name = tournamentName.toLowerCase();
    if (name.includes('atp') || name.includes('masters') || name.includes('grand slam')) {
      return 'ATP';
    }
    return 'Challenger';
  }

  private mapStatus(status: string): Match['status'] {
    switch (status?.toLowerCase()) {
      case 'live':
      case 'inprogress':
        return 'live';
      case 'ended':
      case 'closed':
        return 'completed';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'scheduled';
    }
  }

  private transformScore(eventStatus: any): Match['score'] | undefined {
    // Handle different score structures from SportRadar API
    if (!eventStatus) return undefined;

    // Check for period_scores (set scores)
    let sets = [];
    if (eventStatus.period_scores && Array.isArray(eventStatus.period_scores)) {
      sets = eventStatus.period_scores.map((set: any) => ({
        player1: set.home_score || 0,
        player2: set.away_score || 0
      }));
    }

    // Check for current game scores
    let games = undefined;
    if (eventStatus.home_score !== undefined && eventStatus.away_score !== undefined) {
      games = {
        player1: eventStatus.home_score,
        player2: eventStatus.away_score
      };
    }

    // If no score data at all, return undefined
    if (sets.length === 0 && !games) {
      return undefined;
    }

    return { sets, games };
  }

  async getCompetitorProfile(competitorId: string): Promise<CompetitorProfile> {
    try {
      // Use the correct SportRadar Competitor Profile endpoint
      const data: CompetitorProfileResponse = await this.request(`/competitors/${competitorId}/profile.json`);

      // Debug: Log the API response structure (reduced for performance)
      console.log(`Profile loaded for ${data.competitor?.name} (${data.competitor?.id})`);

      if (!data.competitor) {
        throw new Error(`No competitor profile found for ID: ${competitorId}`);
      }

      // The API returns data at the top level, not nested under competitor
      return {
        id: data.competitor.id,
        name: data.competitor.name,
        abbreviation: data.competitor.abbreviation || '',
        country: data.competitor.country,
        country_code: data.competitor.country_code,
        gender: data.competitor.gender,
        virtual: data.competitor.virtual || false,
        info: {
          date_of_birth: (data as any).info?.date_of_birth,
          handedness: (data as any).info?.handedness,
          height: (data as any).info?.height,
          weight: (data as any).info?.weight,
          highest_doubles_ranking: (data as any).info?.highest_doubles_ranking,
          highest_doubles_ranking_date: (data as any).info?.highest_doubles_ranking_date,
          highest_singles_ranking: (data as any).info?.highest_singles_ranking,
          highest_singles_ranking_date: (data as any).info?.highest_singles_ranking_date,
          pro_year: (data as any).info?.pro_year
        },
        competitor_rankings: (data as any).competitor_rankings || [],
        periods: (data as any).periods || []
      };
    } catch (error) {
      console.error('Failed to fetch competitor profile from SportRadar API:', error);
      throw new Error(`Failed to fetch competitor profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

}
