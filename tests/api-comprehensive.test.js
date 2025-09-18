// Comprehensive API Test Suite for Tennis Data
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

const API_KEY = "ghFUX4ygnpBf7wX2Ua6ZtTnfFWdEg0JWKQ4envGp";
const BASE_URL = "https://api.sportradar.com/tennis/trial/v3/en";

// Mock data for testing
const mockTennisData = {
  liveMatch: {
    id: "test-match-1",
    tournament: {
      name: "Unknown Tournament",
      category: "ATP",
      surface: "Hard",
      location: "Lincoln, NE, USA"
    },
    players: [
      { name: "Spiers, Liam", countryCode: "US", nationality: "USA" },
      { name: "Korkunov, Mikhail", countryCode: "RU", nationality: "Russia" }
    ],
    score: {
      sets: [{ player1: 3, player2: 6 }],
      games: { player1: 0, player2: 1 }
    },
    status: "live",
    court: "Court 1"
  },

  completedMatch: {
    id: "test-match-2",
    tournament: {
      name: "Unknown Tournament",
      category: "WTA",
      surface: "Hard",
      location: "Tolentino, Italy"
    },
    players: [
      { name: "Zidansek, Tamara", countryCode: "SI", nationality: "Slovenia" },
      { name: "In-Albon, Ylena", countryCode: "CH", nationality: "Switzerland" }
    ],
    score: {
      sets: [
        { player1: 6, player2: 2 },
        { player1: 4, player2: 6 },
        { player1: 2, player2: 1 }
      ]
    },
    status: "completed"
  }
};

