/**
 * Builds a tournament's detail record from the match archive.
 *
 * Extracted from the old /api/tournament/[id] route so the prerendered page can
 * call it directly instead of the page fetching its own origin over HTTP - a
 * round trip that could not work once the site became static.
 */
import { LocalDatasetProvider } from '@/lib/api/providers/local-dataset';
import type { CompetitionInfoResponse } from '@/lib/api/official-types';


export async function buildTournament(tournamentId: string): Promise<CompetitionInfoResponse | null> {
  if (!tournamentId) {
    return null;
  }

  try {

    const provider = new LocalDatasetProvider('./data');

    // Get all tournaments to find the specific one
    const competitions = await provider.getCompetitionsByCategory('ATP');
    const tournament = competitions.competitions.find((comp: any) => comp.id === tournamentId);

    if (!tournament) {
      return null;
    }

    // Additional tournament details can be added here in the future
    // For now, we'll provide basic information from the competitions list

    // Create tournament detail response
    const tournamentDetail = {
      generated_at: new Date().toISOString(),
      competition: {
        id: tournament.id,
        name: tournament.name,
        parent_id: undefined,
        type: tournament.type,
        gender: tournament.gender,
        level: mapLevelToFormatterCode(tournament.level),
        category: {
          id: tournament.level,
          name: tournament.level_name
        }
      },
      info: {
        surface: tournament.surface,
        competition_status: 'ended', // Historical data
        start_date: tournament.date,
        end_date: tournament.date,
        year: parseInt(tournament.date.slice(0, 4)),
        prize_money: getPrizeMoney(tournament.level),
        prize_currency: 'USD',
        complex: getVenueInfo(tournament.name).venue,
        city: getVenueInfo(tournament.name).city,
        country: getVenueInfo(tournament.name).country,
        country_code: getVenueInfo(tournament.name).countryCode
      }
    };

    return tournamentDetail;

  } catch {
    return null;
  }
}

// Helper function to get estimated prize money based on tournament level
function getPrizeMoney(level: string): number {
  const prizeMoney: Record<string, number> = {
    'G': 50000000, // Grand Slam ~$50M
    'M': 8500000,  // Masters 1000 ~$8.5M
    'F': 15000000, // ATP Finals ~$15M
    'A': 2500000,  // ATP 500/250 ~$2.5M average
    'D': 0,        // Davis Cup - varies
    'O': 0         // Olympics - no prize money
  };
  return prizeMoney[level] || 1000000; // Default $1M
}

// Helper function to get venue information based on tournament name
function getVenueInfo(tournamentName: string): {
  venue: string;
  city: string;
  country: string;
  countryCode: string;
} {
  const venues: Record<string, any> = {
    'Australian Open': {
      venue: 'Melbourne Park',
      city: 'Melbourne',
      country: 'Australia',
      countryCode: 'AU'
    },
    'Roland Garros': {
      venue: 'Stade Roland Garros',
      city: 'Paris',
      country: 'France',
      countryCode: 'FR'
    },
    'Wimbledon': {
      venue: 'All England Lawn Tennis Club',
      city: 'London',
      country: 'Great Britain',
      countryCode: 'GB'
    },
    'Us Open': {
      venue: 'USTA Billie Jean King National Tennis Center',
      city: 'New York',
      country: 'United States',
      countryCode: 'US'
    },
    'Indian Wells Masters': {
      venue: 'Indian Wells Tennis Garden',
      city: 'Indian Wells',
      country: 'United States',
      countryCode: 'US'
    },
    'Miami Masters': {
      venue: 'Hard Rock Stadium',
      city: 'Miami Gardens',
      country: 'United States',
      countryCode: 'US'
    },
    'Monte Carlo Masters': {
      venue: 'Monte Carlo Country Club',
      city: 'Monte Carlo',
      country: 'Monaco',
      countryCode: 'MC'
    },
    'Madrid Masters': {
      venue: 'Caja Mágica',
      city: 'Madrid',
      country: 'Spain',
      countryCode: 'ES'
    },
    'Rome Masters': {
      venue: 'Foro Italico',
      city: 'Rome',
      country: 'Italy',
      countryCode: 'IT'
    },
    'Canada Masters': {
      venue: 'Aviva Centre / IGA Stadium',
      city: 'Toronto/Montreal',
      country: 'Canada',
      countryCode: 'CA'
    },
    'Cincinnati Masters': {
      venue: 'Lindner Family Tennis Center',
      city: 'Cincinnati',
      country: 'United States',
      countryCode: 'US'
    },
    'Shanghai Masters': {
      venue: 'Qizhong Forest Sports City Arena',
      city: 'Shanghai',
      country: 'China',
      countryCode: 'CN'
    },
    'Paris Masters': {
      venue: 'AccorHotels Arena',
      city: 'Paris',
      country: 'France',
      countryCode: 'FR'
    },
    'Tour Finals': {
      venue: 'Pala Alpitour',
      city: 'Turin',
      country: 'Italy',
      countryCode: 'IT'
    }
  };

  // Check for exact match first
  if (venues[tournamentName]) {
    return venues[tournamentName];
  }

  // Check for partial matches
  for (const [key, venue] of Object.entries(venues)) {
    if (tournamentName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(tournamentName.toLowerCase())) {
      return venue;
    }
  }

  // Default fallback
  return {
    venue: 'Unknown Venue',
    city: 'Unknown City',
    country: 'International',
    countryCode: 'UN'
  };
}

// Helper function to map our dataset level codes to CompetitionFormatter expected codes
function mapLevelToFormatterCode(level: string): string {
  const mapping: Record<string, string> = {
    'G': 'grand_slam',
    'M': 'atp_1000',
    'F': 'atp_world_tour_finals',
    'A': 'atp_500', // Could be 500 or 250, but formatter will handle both
    'D': 'davis_cup',
    'O': 'olympics'
  };
  return mapping[level] || level.toLowerCase();
}