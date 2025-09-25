import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface AtpPlayer {
  player_id: string;
  name_first: string;
  name_last: string;
  hand: 'R' | 'L' | 'U' | '';
  dob: string; // YYYYMMDD format
  ioc: string; // country code
  height: string; // cm
  wikidata_id?: string;
}

export interface AtpRanking {
  ranking_date: string; // YYYYMMDD format
  rank: number;
  player: string; // player_id
  points: number;
}

export interface AtpMatch {
  tourney_id: string;
  tourney_name: string;
  surface: string;
  draw_size: string;
  tourney_level: string; // A, M, F, etc.
  tourney_date: string; // YYYYMMDD format
  match_num: string;
  winner_id: string;
  winner_seed?: string;
  winner_entry?: string;
  winner_name: string;
  winner_hand: 'R' | 'L' | 'U' | '';
  winner_ht?: string; // height in cm
  winner_ioc: string; // country code
  winner_age?: string;
  loser_id: string;
  loser_seed?: string;
  loser_entry?: string;
  loser_name: string;
  loser_hand: 'R' | 'L' | 'U' | '';
  loser_ht?: string; // height in cm
  loser_ioc: string; // country code
  loser_age?: string;
  score: string;
  best_of: string;
  round: string;
  minutes?: string;
  // Match statistics (optional)
  w_ace?: string;
  w_df?: string;
  w_svpt?: string;
  w_1stIn?: string;
  w_1stWon?: string;
  w_2ndWon?: string;
  w_SvGms?: string;
  w_bpSaved?: string;
  w_bpFaced?: string;
  l_ace?: string;
  l_df?: string;
  l_svpt?: string;
  l_1stIn?: string;
  l_1stWon?: string;
  l_2ndWon?: string;
  l_SvGms?: string;
  l_bpSaved?: string;
  l_bpFaced?: string;
  winner_rank?: string;
  winner_rank_points?: string;
  loser_rank?: string;
  loser_rank_points?: string;
}

/**
 * Simple CSV parser - splits by comma but handles quoted fields
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last field
  result.push(current.trim());
  return result;
}

/**
 * Parse CSV content into array of objects
 */
export function parseCsv<T>(content: string): T[] {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  const data: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length === headers.length) {
      const row = {} as T;
      for (let j = 0; j < headers.length; j++) {
        (row as any)[headers[j]] = values[j];
      }
      data.push(row);
    }
  }

  return data;
}

/**
 * Load and parse ATP players CSV
 */
export function loadAtpPlayers(dataPath: string = './data'): AtpPlayer[] {
  const filePath = join(process.cwd(), dataPath, 'atp_players.csv');
  const content = readFileSync(filePath, 'utf-8');
  return parseCsv<AtpPlayer>(content);
}

/**
 * Load and parse ATP rankings CSV
 */
export function loadAtpRankings(dataPath: string = './data'): AtpRanking[] {
  const filePath = join(process.cwd(), dataPath, 'atp_rankings_current.csv');
  try {
    const content = readFileSync(filePath, 'utf-8');
    return parseCsv<AtpRanking>(content);
  } catch (error) {
    console.error('Error loading ATP rankings:', error);
    return [];
  }
}

/**
 * Load ATP rankings for a specific year
 */
export function loadAtpRankingsForYear(year: number, dataPath: string = './data'): AtpRanking[] {
  const filePath = join(process.cwd(), dataPath, `atp_rankings_${year}.csv`);
  try {
    const content = readFileSync(filePath, 'utf-8');
    return parseCsv<AtpRanking>(content);
  } catch (error) {
    // Try current file if no year-specific file exists (for 2024)
    if (year === 2024) {
      return loadAtpRankings(dataPath);
    }
    console.warn(`No rankings file found for year ${year}`);
    return [];
  }
}

/**
 * Load ATP rankings for multiple years
 */
