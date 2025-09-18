// Enhanced Types for Better Tennis Data Handling
export interface EnhancedScore {
  sets: Array<{
    player1: number;
    player2: number;
    tiebreak?: {
      player1: number;
      player2: number;
    };
  }>;
  currentSet?: {
    player1: number;
    player2: number;
    serving?: 1 | 2; // Which player is serving
  };
  games?: {
    player1: number;
    player2: number;
  };
  // Additional score details
  totalGamesWon?: {
    player1: number;
    player2: number;
  };
  matchDuration?: number; // in minutes
}

export interface EnhancedTournament {
  id: string;
  name: string;
  category: "ATP" | "WTA" | "Challenger" | "ITF" | "Exhibition";
  level?: "Grand Slam" | "Masters 1000" | "ATP 500" | "ATP 250" | "WTA 1000" | "WTA 500" | "WTA 250";
  surface: "Hard" | "Clay" | "Grass" | "Indoor" | "Carpet";
  surfaceSpeed?: "Fast" | "Medium-Fast" | "Medium" | "Medium-Slow" | "Slow";
  location: string;
  city?: string;
  country?: string;
  startDate: string;
  endDate: string;
  prizeMoney?: number;
  drawSize?: number;
}

export interface EnhancedPlayer {
  id: string;
  name: string;
  nationality: string;
  countryCode: string;
  abbreviation?: string;
  // Additional player info
  ranking?: number;
  age?: number;
  height?: number; // in cm
  weight?: number; // in kg
  handedness?: "right" | "left";
  previousMatches?: number; // head-to-head vs opponent
  recentForm?: string[]; // W/L for last 5 matches
  seedNumber?: number; // tournament seeding
}

export interface EnhancedMatch {
  id: string;
  tournament: EnhancedTournament;
  round: string;
  status: "scheduled" | "live" | "completed" | "cancelled" | "walkover" | "retired";
  players: [EnhancedPlayer, EnhancedPlayer];
  score?: EnhancedScore;
  startTime?: string;
  endTime?: string;
  court?: string;
  courtType?: "Centre Court" | "Court 1" | "Court 2" | "Practice Court";
  // Match statistics
  stats?: {
    duration?: number;
    aces?: [number, number];
    doubleFaults?: [number, number];
    firstServePercentage?: [number, number];
    winOnFirstServe?: [number, number];
    breakPointsWon?: [number, number];
    totalPoints?: [number, number];
  };
  // Betting odds (if available)
  odds?: {
    player1: number;
    player2: number;
    lastUpdated: string;
  };
  // Live data indicators
  isLive?: boolean;
  liveIndicators?: {
    serving?: 1 | 2;
    setPoint?: boolean;
    matchPoint?: boolean;
    breakPoint?: boolean;
  };
}

export interface LiveDataUpdate {
  matchId: string;
  timestamp: string;
  score: EnhancedScore;
  status: EnhancedMatch['status'];
  liveIndicators?: EnhancedMatch['liveIndicators'];
  lastAction?: string; // "Ace", "Winner", "Unforced Error", etc.
}

// Data validation schemas
export interface MatchValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  dataQuality: "excellent" | "good" | "fair" | "poor";
}

// Test data structure for comprehensive testing
export interface TestScenario {
  name: string;
  description: string;
  mockData: any;
  expectedResult: any;
  testType: "unit" | "integration" | "e2e";
}

export interface ApiTestSuite {
  scenarios: TestScenario[];
  performanceTests: {
    endpoint: string;
    maxResponseTime: number;
    concurrentRequests: number;
  }[];
  validationTests: {
    dataStructure: string;
    requiredFields: string[];
    optionalFields: string[];
  }[];
}