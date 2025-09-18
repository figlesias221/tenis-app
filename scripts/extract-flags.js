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

// Tennis countries we need (based on common tennis nations)
const tennisCountries = [
  'AD', 'AE', 'AR', 'AT', 'AU', 'BA', 'BE', 'BG', 'BR', 'CA', 'CH', 'CL', 'CN', 'CO', 'CR', 'CZ',
  'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB', 'GR', 'HR', 'HU', 'IE', 'IL', 'IN', 'IT', 'JP', 'KZ',
  'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MX', 'NL', 'NO', 'NZ', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE',
  'SI', 'SK', 'TH', 'TN', 'TR', 'UA', 'UN', 'US', 'UY', 'VE', 'ZA'
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