export function loadAtpRankingsMultiYear(years: number[], dataPath: string = './data'): AtpRanking[] {
  const allRankings: AtpRanking[] = [];

  for (const year of years) {
    const yearRankings = loadAtpRankingsForYear(year, dataPath);
    allRankings.push(...yearRankings);
  }

  return allRankings;
}

/**
 * Get all available ranking years based on existing files
 */
export function getAvailableRankingYears(dataPath: string = './data'): number[] {
  try {
    const dataDir = join(process.cwd(), dataPath);
    const files = readdirSync(dataDir);
    const years = new Set<number>();

    files.forEach(file => {
      // Match atp_rankings_YYYY.csv pattern
      const match = file.match(/^atp_rankings_(\d{4})\.csv$/);
      if (match) {
        years.add(parseInt(match[1]));
      }
      // Include current file as 2024
      if (file === 'atp_rankings_current.csv') {
        years.add(2024);
      }
    });

    return Array.from(years).sort((a, b) => b - a); // Most recent first
  } catch (error) {
    console.error('Error reading data directory:', error);
    return [2024]; // Default to current year
  }
}

/**
 * Load and parse ATP matches CSV for a specific year
 */
export function loadAtpMatches(year: number, dataPath: string = './data'): AtpMatch[] {
  const filePath = join(process.cwd(), dataPath, `atp_matches_${year}.csv`);
  try {
    const content = readFileSync(filePath, 'utf-8');
    return parseCsv<AtpMatch>(content);
  } catch (error) {
    console.warn(`No matches file found for year ${year}`);
    return [];
  }
}

/**
 * Get the latest ranking date from rankings data
 */
export function getLatestRankingDate(rankings: AtpRanking[]): string {
  if (rankings.length === 0) return '';

  // Rankings are sorted by date, so we can find the max date
  const dates = rankings.map(r => r.ranking_date);
  return Math.max(...dates.map(d => parseInt(d))).toString();
}

/**
 * Filter rankings by latest date
 */
export function getCurrentRankings(rankings: AtpRanking[]): AtpRanking[] {
  const latestDate = getLatestRankingDate(rankings);
  return rankings.filter(r => r.ranking_date === latestDate);
}

/**
 * Filter rankings by specific date
 */
export function getRankingsByDate(rankings: AtpRanking[], date: string): AtpRanking[] {
  return rankings.filter(r => r.ranking_date === date);
}

/**
 * Get all available ranking dates in descending order
 */
export function getAvailableRankingDates(rankings: AtpRanking[]): string[] {
  const dates = [...new Set(rankings.map(r => r.ranking_date))];
  return dates.sort((a, b) => parseInt(b) - parseInt(a));
}

/**
 * Format date from YYYYMMDD to YYYY-MM-DD
 */
export function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

/**
 * Parse date from YYYY-MM-DD to YYYYMMDD
 */
export function parseDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/**
 * Parse and extract match statistics from ATP match data
 */
