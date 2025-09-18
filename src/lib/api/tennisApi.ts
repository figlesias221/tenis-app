import type { TennisApiProvider } from "./types";
import { SportRadarProvider } from "./providers/sportradar";
import { OfficialSportRadarProvider } from "./providers/official-sportradar";

class TennisApi {
  private provider: TennisApiProvider;

  constructor(provider: TennisApiProvider) {
    this.provider = provider;
  }

  async getATPRankings(limit = 100) {
    return this.provider.getRankings("ATP", limit);
  }

  async getWTARankings(limit = 100) {
    return this.provider.getRankings("WTA", limit);
  }

  async getLiveMatches() {
    return this.provider.getLiveMatches();
  }

  async getTodayMatches() {
    return this.provider.getTodayMatches();
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
  const apiKey = import.meta.env.SPORTRADAR_API_KEY || "ghFUX4ygnpBf7wX2Ua6ZtTnfFWdEg0JWKQ4envGp";

  // Use official provider with proper API structure
  const provider = new OfficialSportRadarProvider(apiKey);
  return new TennisApi(provider);
}

export const tennisApi = createTennisApi();
export { TennisApi, SportRadarProvider, OfficialSportRadarProvider };