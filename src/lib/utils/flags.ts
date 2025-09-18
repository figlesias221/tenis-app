/**
 * Flag utilities for consistent flag handling across the tennis app
 * Uses local SVG flags for better performance and reliability
 */

// Normalize country codes to handle edge cases
export function normalizeCountryCode(code: string): string {
  const codeMap: Record<string, string> = {
    'Neutral': 'UN',
    'N/A': 'UN',
    'XX': 'UN',
    'neutral': 'UN',
    'n/a': 'UN'
  };

  const normalized = codeMap[code] || code.toUpperCase();

  // Map 3-letter ISO codes to 2-letter codes (SportRadar uses 3-letter codes)
  const iso3ToIso2: Record<string, string> = {
    'ESP': 'ES', // Spain
    'ITA': 'IT', // Italy
    'DEU': 'DE', // Germany
    'SRB': 'RS', // Serbia
    'USA': 'US', // United States
    'GBR': 'GB', // Great Britain
    'AUS': 'AU', // Australia
    'DNK': 'DK', // Denmark
    'NOR': 'NO', // Norway
    'CZE': 'CZ', // Czech Republic
    'KAZ': 'KZ', // Kazakhstan
    'CAN': 'CA', // Canada
    'GRC': 'GR', // Greece
    'BGR': 'BG', // Bulgaria
    'ARG': 'AR', // Argentina
    'FRA': 'FR', // France
    'NLD': 'NL', // Netherlands
    'BRA': 'BR', // Brazil
    'POL': 'PL', // Poland
    'RUS': 'RU', // Russia
    'CHE': 'CH', // Switzerland
    'AUT': 'AT', // Austria
    'BEL': 'BE', // Belgium
    'HUN': 'HU', // Hungary
    'PRT': 'PT', // Portugal
    'ROU': 'RO', // Romania
    'SVK': 'SK', // Slovakia
    'SVN': 'SI', // Slovenia
    'HRV': 'HR', // Croatia
    'UKR': 'UA', // Ukraine
    'JPN': 'JP', // Japan
    'CHN': 'CN', // China
    'KOR': 'KR', // South Korea
    'IND': 'IN', // India
    'THA': 'TH', // Thailand
    'MEX': 'MX', // Mexico
    'CHL': 'CL', // Chile
    'COL': 'CO', // Colombia
    'URY': 'UY', // Uruguay
    'UYU': 'UY', // Uruguay (alternative code)
    'VEN': 'VE', // Venezuela
    'PER': 'PE', // Peru
    'ECU': 'EC', // Ecuador
    'BOL': 'BO', // Bolivia
    'PRY': 'PY', // Paraguay
    'ZAF': 'ZA', // South Africa
    'TUN': 'TN', // Tunisia
    'MAR': 'MA', // Morocco
    'EGY': 'EG', // Egypt
    'ISR': 'IL', // Israel
    'TUR': 'TR', // Turkey
    'FIN': 'FI', // Finland
    'SWE': 'SE', // Sweden
    'LTU': 'LT', // Lithuania
    'LVA': 'LV', // Latvia
    'EST': 'EE', // Estonia
    'IRL': 'IE', // Ireland
    'ISL': 'IS', // Iceland
    'MLT': 'MT', // Malta
    'CYP': 'CY', // Cyprus
    'LUX': 'LU', // Luxembourg
    'MCO': 'MC', // Monaco
    'SMR': 'SM', // San Marino
    'AND': 'AD', // Andorra
    'VAT': 'VA', // Vatican
    'LIE': 'LI', // Liechtenstein
    'NZL': 'NZ', // New Zealand
    'TWN': 'TW', // Taiwan
    'HKG': 'HK', // Hong Kong
    'SGP': 'SG', // Singapore
    'MYS': 'MY', // Malaysia
    'IDN': 'ID', // Indonesia
    'PHL': 'PH', // Philippines
    'VNM': 'VN', // Vietnam
    'ENG': 'GB', // England -> Great Britain
    'SCO': 'GB', // Scotland -> Great Britain
    'WAL': 'GB', // Wales -> Great Britain
    'NIR': 'GB', // Northern Ireland -> Great Britain
    'BIH': 'BA', // Bosnia and Herzegovina
    'QAT': 'QA', // Qatar
  };

  return iso3ToIso2[normalized] || normalized;
}

// Get local flag path for a country code
export function getFlagUrl(countryCode: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
  const normalized = normalizeCountryCode(countryCode);
  return `/flags/${normalized.toLowerCase()}.svg`;
}

// Get appropriate alt text for flag images
export function getFlagAlt(countryCode: string, nationality?: string): string {
  const normalized = normalizeCountryCode(countryCode);

  if (normalized === 'UN' || countryCode === 'Neutral' || countryCode === 'N/A') {
    return 'Neutral';
  }

  return nationality || normalized;
}

// Check if we have a flag for this country code
export function hasFlagSupport(countryCode: string): boolean {
  const normalized = normalizeCountryCode(countryCode);

  // List of tennis countries we extracted flags for
  const supportedCountries = [
    'AD', 'AE', 'AR', 'AT', 'AU', 'BA', 'BE', 'BG', 'BR', 'CA', 'CH', 'CL', 'CN', 'CO', 'CR', 'CZ',
    'DE', 'DK', 'EC', 'EE', 'ES', 'FI', 'FR', 'GB', 'GR', 'HK', 'HR', 'HU', 'IE', 'IL', 'IN', 'IT',
    'JP', 'KZ', 'LT', 'LU', 'LV', 'MA', 'MC', 'MD', 'ME', 'MX', 'MY', 'NL', 'NO', 'NZ', 'PL', 'PT',
    'QA', 'RO', 'RS', 'RU', 'SE', 'SG', 'SI', 'SK', 'TH', 'TN', 'TR', 'UA', 'US', 'UY', 'VE', 'ZA'
  ];

  return supportedCountries.includes(normalized);
}

// Get flag component props for consistent usage
export function getFlagProps(countryCode: string, nationality?: string, size: 'small' | 'medium' | 'large' = 'medium') {
  return {
    countryCode: normalizeCountryCode(countryCode),
    nationality: nationality || getFlagAlt(countryCode, nationality),
    size
  };
}