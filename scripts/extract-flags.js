#!/usr/bin/env node

/**
 * Script to extract SVG flags from country-flag-icons library
 * and copy them to public/flags directory for use in Astro
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Every country the site can name.
//
// The archive's own list, plus every ISO-2 target of the IOC map in
// src/lib/live/countries.ts - the live feed uses IOC codes, and a country the
// board can name without a flag to name it with falls back to a bare text
// code. Peru and Paraguay were both missing until the live board arrived.
const tennisCountries = [
  'AD', 'AE', 'AM', 'AR', 'AT', 'AU', 'AW', 'AZ', 'BA', 'BB', 'BE', 'BG', 'BH', 'BI', 'BJ', 'BM',
  'BO', 'BR', 'BS', 'BW', 'BY', 'CA', 'CH', 'CI', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CY', 'CZ',
  'DE', 'DK', 'DO', 'DZ', 'EC', 'EE', 'EG', 'ES', 'ET', 'FI', 'FR', 'GA', 'GB', 'GE', 'GH', 'GR',
  'GT', 'HK', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IN', 'IQ', 'IR', 'IS', 'IT', 'JM', 'JO',
  'JP', 'KE', 'KH', 'KR', 'KW', 'KZ', 'LB', 'LI', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME',
  'MG', 'MK', 'MN', 'MT', 'MX', 'MY', 'NG', 'NL', 'NO', 'NZ', 'PA', 'PE', 'PH', 'PK', 'PL', 'PR',
  'PT', 'PY', 'QA', 'RO', 'RS', 'RU', 'SA', 'SE', 'SG', 'SI', 'SK', 'SV', 'SY', 'TH', 'TN', 'TR',
  'TT', 'TW', 'UA', 'UN', 'US', 'UY', 'UZ', 'VE', 'VN', 'XK', 'ZA', 'ZW'
];

const sourceDir = join(__dirname, '../node_modules/country-flag-icons/3x2');
const targetDir = join(__dirname, '../public/flags');

// Create target directory
if (!existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
}

console.log('🏁 Extracting tennis country flags...');

let extracted = 0;
let skipped = 0;

for (const country of tennisCountries) {
  const sourceFile = join(sourceDir, `${country}.svg`);
  const targetFile = join(targetDir, `${country.toLowerCase()}.svg`);

  try {
    if (existsSync(sourceFile)) {
      const content = readFileSync(sourceFile, 'utf8');
      writeFileSync(targetFile, content);
      extracted++;
      console.log(`✅ ${country}`);
    } else {
      console.log(`⚠️  ${country} - not found`);
      skipped++;
    }
  } catch (error) {
    console.log(`❌ ${country} - error: ${error.message}`);
    skipped++;
  }
}

console.log(`\n🎯 Complete! Extracted ${extracted} flags, skipped ${skipped}`);
console.log(`📁 Flags saved to: ${targetDir}`);