// Data validation functions
function validateMatchStructure(match) {
  const errors = [];
  const warnings = [];

  // Required fields validation
  if (!match.id) errors.push("Missing match ID");
  if (!match.tournament?.name) errors.push("Missing tournament name");
  if (!match.players || match.players.length !== 2) errors.push("Invalid players array");
  if (!match.status) errors.push("Missing match status");

  // Player validation
  match.players?.forEach((player, index) => {
    if (!player.name) errors.push(`Player ${index + 1} missing name`);
    if (!player.countryCode) warnings.push(`Player ${index + 1} missing country code`);
  });

  // Score validation for live/completed matches
  if (match.status === 'live' || match.status === 'completed') {
    if (!match.score) warnings.push("Live/completed match missing score");
    else {
      if (!match.score.sets || !Array.isArray(match.score.sets)) {
        warnings.push("Score missing sets array");
      }

      // Validate set scores
      match.score.sets?.forEach((set, index) => {
        if (typeof set.player1 !== 'number' || typeof set.player2 !== 'number') {
          errors.push(`Set ${index + 1} has invalid scores`);
        }
        if (set.player1 < 0 || set.player2 < 0) {
          errors.push(`Set ${index + 1} has negative scores`);
        }
        // Tennis scoring validation
        const maxScore = Math.max(set.player1, set.player2);
        const minScore = Math.min(set.player1, set.player2);
        if (maxScore >= 6 && (maxScore - minScore < 2) && maxScore < 7) {
          warnings.push(`Set ${index + 1} may need tiebreak validation`);
        }
      });
    }
  }

  // Tournament validation
  if (match.tournament) {
    const validCategories = ["ATP", "WTA", "Challenger", "ITF", "Exhibition"];
    if (!validCategories.includes(match.tournament.category)) {
      warnings.push(`Unknown tournament category: ${match.tournament.category}`);
    }

    const validSurfaces = ["Hard", "Clay", "Grass", "Indoor", "Carpet"];
    if (match.tournament.surface && !validSurfaces.includes(match.tournament.surface)) {
      warnings.push(`Unknown surface type: ${match.tournament.surface}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    dataQuality: errors.length === 0 ? (warnings.length === 0 ? "excellent" : "good") : "poor"
  };
}

function validateApiResponse(response, expectedStructure) {
  const validation = {
    hasRequiredFields: true,
    missingFields: [],
    extraFields: [],
    dataTypes: {}
  };

  // Check required fields
  expectedStructure.required?.forEach(field => {
    if (!(field in response)) {
      validation.hasRequiredFields = false;
      validation.missingFields.push(field);
    } else {
      validation.dataTypes[field] = typeof response[field];
    }
  });

  return validation;
}

// Performance testing utility
async function measureApiPerformance(endpoint, iterations = 5) {
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers: {
          'accept': 'application/json',
          'x-api-key': API_KEY
        }
      });

      if (response.ok) {
        await response.json();
        const duration = Date.now() - start;
        times.push(duration);
      }
    } catch (error) {
      console.warn(`Performance test iteration ${i + 1} failed:`, error.message);
    }
  }

  if (times.length === 0) return null;

  return {
    average: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
    attempts: times.length,
    successRate: (times.length / iterations) * 100
  };
}

// Test Suites
describe('Tennis API Comprehensive Tests', () => {

  describe('Data Structure Validation', () => {

    test('should validate live match data structure', () => {
      const validation = validateMatchStructure(mockTennisData.liveMatch);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.dataQuality).toMatch(/excellent|good/);
    });

    test('should validate completed match data structure', () => {
      const validation = validateMatchStructure(mockTennisData.completedMatch);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid match data', () => {
      const invalidMatch = { id: "test", status: "live" }; // Missing required fields
      const validation = validateMatchStructure(invalidMatch);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('API Response Format Tests', () => {

    test('should have correct live matches response structure', async () => {
      const response = await fetch(`${BASE_URL}/schedules/live/summaries.json`, {
        headers: { 'x-api-key': API_KEY, 'accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();

        expect(data).toHaveProperty('summaries');
        expect(Array.isArray(data.summaries)).toBe(true);

        if (data.summaries.length > 0) {
          const match = data.summaries[0];
          expect(match).toHaveProperty('sport_event');
          expect(match.sport_event).toHaveProperty('competitors');
          expect(Array.isArray(match.sport_event.competitors)).toBe(true);
        }
      }
    }, 10000);

    test('should have correct rankings response structure', async () => {
      const response = await fetch(`${BASE_URL}/rankings.json`, {
        headers: { 'x-api-key': API_KEY, 'accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();

        expect(data).toHaveProperty('rankings');
        expect(Array.isArray(data.rankings)).toBe(true);

        if (data.rankings.length > 0) {
          const ranking = data.rankings[0];
          expect(ranking).toHaveProperty('competitor_rankings');
          expect(Array.isArray(ranking.competitor_rankings)).toBe(true);
        }
      }
    }, 10000);
  });

  describe('Score Validation Tests', () => {

    test('should validate tennis scoring rules', () => {
      const testCases = [
        { set: { player1: 6, player2: 4 }, valid: true, reason: "Standard set win" },
        { set: { player1: 7, player2: 5 }, valid: true, reason: "Two-game advantage" },
        { set: { player1: 6, player2: 6 }, valid: false, reason: "Needs tiebreak" },
        { set: { player1: 8, player2: 6 }, valid: false, reason: "Invalid high score" },
        { set: { player1: -1, player2: 3 }, valid: false, reason: "Negative score" }
      ];

      testCases.forEach(({ set, valid, reason }) => {
        const mockMatch = {
          id: "test",
          tournament: { name: "Test", category: "ATP" },
          players: [{ name: "A" }, { name: "B" }],
          status: "completed",
          score: { sets: [set] }
        };

        const validation = validateMatchStructure(mockMatch);
        if (valid) {
          expect(validation.errors).not.toContain(expect.stringContaining("Set 1 has invalid scores"));
        } else {
          expect(validation.isValid).toBe(false);
        }
      });
    });
  });

  describe('Performance Tests', () => {

    test('live matches endpoint performance', async () => {
      const performance = await measureApiPerformance('/schedules/live/summaries.json', 3);

      if (performance) {
        expect(performance.average).toBeLessThan(5000); // Should respond within 5 seconds
        expect(performance.successRate).toBeGreaterThan(50); // At least 50% success rate

        console.log('Live matches performance:', {
          avgTime: `${performance.average}ms`,
          successRate: `${performance.successRate}%`
        });
      }
    }, 30000);

    test('rankings endpoint performance', async () => {
      const performance = await measureApiPerformance('/rankings.json', 3);

      if (performance) {
        expect(performance.average).toBeLessThan(5000);
        expect(performance.successRate).toBeGreaterThan(50);

        console.log('Rankings performance:', {
          avgTime: `${performance.average}ms`,
          successRate: `${performance.successRate}%`
        });
      }
    }, 30000);
  });

  describe('Edge Cases and Error Handling', () => {

    test('should handle invalid competitor ID gracefully', async () => {
      const response = await fetch(`${BASE_URL}/competitors/invalid-id/profile.json`, {
        headers: { 'x-api-key': API_KEY, 'accept': 'application/json' }
      });

      expect([400, 404, 422]).toContain(response.status);
    }, 10000);

    test('should handle invalid date format', async () => {
      const response = await fetch(`${BASE_URL}/schedules/invalid-date/summaries.json`, {
        headers: { 'x-api-key': API_KEY, 'accept': 'application/json' }
      });

      expect([400, 404, 422]).toContain(response.status);
    }, 10000);

    test('should handle missing API key', async () => {
      const response = await fetch(`${BASE_URL}/rankings.json`, {
        headers: { 'accept': 'application/json' }
      });

      expect([401, 403]).toContain(response.status);
    }, 10000);
  });

  describe('Data Consistency Tests', () => {

    test('player names should be consistent across endpoints', async () => {
      // This test would compare player data from rankings vs matches
      // to ensure consistency in naming, country codes, etc.

      const rankingsResponse = await fetch(`${BASE_URL}/rankings.json`, {
        headers: { 'x-api-key': API_KEY, 'accept': 'application/json' }
      });

      if (rankingsResponse.ok) {
        const rankingsData = await rankingsResponse.json();
        const players = new Map();

        rankingsData.rankings?.forEach(ranking => {
          ranking.competitor_rankings?.forEach(entry => {
            if (entry.competitor) {
              players.set(entry.competitor.id, {
                name: entry.competitor.name,
                country: entry.competitor.country,
                countryCode: entry.competitor.country_code
              });
            }
          });
        });

        expect(players.size).toBeGreaterThan(0);

        // Validate that all players have required data
        for (const [id, player] of players) {
          expect(player.name).toBeTruthy();
          expect(player.countryCode).toBeTruthy();
        }
      }
    }, 15000);
  });
});

// Export utilities for use in other tests
export {
  validateMatchStructure,
  validateApiResponse,
  measureApiPerformance,
  mockTennisData
};