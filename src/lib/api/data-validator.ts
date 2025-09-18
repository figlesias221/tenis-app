// Real-time Data Validation for Tennis API
import type { EnhancedMatch, MatchValidation, LiveDataUpdate } from './enhanced-types';

export class TennisDataValidator {
  private static instance: TennisDataValidator;
  private validationCache = new Map<string, MatchValidation>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  static getInstance(): TennisDataValidator {
    if (!TennisDataValidator.instance) {
      TennisDataValidator.instance = new TennisDataValidator();
    }
    return TennisDataValidator.instance;
  }

  // Main validation function
  validateMatch(match: any): MatchValidation {
    const cacheKey = `${match.id}-${JSON.stringify(match.score)}`;
    const cached = this.validationCache.get(cacheKey);

    if (cached && Date.now() - (cached as any).timestamp < this.cacheTimeout) {
      return cached;
    }

    const validation = this.performFullValidation(match);
    this.validationCache.set(cacheKey, { ...validation, timestamp: Date.now() } as any);

    return validation;
  }

  private performFullValidation(match: any): MatchValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    this.validateBasicStructure(match, errors, warnings);

    // Tournament validation
    this.validateTournament(match.tournament, errors, warnings);

    // Players validation
    this.validatePlayers(match.players, errors, warnings);

    // Score validation
    if (match.score) {
      this.validateScore(match.score, match.status, errors, warnings);
    }

    // Status-specific validation
    this.validateStatusConsistency(match, errors, warnings);