export function parseMatchStats(match: AtpMatch): {
  winner: any;
  loser: any;
  matchDuration?: number;
} {
  const winner = {
    aces: match.w_ace ? parseInt(match.w_ace) : undefined,
    doubleFaults: match.w_df ? parseInt(match.w_df) : undefined,
    firstServePoints: match.w_svpt ? parseInt(match.w_svpt) : undefined,
    firstServeIn: match.w_1stIn ? parseInt(match.w_1stIn) : undefined,
    firstServeWon: match.w_1stWon ? parseInt(match.w_1stWon) : undefined,
    secondServeWon: match.w_2ndWon ? parseInt(match.w_2ndWon) : undefined,
    serviceGames: match.w_SvGms ? parseInt(match.w_SvGms) : undefined,
    breakpointsSaved: match.w_bpSaved ? parseInt(match.w_bpSaved) : undefined,
    breakpointsFaced: match.w_bpFaced ? parseInt(match.w_bpFaced) : undefined,
    rankAtTime: match.winner_rank ? parseInt(match.winner_rank) : undefined,
    pointsAtTime: match.winner_rank_points ? parseInt(match.winner_rank_points) : undefined,
  };

  const loser = {
    aces: match.l_ace ? parseInt(match.l_ace) : undefined,
    doubleFaults: match.l_df ? parseInt(match.l_df) : undefined,
    firstServePoints: match.l_svpt ? parseInt(match.l_svpt) : undefined,
    firstServeIn: match.l_1stIn ? parseInt(match.l_1stIn) : undefined,
    firstServeWon: match.l_1stWon ? parseInt(match.l_1stWon) : undefined,
    secondServeWon: match.l_2ndWon ? parseInt(match.l_2ndWon) : undefined,
    serviceGames: match.l_SvGms ? parseInt(match.l_SvGms) : undefined,
    breakpointsSaved: match.l_bpSaved ? parseInt(match.l_bpSaved) : undefined,
    breakpointsFaced: match.l_bpFaced ? parseInt(match.l_bpFaced) : undefined,
    rankAtTime: match.loser_rank ? parseInt(match.loser_rank) : undefined,
    pointsAtTime: match.loser_rank_points ? parseInt(match.loser_rank_points) : undefined,
  };

  return {
    winner,
    loser,
    matchDuration: match.minutes ? parseInt(match.minutes) : undefined
  };
}

/**
 * Calculate derived statistics from match data
 */
export function calculateMatchInsights(match: AtpMatch): {
  firstServePercentage?: { winner: number; loser: number };
  acesPerGame?: { winner: number; loser: number };
  breakpointConversion?: { winner: number; loser: number };
} {
  const stats = parseMatchStats(match);
  const insights: any = {};

  // First serve percentage
  if (stats.winner.firstServePoints && stats.winner.firstServeIn &&
      stats.loser.firstServePoints && stats.loser.firstServeIn) {
    insights.firstServePercentage = {
      winner: (stats.winner.firstServeIn / stats.winner.firstServePoints) * 100,
      loser: (stats.loser.firstServeIn / stats.loser.firstServePoints) * 100
    };
  }

  // Aces per service game
  if (stats.winner.aces && stats.winner.serviceGames &&
      stats.loser.aces && stats.loser.serviceGames) {
    insights.acesPerGame = {
      winner: stats.winner.aces / stats.winner.serviceGames,
      loser: stats.loser.aces / stats.loser.serviceGames
    };
  }

  // Breakpoint conversion
  if (stats.winner.breakpointsFaced && stats.loser.breakpointsSaved &&
      stats.loser.breakpointsFaced && stats.winner.breakpointsSaved) {
    const winnerBreakpointsWon = stats.loser.breakpointsFaced - (stats.loser.breakpointsSaved || 0);
    const loserBreakpointsWon = stats.winner.breakpointsFaced - (stats.winner.breakpointsSaved || 0);

    if (stats.loser.breakpointsFaced > 0) {
      insights.breakpointConversion = {
        winner: (winnerBreakpointsWon / stats.loser.breakpointsFaced) * 100,
        loser: (loserBreakpointsWon / stats.winner.breakpointsFaced) * 100
      };
    }
  }

  return insights;
}

/**
 * Analyze player performance on different surfaces
 */
export function analyzeSurfacePerformance(matches: AtpMatch[], playerId: string): {
  [surface: string]: {
    wins: number;
    losses: number;
    winPercentage: number;
    totalMatches: number;
  };
} {
  const surfaceStats: any = {};

  matches.forEach(match => {
    const surface = match.surface;
    const isWinner = match.winner_id === playerId;

    if (!surfaceStats[surface]) {
      surfaceStats[surface] = { wins: 0, losses: 0, totalMatches: 0 };
    }

    surfaceStats[surface].totalMatches++;
    if (isWinner) {
      surfaceStats[surface].wins++;
    } else {
      surfaceStats[surface].losses++;
    }
  });

  // Calculate win percentages
  Object.keys(surfaceStats).forEach(surface => {
    const stats = surfaceStats[surface];
    stats.winPercentage = stats.totalMatches > 0 ? (stats.wins / stats.totalMatches) * 100 : 0;
  });

  return surfaceStats;
}

