import type { Player } from '@/lib/api/types';

/**
 * Image service for handling player photos and avatar generation
 */

interface AvatarOptions {
  size?: number;
  backgroundColor?: string;
  textColor?: string;
  rounded?: boolean;
  bold?: boolean;
  format?: 'png' | 'svg';
}

interface ImageServiceConfig {
  defaultAvatarSize: number;
  defaultBackgroundColor: string;
  defaultTextColor: string;
  useRoundedAvatars: boolean;
  cacheDuration: number; // in milliseconds
  enableWikipediaIntegration: boolean;
  wikipediaApiTimeout: number; // in milliseconds
}

const defaultConfig: ImageServiceConfig = {
  defaultAvatarSize: 200,
  defaultBackgroundColor: '3B82F6', // Blue-500
  defaultTextColor: 'FFFFFF', // White
  useRoundedAvatars: true,
  cacheDuration: 24 * 60 * 60 * 1000, // 24 hours
  enableWikipediaIntegration: true,
  wikipediaApiTimeout: 5000, // 5 seconds
};

class ImageService {
  private config: ImageServiceConfig;
  private cache = new Map<string, { url: string; timestamp: number }>();

  constructor(config: Partial<ImageServiceConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Generate avatar URL using UI Avatars service
   * @param name Player name (used to extract initials)
   * @param options Customization options
   */
  generateAvatarUrl(name: string, options: AvatarOptions = {}): string {
    const {
      size = this.config.defaultAvatarSize,
      backgroundColor = this.config.defaultBackgroundColor,
      textColor = this.config.defaultTextColor,
      rounded = this.config.useRoundedAvatars,
      bold = true,
      format = 'png'
    } = options;

    // Extract initials from name
    const initials = this.extractInitials(name);

    // Build UI Avatars URL
    const params = new URLSearchParams({
      name: initials,
      size: size.toString(),
      background: backgroundColor,
      color: textColor,
      rounded: rounded.toString(),
      bold: bold.toString(),
      format,
      uppercase: 'true'
    });

    return `https://ui-avatars.com/api/?${params.toString()}`;
  }

  /**
   * Search for player image on Wikipedia
   * @param playerName Full name of the player
   */
  async searchWikipediaImage(playerName: string): Promise<string | null> {
    if (!this.config.enableWikipediaIntegration) {
      return null;
    }

    try {
      // Check cache first
      const cacheKey = `wikipedia:${playerName}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheDuration) {
        return cached.url;
      }

      // Search Wikipedia for the player
      const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(playerName)}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.wikipediaApiTimeout);

      try {
        const response = await fetch(searchUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'TennisApp/1.0 (https://tennis-live.example.com)'
          }
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Wikipedia API error: ${response.status}`);
        }

        const data = await response.json();

        // Check if we found a valid page with an image
        if (data && data.thumbnail && data.thumbnail.source) {
          const imageUrl = data.thumbnail.source;

          // Cache the result
          this.cache.set(cacheKey, {
            url: imageUrl,
            timestamp: Date.now()
          });

          return imageUrl;
        }

        // Try alternative search with "(tennis)" suffix
        if (!playerName.toLowerCase().includes('tennis')) {
          return await this.searchWikipediaImage(`${playerName} (tennis)`);
        }

        return null;

      } catch (error: any) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
          console.warn(`Wikipedia search timeout for ${playerName}`);
        } else {
          console.warn(`Wikipedia search failed for ${playerName}:`, error);
        }
        return null;
      }

    } catch (error: any) {
      console.warn(`Wikipedia integration error for ${playerName}:`, error);
      return null;
    }
  }

  /**
   * Search Wikidata for tennis player entities
   * @param playerName Full name of the player
   */
  async searchWikidataImage(playerName: string): Promise<string | null> {
    if (!this.config.enableWikipediaIntegration) {
      return null;
    }

    try {
      // Check cache first
      const cacheKey = `wikidata:${playerName}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheDuration) {
        return cached.url;
      }

      // Search Wikidata for tennis players
      const sparqlQuery = `
        SELECT ?item ?itemLabel ?image WHERE {
          ?item wdt:P106 wd:Q10833314 .  # tennis player
          ?item rdfs:label "${playerName}"@en .
          OPTIONAL { ?item wdt:P18 ?image }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
        }
        LIMIT 1
      `;

      const wikidataUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.wikipediaApiTimeout);

      try {
        const response = await fetch(wikidataUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'TennisApp/1.0 (https://tennis-live.example.com)',
            'Accept': 'application/json'
          }
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`Wikidata API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.results && data.results.bindings && data.results.bindings.length > 0) {
          const result = data.results.bindings[0];
          if (result.image && result.image.value) {
            const imageUrl = result.image.value;

            // Cache the result
            this.cache.set(cacheKey, {
              url: imageUrl,
              timestamp: Date.now()
            });

            return imageUrl;
          }
        }

        return null;

      } catch (error: any) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
          console.warn(`Wikidata search timeout for ${playerName}`);
        } else {
          console.warn(`Wikidata search failed for ${playerName}:`, error);
        }
        return null;
      }

    } catch (error: any) {
      console.warn(`Wikidata integration error for ${playerName}:`, error);
      return null;
    }
  }

  /**
   * Get appropriate image URL for a player
   * Returns imageUrl if available, otherwise searches Wikipedia/Wikidata, otherwise generates avatar
   */
  async getPlayerImageUrlAsync(player: Player, options: AvatarOptions = {}): Promise<string> {
    // If player has an official image, return it
    if (player.imageUrl) {
      return player.imageUrl;
    }

    // If player has a cached avatar URL, check if it's still valid
    if (player.avatarUrl) {
      const cached = this.cache.get(player.id);
      if (cached && Date.now() - cached.timestamp < this.config.cacheDuration) {
        return cached.url;
      }
    }

    // Try to find a Wikipedia image first
    if (this.config.enableWikipediaIntegration) {
      try {
        let wikipediaImage = await this.searchWikipediaImage(player.name);

        // If Wikipedia fails, try Wikidata
        if (!wikipediaImage) {
          wikipediaImage = await this.searchWikidataImage(player.name);
        }

        if (wikipediaImage) {
          // Cache the Wikipedia/Wikidata image URL
          this.cache.set(player.id, {
            url: wikipediaImage,
            timestamp: Date.now()
          });

          return wikipediaImage;
        }
      } catch (error) {
        console.warn(`Failed to fetch Wikipedia/Wikidata image for ${player.name}:`, error);
      }
    }

    // Fall back to generated avatar
    return this.getPlayerImageUrl(player, options);
  }

  /**
   * Get appropriate image URL for a player (synchronous version)
   * Returns imageUrl if available, otherwise generates avatar
   */
  getPlayerImageUrl(player: Player, options: AvatarOptions = {}): string {
    // If player has an official image, return it
    if (player.imageUrl) {
      return player.imageUrl;
    }

    // If player has a cached avatar URL, check if it's still valid
    if (player.avatarUrl) {
      const cached = this.cache.get(player.id);
      if (cached && Date.now() - cached.timestamp < this.config.cacheDuration) {
        return cached.url;
      }
    }

    // Generate new avatar URL
    const avatarUrl = this.generateAvatarUrl(player.name, options);

    // Cache the generated URL
    this.cache.set(player.id, {
      url: avatarUrl,
      timestamp: Date.now()
    });

    return avatarUrl;
  }

  /**
   * Extract initials from a player name
   */
  private extractInitials(name: string): string {
    const words = name.trim().split(/\s+/);

    if (words.length === 1) {
      // Single name - take first two characters
      return words[0].substring(0, 2).toUpperCase();
    }

    if (words.length === 2) {
      // First and last name - take first letter of each
      return (words[0][0] + words[1][0]).toUpperCase();
    }

    // Multiple names - take first letter of first and last name
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  /**
   * Get color variations for different ranking positions or tours
   */
  getColorVariation(tour: 'ATP' | 'WTA', rank?: number): { backgroundColor: string; textColor: string } {
    // ATP colors (blue tones)
    if (tour === 'ATP') {
      if (rank && rank <= 10) {
        return { backgroundColor: '1E40AF', textColor: 'FFFFFF' }; // Blue-800 for top 10
      }
      return { backgroundColor: '3B82F6', textColor: 'FFFFFF' }; // Blue-500 for others
    }

    // WTA colors (purple/pink tones)
    if (rank && rank <= 10) {
      return { backgroundColor: '7C2D92', textColor: 'FFFFFF' }; // Purple-800 for top 10
    }
    return { backgroundColor: 'A855F7', textColor: 'FFFFFF' }; // Purple-500 for others
  }

  /**
   * Preload player images for better UX
   */
  preloadImages(players: Player[]): Promise<void[]> {
    const imagePromises = players.map(player => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Don't fail on error, just resolve
        img.src = this.getPlayerImageUrl(player);
      });
    });

    return Promise.all(imagePromises);
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp >= this.config.cacheDuration) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: number; memoryUsage: string } {
    const entries = this.cache.size;
    const memoryUsage = this.estimateCacheMemoryUsage();

    return {
      size: entries,
      entries,
      memoryUsage
    };
  }

  /**
   * Estimate cache memory usage
   */
  private estimateCacheMemoryUsage(): string {
    let totalSize = 0;

    for (const [key, value] of this.cache.entries()) {
      // Rough estimation: key + url + timestamp
      totalSize += key.length * 2; // UTF-16 characters
      totalSize += value.url.length * 2;
      totalSize += 8; // timestamp (number)
    }

    // Convert to KB
    const sizeInKB = totalSize / 1024;

    if (sizeInKB < 1) {
      return `${totalSize} bytes`;
    } else if (sizeInKB < 1024) {
      return `${sizeInKB.toFixed(1)} KB`;
    } else {
      return `${(sizeInKB / 1024).toFixed(1)} MB`;
    }
  }

  /**
   * Warmup cache by pre-loading images for a list of players
   */
  async warmupCache(players: Player[]): Promise<void> {
    const promises = players.map(async (player) => {
      try {
        await this.getPlayerImageUrlAsync(player);
      } catch (error) {
        console.warn(`Failed to warmup cache for ${player.name}:`, error);
      }
    });

    await Promise.allSettled(promises);
    console.log(`Cache warmup completed for ${players.length} players`);
  }

  /**
   * Export cache data for persistence
   */
  exportCache(): string {
    const cacheData = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      url: value.url,
      timestamp: value.timestamp
    }));

    return JSON.stringify(cacheData);
  }

  /**
   * Import cache data from persistence
   */
  importCache(cacheDataJson: string): void {
    try {
      const cacheData = JSON.parse(cacheDataJson);

      if (Array.isArray(cacheData)) {
        this.cache.clear();

        for (const item of cacheData) {
          if (item.key && item.url && item.timestamp) {
            // Only import non-expired entries
            if (Date.now() - item.timestamp < this.config.cacheDuration) {
              this.cache.set(item.key, {
                url: item.url,
                timestamp: item.timestamp
              });
            }
          }
        }

        console.log(`Imported ${this.cache.size} cache entries`);
      }
    } catch (error) {
      console.error('Failed to import cache data:', error);
    }
  }
}

// Export singleton instance
export const imageService = new ImageService();

// Export types and classes for advanced usage
export type { AvatarOptions, ImageServiceConfig };
export { ImageService };
