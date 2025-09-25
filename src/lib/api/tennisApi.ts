import type { TennisApiProvider } from "./types";
import { SportRadarProvider } from "./providers/sportradar";
import { OfficialSportRadarProvider } from "./providers/official-sportradar";
import { LocalDatasetProvider } from "./providers/local-dataset";

class TennisApi {
  private provider: TennisApiProvider;

  constructor(provider: TennisApiProvider) {
    this.provider = provider;
  }

  async getATPRankings(limit?: number, date?: string) {
    return this.provider.getRankings("ATP", limit, date);
  }

  async getWTARankings(limit?: number, date?: string) {
    return this.provider.getRankings("WTA", limit, date);
  }

  async getAvailableRankingDates() {
    if (this.provider instanceof LocalDatasetProvider) {
      return this.provider.getAvailableRankingDates();
    }
    return [];
  }

  async getAvailableRankingYears() {
    if (this.provider instanceof LocalDatasetProvider) {
      return this.provider.getAvailableRankingYears();
    }
    return [];
  }

  async getLiveMatches() {
    return this.provider.getLiveMatches();
  }

  async getTodayMatches() {
    return this.provider.getTodayMatches();
  }

  async getMatchesByDate(date: string) {
    return this.provider.getMatchesByDate(date);
  }

  async getCompetitorProfile(competitorId: string) {
    return this.provider.getCompetitorProfile(competitorId);
  }

  async getATPCompetitions() {
    if (this.provider.getCompetitionsByCategory) {
      return this.provider.getCompetitionsByCategory("sr:category:3"); // ATP category ID
    }
    throw new Error("Provider does not support competitions endpoint");
  }

  async getWTACompetitions() {
    if (this.provider.getCompetitionsByCategory) {
      return this.provider.getCompetitionsByCategory("sr:category:2"); // WTA category ID
    }
    throw new Error("Provider does not support competitions endpoint");
  }

  async getHeadToHead(competitor1Id: string, competitor2Id: string) {
    if (this.provider.getHeadToHead) {
      return this.provider.getHeadToHead(competitor1Id, competitor2Id);
    }
    throw new Error("Provider does not support head-to-head endpoint");
  }

  // Switch provider if needed
  setProvider(provider: TennisApiProvider) {
    this.provider = provider;
  }
}

// Create singleton instance
function createTennisApi() {
  // Use local dataset provider instead of SportRadar
  const provider = new LocalDatasetProvider('./data');
  return new TennisApi(provider);
}

export const tennisApi = createTennisApi();
export { TennisApi, SportRadarProvider, OfficialSportRadarProvider, LocalDatasetProvider };