/**
 * Get tournament level analysis
 */
export function analyzeTournamentLevels(matches: AtpMatch[], playerId: string): {
  [level: string]: {
    wins: number;
    losses: number;
    winPercentage: number;
    totalMatches: number;
    titles?: number;
  };
} {
  const levelStats: any = {};

  matches.forEach(match => {
    const level = match.tourney_level;
    const isWinner = match.winner_id === playerId;
    const levelName = getTournamentLevelName(level);

    if (!levelStats[levelName]) {
      levelStats[levelName] = { wins: 0, losses: 0, totalMatches: 0, titles: 0 };
    }

    levelStats[levelName].totalMatches++;
    if (isWinner) {
      levelStats[levelName].wins++;
      // Count titles (finals wins)
      if (match.round === 'F') {
        levelStats[levelName].titles++;
      }
    } else {
      levelStats[levelName].losses++;
    }
  });

  // Calculate win percentages
  Object.keys(levelStats).forEach(level => {
    const stats = levelStats[level];
    stats.winPercentage = stats.totalMatches > 0 ? (stats.wins / stats.totalMatches) * 100 : 0;
  });

  return levelStats;
}

/**
 * Get tournament level display name
 */
export function getTournamentLevelName(level: string): string {
  const levelMap: Record<string, string> = {
    'G': 'Grand Slam',
    'M': 'Masters 1000',
    'A': 'ATP 500',
    '250': 'ATP 250',
    'C': 'Challenger',
    'F': 'Futures',
    'D': 'Davis Cup',
    'O': 'Olympics'
  };
  return levelMap[level] || level;
}

/**
 * Get country code mapping for common variations
 */
export function normalizeCountryCode(ioc: string): string {
  const mappings: Record<string, string> = {
    'USA': 'US',
    'GBR': 'GB',
    'GER': 'DE',
    'ESP': 'ES',
    'FRA': 'FR',
    'ITA': 'IT',
    'AUS': 'AU',
    'CAN': 'CA',
    'RUS': 'RU',
    'JPN': 'JP',
    'CHN': 'CN',
    'IND': 'IN',
    'BRA': 'BR',
    'ARG': 'AR',
    'MEX': 'MX',
    'SUI': 'CH',
    'NED': 'NL',
    'BEL': 'BE',
    'SWE': 'SE',
    'NOR': 'NO',
    'DEN': 'DK',
    'FIN': 'FI',
    'AUT': 'AT',
    'CZE': 'CZ',
    'POL': 'PL',
    'HUN': 'HU',
    'CRO': 'HR',
    'SRB': 'RS',
    'SVK': 'SK',
    'SLO': 'SI',
    'UKR': 'UA',
    'ROU': 'RO',
    'BUL': 'BG',
    'GRE': 'GR',
    'POR': 'PT',
    'ISR': 'IL',
    'EGY': 'EG',
    'RSA': 'ZA',
    'KOR': 'KR',
    'TPE': 'TW',
    'THA': 'TH',
    'INA': 'ID',
    'MAS': 'MY',
    'SGP': 'SG',
    'PHI': 'PH',
    'VIE': 'VN',
    'UAE': 'AE',
    'QAT': 'QA',
    'KUW': 'KW',
    'LIB': 'LB',
    'TUN': 'TN',
    'MAR': 'MA',
    'ALG': 'DZ',
    'NGR': 'NG',
    'ZIM': 'ZW',
    'KEN': 'KE',
    'ETH': 'ET',
    'GHA': 'GH',
    'CIV': 'CI',
    'SEN': 'SN',
    'CAM': 'CM',
    'ANG': 'AO',
    'COL': 'CO',
    'CHI': 'CL',
    'ECU': 'EC',
    'PER': 'PE',
    'URU': 'UY',
    'PAR': 'PY',
    'VEN': 'VE',
    'BOL': 'BO',
  };

  return mappings[ioc] || ioc;
}