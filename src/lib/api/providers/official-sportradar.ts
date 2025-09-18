// Official SportRadar Provider using correct API structure
import type {
  ScheduleLiveSummariesResponse,
  ScheduleSummariesResponse,
  RankingsResponse,
  CompetitorProfileResponse,
  CompetitionsByCategoryResponse,
  CompetitionInfoResponse,
  Summary,
  SportRadarTransformer,
  TransformedMatch,
  ApiError
} from "../official-types";
import type { TennisApiProvider, Rankings, LiveMatches, CompetitorProfile, CompetitionsData, HeadToHeadData } from "../types";
import { tennisDataCleaner } from "../../utils/data-cleaners";

export class OfficialSportRadarProvider implements TennisApiProvider {
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
          'cache-control': 'max-age=300'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error: ApiError = {
          message: `SportRadar API error: ${response.status} ${response.statusText}`,
          code: response.status,
          details: errorText
        };
        throw new Error(JSON.stringify(error));
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

  async getRankings(type: "ATP" | "WTA", limit = 100): Promise<Rankings> {
    try {
      const data: RankingsResponse = await this.request("/rankings.json");

      console.log(`SportRadar Rankings: Found ${data.rankings?.length || 0} ranking types`);

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

      if (!targetRanking.competitor_rankings || !Array.isArray(targetRanking.competitor_rankings)) {
        throw new Error(`No competitor rankings found in ${type} data`);
      }

      // Transform to our internal format
      const rankings = targetRanking.competitor_rankings.slice(0, limit).map((entry) => {
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
      const data: ScheduleLiveSummariesResponse = await this.request(`/schedules/live/summaries.json`);

      console.log(`SportRadar Live: Found ${data.summaries?.length || 0} live matches`);

      const transformedMatches = (data.summaries || [])
        .map((summary: Summary) => this.transformSummaryToMatch(summary))
        .map((match: any) => tennisDataCleaner.cleanMatch(match, {
          fillMissingData: true,
          validateScores: true,
          defaultLocation: 'Unknown Location'
        }));

      return {
        matches: transformedMatches,
        lastUpdated: data.generated_at
      };
    } catch (error) {
      console.error('Failed to fetch live matches from SportRadar API:', error);
      throw new Error(`Failed to fetch live matches: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTodayMatches(): Promise<LiveMatches> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const data: ScheduleSummariesResponse = await this.request(`/schedules/${today}/summaries.json`);

      console.log(`SportRadar Today: Found ${data.summaries?.length || 0} matches today`);

      const transformedMatches = (data.summaries || [])
        .map((summary: Summary) => this.transformSummaryToMatch(summary))
        .map((match: any) => tennisDataCleaner.cleanMatch(match, {
          fillMissingData: true,
          validateScores: true,
          defaultLocation: 'Unknown Location'
        }));

      return {
        matches: transformedMatches,
        lastUpdated: data.generated_at
      };
    } catch (error) {
      console.error('Failed to fetch today matches from SportRadar API:', error);
      throw new Error(`Failed to fetch today's matches: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCompetitorProfile(competitorId: string): Promise<CompetitorProfile> {
    try {
      const data: CompetitorProfileResponse = await this.request(`/competitors/${competitorId}/profile.json`);

      console.log(`Profile loaded for ${data.competitor?.name} (${data.competitor?.id})`);

      if (!data.competitor) {
        throw new Error(`No competitor profile found for ID: ${competitorId}`);
      }

      // Transform to our internal format
      return {
        id: data.competitor.id,
        name: data.competitor.name,
        abbreviation: data.competitor.abbreviation || '',
        country: data.competitor.country || 'Unknown',
        country_code: data.competitor.country_code || 'XX',
        gender: (data.competitor.gender === 'female' ? 'female' : 'male') as 'male' | 'female',
        virtual: data.competitor.virtual || false,
        info: {
          date_of_birth: data.info?.date_of_birth,
          handedness: data.info?.handedness,
          height: data.info?.height,
          weight: data.info?.weight,
          highest_doubles_ranking: data.info?.highest_doubles_ranking,
          highest_doubles_ranking_date: data.info?.highest_doubles_ranking_date,
          highest_singles_ranking: data.info?.highest_singles_ranking,
          highest_singles_ranking_date: data.info?.highest_singles_ranking_date,
          pro_year: data.info?.pro_year
        },
        competitor_rankings: data.competitor_rankings || [],
        periods: data.periods || []
      };
    } catch (error) {
      console.error('Failed to fetch competitor profile from SportRadar API:', error);
      throw new Error(`Failed to fetch competitor profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private transformSummaryToMatch(summary: Summary): TransformedMatch {
    const event = summary.sport_event;
    const status = summary.sport_event_status;

    // Extract tournament info with better handling
    const tournament = {
      id: event.sport_event_context?.competition?.id || event.id,
      name: event.sport_event_context?.competition?.name || 'Unknown Tournament',
      category: this.determineTournamentCategory(event.sport_event_context?.competition?.name || ''),
      surface: this.extractSurface(event.sport_event_context, event.venue),
      location: this.formatLocation(event.venue?.city_name, event.venue?.country_name),
      startDate: event.sport_event_context?.season?.start_date || '',
      endDate: event.sport_event_context?.season?.end_date || ''
    };

    // Extract players with better error handling
    const competitors = event.competitors || [];
    const players = [
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
    ] as [any, any];

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
        serving: (status as any).game_state?.serving as (1 | 2) | undefined,
        advantage: (status as any).game_state?.advantage as (1 | 2) | undefined,
        tieBreak: (status as any).game_state?.tie_break
      }
    };
  }

  private determineTournamentCategory(name: string): string {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('atp') || lowerName.includes('masters')) return 'ATP';
    if (lowerName.includes('wta')) return 'WTA';
    if (lowerName.includes('challenger')) return 'Challenger';
    if (lowerName.includes('itf')) return 'ITF';
    return 'Unknown';
  }

  private extractSurface(context: any, venue: any): string {
    // Try to get surface from context first, then venue, then default
    if (context?.stage?.surface) return this.normalizeSurface(context.stage.surface);
    if (venue?.surface) return this.normalizeSurface(venue.surface);

    // Try to infer from tournament name or location
    const tournamentName = context?.competition?.name?.toLowerCase() || '';
    const location = venue?.country_name?.toLowerCase() || '';

    if (tournamentName.includes('clay') || location.includes('france') || location.includes('spain')) {
      return 'Clay';
    }
    if (tournamentName.includes('grass') || tournamentName.includes('wimbledon')) {
      return 'Grass';
    }
    if (tournamentName.includes('indoor') || tournamentName.includes('masters')) {
      return 'Indoor';
    }

    return 'Hard'; // Default
  }

  private normalizeSurface(surface: string): string {
    const surfaceMap: Record<string, string> = {
      'hard_court': 'Hard',
      'hardcourt_outdoor': 'Hard',
      'hardcourt_indoor': 'Indoor',
      'grass': 'Grass',
      'red_clay': 'Clay',
      'green_clay': 'Clay',
      'carpet_indoor': 'Carpet',
      'synthetic_indoor': 'Indoor',
      'synthetic_outdoor': 'Hard',
      'red_clay_indoor': 'Clay',
      'synthetic_grass': 'Grass'
    };

    return surfaceMap[surface.toLowerCase()] || surface;
  }

  private formatLocation(city?: string, country?: string): string {
    if (city && country) return `${city}, ${country}`;
    if (city) return city;
    if (country) return country;
    return 'Unknown Location';
  }

  private mapStatus(status: string): any {
    const statusMap: Record<string, string> = {
      'live': 'live',
      'started': 'live',
      'ended': 'completed',
      'closed': 'completed',
      'cancelled': 'cancelled',
      'postponed': 'postponed',
      'suspended': 'suspended',
      'not_started': 'scheduled',
      'delayed': 'scheduled',
      'interrupted': 'live',
      'abandoned': 'cancelled'
    };

    return statusMap[status.toLowerCase()] || 'scheduled';
  }

  private transformScore(status: any): any {
    if (!status.period_scores || status.period_scores.length === 0) {
      // Check for current games only
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

    const sets = status.period_scores.map((period: any) => {
      const setScore = {
        player1: period.home_score || 0,
        player2: period.away_score || 0
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

    const score: any = { sets };

    // Add current games if match is live and different from period scores
    if (status.status === 'live' &&
        status.home_score !== undefined &&
        status.away_score !== undefined) {
      score.games = {
        player1: status.home_score,
        player2: status.away_score
      };
    }

    return score;
  }

  // Clear cache method
  clearCache(): void {
    this.cache.clear();
  }

  async getCompetitionsByCategory(categoryId: string): Promise<CompetitionsData> {
    try {
      const data: CompetitionsByCategoryResponse = await this.request(`/categories/${categoryId}/competitions.json`);

      console.log(`SportRadar Competitions: Found ${data.competitions?.length || 0} competitions for category ${categoryId}`);

      if (!data.competitions || !Array.isArray(data.competitions)) {
        throw new Error(`No competitions found for category ${categoryId}. Available data keys: ${Object.keys(data).join(', ')}`);
      }

      // Transform to our internal format
      const transformedCompetitions = data.competitions.map(comp => ({
        id: comp.id,
        name: comp.name,
        gender: comp.gender as "men" | "women" | "mixed",
        level: comp.level,
        type: comp.type,
        parent_id: comp.parent_id
      }));

      return {
        competitions: transformedCompetitions,
        lastUpdated: data.generated_at
      };
    } catch (error) {
      console.error('Failed to fetch competitions from SportRadar API:', error);
      throw new Error(`Failed to fetch competitions for category ${categoryId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCompetitionInfo(competitionId: string): Promise<CompetitionInfoResponse> {
    try {
      const data: CompetitionInfoResponse = await this.request(`/competitions/${competitionId}/info.json`);

      console.log(`SportRadar Competition Info: Loaded details for ${data.competition?.name} (${competitionId})`);

      if (!data.competition) {
        throw new Error(`No competition info found for ID: ${competitionId}. Available data keys: ${Object.keys(data).join(', ')}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to fetch competition info from SportRadar API:', error);
      throw new Error(`Failed to fetch competition info for ${competitionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getHeadToHead(competitor1Id: string, competitor2Id: string): Promise<HeadToHeadData> {
    try {
      const data = await this.request(`/competitors/${competitor1Id}/versus/${competitor2Id}/summaries.json`);

      console.log(`SportRadar Head-to-Head: Loaded data for ${competitor1Id} vs ${competitor2Id}`);

      if (!data) {
        throw new Error(`No head-to-head data found for ${competitor1Id} vs ${competitor2Id}`);
      }

      // Transform to our internal format
      const apiData = data as any;
      return {
        competitors: apiData.competitors || [],
        last_meetings: apiData.last_meetings || [],
        next_meetings: apiData.next_meetings || [],
        generated_at: apiData.generated_at
      };
    } catch (error) {
      console.error('Failed to fetch head-to-head data from SportRadar API:', error);
      throw new Error(`Failed to fetch head-to-head data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get cache statistics
  getCacheStats(): { size: number; endpoints: string[] } {
    return {
      size: this.cache.size,
      endpoints: Array.from(this.cache.keys())
    };
  }
}