    const dataQuality = this.calculateDataQuality(errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      dataQuality
    };
  }

  private validateBasicStructure(match: any, errors: string[], warnings: string[]): void {
    if (!match.id) errors.push("Missing match ID");
    if (!match.status) errors.push("Missing match status");

    const validStatuses = ['scheduled', 'live', 'completed', 'cancelled', 'walkover', 'retired'];
    if (match.status && !validStatuses.includes(match.status)) {
      warnings.push(`Unknown match status: ${match.status}`);
    }
  }

  private validateTournament(tournament: any, errors: string[], warnings: string[]): void {
    if (!tournament) {
      errors.push("Missing tournament information");
      return;
    }

    if (!tournament.name) errors.push("Missing tournament name");
    if (!tournament.category) warnings.push("Missing tournament category");
    if (!tournament.surface) warnings.push("Missing surface information");
    if (!tournament.location) warnings.push("Missing tournament location");

    // Validate category
    const validCategories = ['ATP', 'WTA', 'Challenger', 'ITF', 'Exhibition'];
    if (tournament.category && !validCategories.includes(tournament.category)) {
      warnings.push(`Unknown tournament category: ${tournament.category}`);
    }

    // Validate surface
    const validSurfaces = ['Hard', 'Clay', 'Grass', 'Indoor', 'Carpet'];
    if (tournament.surface && !validSurfaces.includes(tournament.surface)) {
      warnings.push(`Unknown surface type: ${tournament.surface}`);
    }
  }

  private validatePlayers(players: any[], errors: string[], warnings: string[]): void {
    if (!players || !Array.isArray(players)) {
      errors.push("Invalid players array");
      return;
    }

    if (players.length !== 2) {
      errors.push(`Expected 2 players, got ${players.length}`);
      return;
    }

    players.forEach((player, index) => {
      if (!player.name) errors.push(`Player ${index + 1} missing name`);
      if (!player.nationality) warnings.push(`Player ${index + 1} missing nationality`);
      if (!player.countryCode) warnings.push(`Player ${index + 1} missing country code`);

      // Validate country code format
      if (player.countryCode && !/^[A-Z]{2}$/.test(player.countryCode)) {
        warnings.push(`Player ${index + 1} has invalid country code format: ${player.countryCode}`);
      }

      // Validate ranking if present
      if (player.ranking && (typeof player.ranking !== 'number' || player.ranking < 1)) {
        warnings.push(`Player ${index + 1} has invalid ranking: ${player.ranking}`);
      }
    });
  }

  private validateScore(score: any, status: string, errors: string[], warnings: string[]): void {
    if (!score.sets || !Array.isArray(score.sets)) {
      if (status === 'live' || status === 'completed') {
        warnings.push("Missing sets array for live/completed match");
      }
      return;
    }

    // Validate each set
    score.sets.forEach((set: any, index: number) => {
      this.validateSet(set, index + 1, errors, warnings);
    });

    // Validate set count
    if (score.sets.length > 5) {
      errors.push(`Too many sets: ${score.sets.length} (maximum 5)`);
    }

    // Validate games score for live matches
    if (status === 'live' && score.games) {
      this.validateCurrentGames(score.games, errors, warnings);
    }

    // Validate match completion
    if (status === 'completed') {
      this.validateCompletedMatch(score, errors, warnings);
    }
  }

  private validateSet(set: any, setNumber: number, errors: string[], warnings: string[]): void {
    if (typeof set.player1 !== 'number' || typeof set.player2 !== 'number') {
      errors.push(`Set ${setNumber} has non-numeric scores`);
      return;
    }

    if (set.player1 < 0 || set.player2 < 0) {
      errors.push(`Set ${setNumber} has negative scores`);
      return;
    }

    const maxScore = Math.max(set.player1, set.player2);
    const minScore = Math.min(set.player1, set.player2);

    // Tennis scoring rules validation
    if (maxScore < 6) {
      // Set not yet won
      if (maxScore === minScore) {
        // This is fine for ongoing sets
      } else if (maxScore - minScore > 2) {
        warnings.push(`Set ${setNumber} has unusual score gap: ${set.player1}-${set.player2}`);
      }
    } else if (maxScore === 6) {
      if (minScore > 4) {
        warnings.push(`Set ${setNumber} should go to tiebreak or continue: ${set.player1}-${set.player2}`);
      }
    } else if (maxScore === 7) {
      if (minScore < 5) {
        errors.push(`Set ${setNumber} invalid 7-game set: ${set.player1}-${set.player2}`);
      } else if (minScore === 6) {
        // 7-6 is valid (tiebreak)
        if (!set.tiebreak) {
          warnings.push(`Set ${setNumber} 7-6 result missing tiebreak score`);
        }
      } else if (minScore === 5) {
        // 7-5 is valid
      }
    } else if (maxScore > 7) {
      if (maxScore - minScore !== 2) {
        errors.push(`Set ${setNumber} invalid long set: ${set.player1}-${set.player2}`);
      }
    }

    // Validate tiebreak if present
    if (set.tiebreak) {
      this.validateTiebreak(set.tiebreak, setNumber, errors, warnings);
    }
  }

  private validateTiebreak(tiebreak: any, setNumber: number, errors: string[], warnings: string[]): void {
    if (typeof tiebreak.player1 !== 'number' || typeof tiebreak.player2 !== 'number') {
      errors.push(`Set ${setNumber} tiebreak has non-numeric scores`);
      return;
    }

    const maxTiebreak = Math.max(tiebreak.player1, tiebreak.player2);
    const minTiebreak = Math.min(tiebreak.player1, tiebreak.player2);

    if (maxTiebreak < 7 && maxTiebreak !== minTiebreak) {
      warnings.push(`Set ${setNumber} tiebreak incomplete: ${tiebreak.player1}-${tiebreak.player2}`);
    } else if (maxTiebreak >= 7 && (maxTiebreak - minTiebreak < 2)) {
      warnings.push(`Set ${setNumber} tiebreak should continue: ${tiebreak.player1}-${tiebreak.player2}`);
    }
  }

  private validateCurrentGames(games: any, errors: string[], warnings: string[]): void {
    if (typeof games.player1 !== 'number' || typeof games.player2 !== 'number') {
      errors.push("Current games have non-numeric scores");
      return;
    }

    if (games.player1 < 0 || games.player2 < 0) {
      errors.push("Current games have negative scores");
      return;
    }

    if (games.player1 > 7 || games.player2 > 7) {
      warnings.push(`Unusual current game score: ${games.player1}-${games.player2}`);
    }
  }

  private validateCompletedMatch(score: any, errors: string[], warnings: string[]): void {
    let player1Sets = 0;
    let player2Sets = 0;

    score.sets.forEach((set: any) => {
      if (set.player1 > set.player2) player1Sets++;
      else if (set.player2 > set.player1) player2Sets++;
    });

    const totalSets = player1Sets + player2Sets;
    const maxSets = Math.max(player1Sets, player2Sets);

    // Check if match is properly completed
    if (maxSets < 2) {
      warnings.push("Completed match has fewer than 2 sets won by winner");
    }

    if (totalSets < 2) {
      warnings.push("Completed match has very few completed sets");
    }

    // Best of 3 vs best of 5 validation
    if (maxSets === 2 && totalSets <= 3) {
      // Valid best of 3
    } else if (maxSets === 3 && totalSets <= 5) {
      // Valid best of 5
    } else {
      warnings.push(`Unusual set count for completed match: ${player1Sets}-${player2Sets}`);
    }
  }

  private validateStatusConsistency(match: any, errors: string[], warnings: string[]): void {
    const { status, score, startTime, endTime } = match;

    // Time validation
    if (startTime && !this.isValidTimestamp(startTime)) {
      warnings.push("Invalid start time format");
    }

    if (endTime && !this.isValidTimestamp(endTime)) {
      warnings.push("Invalid end time format");
    }

    if (startTime && endTime) {
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      if (end <= start) {
        errors.push("End time is before or equal to start time");
      }
    }

    // Status-score consistency
    if (status === 'scheduled' && score && score.sets.length > 0) {
      warnings.push("Scheduled match has score data");
    }

    if (status === 'completed' && (!score || score.sets.length === 0)) {
      warnings.push("Completed match missing score data");
    }

    if (status === 'live' && (!score || score.sets.length === 0)) {
      warnings.push("Live match missing score data");
    }
  }

  private isValidTimestamp(timestamp: string): boolean {
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  }

  private calculateDataQuality(errors: string[], warnings: string[]): MatchValidation['dataQuality'] {
    if (errors.length > 0) return 'poor';
    if (warnings.length === 0) return 'excellent';
    if (warnings.length <= 2) return 'good';
    return 'fair';
  }

  // Validate live data updates
  validateLiveUpdate(update: LiveDataUpdate, previousMatch: EnhancedMatch): MatchValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate timestamp
    if (!this.isValidTimestamp(update.timestamp)) {
      errors.push("Invalid update timestamp");
    }

    // Validate score progression
    if (previousMatch.score && update.score) {
      this.validateScoreProgression(previousMatch.score, update.score, errors, warnings);
    }

    // Validate status transitions
    this.validateStatusTransition(previousMatch.status, update.status, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      dataQuality: this.calculateDataQuality(errors, warnings)
    };
  }

  private validateScoreProgression(oldScore: any, newScore: any, errors: string[], warnings: string[]): void {
    // Check that scores only increase
    if (newScore.sets.length < oldScore.sets.length) {
      errors.push("Set count decreased in score update");
      return;
    }

    // Validate each existing set hasn't changed
    for (let i = 0; i < oldScore.sets.length; i++) {
      const oldSet = oldScore.sets[i];
      const newSet = newScore.sets[i];

      if (!newSet) {
        errors.push(`Set ${i + 1} disappeared in update`);
        continue;
      }

      if (newSet.player1 < oldSet.player1 || newSet.player2 < oldSet.player2) {
        errors.push(`Set ${i + 1} score decreased in update`);
      }
    }

    // Validate games progression
    if (oldScore.games && newScore.games) {
      if (newScore.games.player1 < oldScore.games.player1 ||
          newScore.games.player2 < oldScore.games.player2) {
        // Games can reset when a new set starts
        const oldSets = oldScore.sets.length;
        const newSets = newScore.sets.length;

        if (newSets <= oldSets) {
          warnings.push("Games score decreased without new set");
        }
      }
    }
  }

  private validateStatusTransition(oldStatus: string, newStatus: string, errors: string[], warnings: string[]): void {
    const validTransitions = {
      'scheduled': ['live', 'cancelled'],
      'live': ['completed', 'retired', 'cancelled'],
      'completed': [], // No transitions from completed
      'cancelled': [], // No transitions from cancelled
      'retired': [], // No transitions from retired
      'walkover': []
    };

    const allowed = validTransitions[oldStatus as keyof typeof validTransitions] || [];

    if (oldStatus !== newStatus && !allowed.includes(newStatus as any)) {
      errors.push(`Invalid status transition: ${oldStatus} -> ${newStatus}`);
    }
  }

  // Clear validation cache
  clearCache(): void {
    this.validationCache.clear();
  }

  // Get validation statistics
  getValidationStats(): { cacheSize: number; validationCount: number } {
    return {
      cacheSize: this.validationCache.size,
      validationCount: this.validationCache.size // Simplified
    };
  }
}

// Export singleton instance
export const tennisDataValidator = TennisDataValidator.getInstance();