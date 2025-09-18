/**
 * Utility to extract location information from tournament names
 * Tournament names follow patterns like "ATP City, Country Men Singles" or "Grand Slam Name"
 */

export interface TournamentLocation {
  city?: string;
  country?: string;
  countryCode?: string;
}

// Map tournament names to country codes for special cases and Grand Slams
const tournamentCountryMap: Record<string, { country: string; countryCode: string; city?: string }> = {
  // Grand Slams
  'Wimbledon': { country: 'Great Britain', countryCode: 'GB', city: 'London' },
  'Australian Open': { country: 'Australia', countryCode: 'AU', city: 'Melbourne' },
  'French Open': { country: 'France', countryCode: 'FR', city: 'Paris' },
  'US Open': { country: 'United States', countryCode: 'US', city: 'New York' },

  // Special tournaments
  'Olympic Tournament': { country: 'International', countryCode: 'UN', city: 'Olympic Host' },
  'World Team Cup': { country: 'International', countryCode: 'UN' },

  // ATP Finals locations (these change but currently)
  'ATP Finals': { country: 'Italy', countryCode: 'IT', city: 'Turin' },
  'ATP Next Generation Finals': { country: 'Italy', countryCode: 'IT', city: 'Milan' }
};

// Map country names to country codes
const countryCodeMap: Record<string, string> = {
  'Qatar': 'QA',
  'Switzerland': 'CH',
  'Australia': 'AU',
  'India': 'IN',
  'New Zealand': 'NZ',
  'Croatia': 'HR',
  'France': 'FR',
  'UAE': 'AE',
  'Netherlands': 'NL',
  'USA': 'US',
  'United States': 'US',
  'Mexico': 'MX',
  'Argentina': 'AR',
  'Morocco': 'MA',
  'Spain': 'ES',
  'Germany': 'DE',
  'Italy': 'IT',
  'Great Britain': 'GB',
  'Sweden': 'SE',
  'Canada': 'CA',
  'Romania': 'RO',
  'China': 'CN',
  'Japan': 'JP',
  'Russia': 'RU',
  'Monaco': 'MC',
  'Austria': 'AT',
  'Serbia': 'RS',
  'Malaysia': 'MY',
  'Brazil': 'BR',
  'Colombia': 'CO',
  'Turkey': 'TR',
  'Ecuador': 'EC',
  'Portugal': 'PT',
  'Bulgaria': 'BG',
  'Chile': 'CL',
  'Poland': 'PL',
  'Kazakhstan': 'KZ',
  'Tunisia': 'TN',
  'Czech Republic': 'CZ',
  'Belgium': 'BE',
  'Hungary': 'HU',
  'Slovakia': 'SK',
  'Slovenia': 'SI',
  'Finland': 'FI',
  'Greece': 'GR',
  'Norway': 'NO',
  'Denmark': 'DK',
  'Israel': 'IL',
  'South Korea': 'KR',
  'Thailand': 'TH',
  'Indonesia': 'ID',
  'Philippines': 'PH',
  'Taiwan': 'TW',
  'Vietnam': 'VN',
  'Singapore': 'SG',
  'Hong Kong': 'HK',
  'Ukraine': 'UA',
  'Belarus': 'BY',
  'Lithuania': 'LT',
  'Latvia': 'LV',
  'Estonia': 'EE',
  'Moldova': 'MD',
  'Georgia': 'GE',
  'Armenia': 'AM',
  'Azerbaijan': 'AZ',
  'Uzbekistan': 'UZ',
  'Cyprus': 'CY',
  'Malta': 'MT',
  'Luxembourg': 'LU',
  'Ireland': 'IE',
  'Iceland': 'IS',
  'Uruguay': 'UY',
  'Paraguay': 'PY',
  'Venezuela': 'VE',
  'Peru': 'PE',
  'Bolivia': 'BO',
  'South Africa': 'ZA',
  'Egypt': 'EG',
  'Algeria': 'DZ',
  'Jordan': 'JO',
  'Lebanon': 'LB',
  'Iran': 'IR',
  'Pakistan': 'PK',
  'Bangladesh': 'BD',
  'Sri Lanka': 'LK',
  'Nepal': 'NP',
  'Maldives': 'MV'
};

/**
 * Extract location information from tournament name
 */
export function extractTournamentLocation(tournamentName: string): TournamentLocation {
  // Clean the tournament name
  const cleanName = tournamentName.trim();

  // Check special cases first
  for (const [specialName, location] of Object.entries(tournamentCountryMap)) {
    if (cleanName.includes(specialName)) {
      return {
        city: location.city,
        country: location.country,
        countryCode: location.countryCode
      };
    }
  }

  // Pattern: "ATP City, Country Men Singles/Doubles"
  const atpPattern = /ATP\s+([^,]+),\s+([^M]+)\s+Men/;
  const atpMatch = cleanName.match(atpPattern);

  if (atpMatch) {
    const city = atpMatch[1].trim();
    const country = atpMatch[2].trim();
    const countryCode = countryCodeMap[country] || 'UN';

    return {
      city,
      country,
      countryCode
    };
  }

  // Pattern: "WTA City, Country Women Singles/Doubles"
  const wtaPattern = /WTA\s+([^,]+),\s+([^W]+)\s+Women/;
  const wtaMatch = cleanName.match(wtaPattern);

  if (wtaMatch) {
    const city = wtaMatch[1].trim();
    const country = wtaMatch[2].trim();
    const countryCode = countryCodeMap[country] || 'UN';

    return {
      city,
      country,
      countryCode
    };
  }

  // Fallback: look for country names in the tournament name
  for (const [country, countryCode] of Object.entries(countryCodeMap)) {
    if (cleanName.toLowerCase().includes(country.toLowerCase())) {
      return {
        country,
        countryCode
      };
    }
  }

  // Default fallback
  return {
    country: 'International',
    countryCode: 'UN'
  };
}

/**
 * Get display name for tournament location
 */
export function getTournamentLocationDisplay(location: TournamentLocation): string {
  if (location.city && location.country) {
    return `${location.city}, ${location.country}`;
  }
  if (location.city) {
    return location.city;
  }
  if (location.country) {
    return location.country;
  }
  return 'International';
}

/**
 * Check if tournament is a Grand Slam
 */
export function isGrandSlam(tournamentName: string): boolean {
  const grandSlams = ['Wimbledon', 'Australian Open', 'French Open', 'US Open'];
  return grandSlams.some(slam => tournamentName.includes(slam));
}

/**
 * Get tournament prestige level for sorting/display
 */
export function getTournamentPrestige(level: string): number {
  const prestigeMap: Record<string, number> = {
    'grand_slam': 5,
    'atp_1000': 4,
    'atp_500': 3,
    'atp_250': 2,
    'atp_world_tour_finals': 5,
    'atp_next_generation': 2,
    'wta_1000': 4,
    'wta_500': 3,
    'wta_250': 2,
    'wta_premier': 4,
    'wta_international': 2,
    'wta_championships': 5,
    'wta_elite_trophy': 3,
    'wta_master': 4,
    'wta_125': 1
  };

  return prestigeMap[level] || 1;
}