import { describe, it, expect } from 'vitest';
import { calculateHybridScore } from './ranking';

describe('calculateHybridScore', () => {
  const maxDistance = 1000; // 1km radius
  const totalResults = 10;

  describe('70/30 weighting', () => {
    it('should weight proximity at 70% and relevance at 30%', () => {
      // Test case: Position 0 (best relevance) at max distance
      // Relevance score: 1 - 0/10 = 1.0
      // Proximity score: 1 - 1000/1000 = 0.0
      // Expected: 0.3 * 1.0 + 0.7 * 0.0 = 0.3
      const score1 = calculateHybridScore(1000, 0, totalResults, maxDistance);
      expect(score1).toBeCloseTo(0.3, 5);

      // Test case: Position 9 (worst relevance) at 0 distance
      // Relevance score: 1 - 9/10 = 0.1
      // Proximity score: 1 - 0/1000 = 1.0
      // Expected: 0.3 * 0.1 + 0.7 * 1.0 = 0.73
      const score2 = calculateHybridScore(0, 9, totalResults, maxDistance);
      expect(score2).toBeCloseTo(0.73, 5);
    });

    it('should favor proximity over relevance', () => {
      // Very close (100m) but low relevance (position 8)
      const closeButIrrelevant = calculateHybridScore(
        100,
        8,
        totalResults,
        maxDistance
      );

      // Far (900m) but high relevance (position 1)
      const farButRelevant = calculateHybridScore(
        900,
        1,
        totalResults,
        maxDistance
      );

      // Close place should win despite worse relevance
      expect(closeButIrrelevant).toBeGreaterThan(farButRelevant);
    });

    it('should handle perfect score (position 0, distance 0)', () => {
      // Best relevance + closest distance = perfect score of 1.0
      const perfectScore = calculateHybridScore(
        0,
        0,
        totalResults,
        maxDistance
      );
      expect(perfectScore).toBe(1.0);
    });

    it('should handle worst score (last position, max distance)', () => {
      // Worst relevance + farthest distance
      // Relevance score: 1 - 9/10 = 0.1
      // Proximity score: 1 - 1000/1000 = 0.0
      // Expected: 0.3 * 0.1 + 0.7 * 0.0 = 0.03
      const worstScore = calculateHybridScore(
        1000,
        9,
        totalResults,
        maxDistance
      );
      expect(worstScore).toBeCloseTo(0.03, 5);
    });
  });

  describe('edge cases', () => {
    it('should cap proximity score at 0 for distances beyond radius', () => {
      // Distance beyond max should be treated as max distance
      const score = calculateHybridScore(
        2000, // 2x the radius
        0, // Best relevance
        totalResults,
        maxDistance
      );
      // Proximity score capped at 0, so only relevance matters
      expect(score).toBeCloseTo(0.3, 5);
    });

    it('should handle single result', () => {
      // With only 1 result, it has both best and worst relevance
      const score = calculateHybridScore(500, 0, 1, maxDistance);
      // Relevance: 1 - 0/1 = 1.0
      // Proximity: 1 - 500/1000 = 0.5
      // Score: 0.3 * 1.0 + 0.7 * 0.5 = 0.65
      expect(score).toBeCloseTo(0.65, 5);
    });

    it('should handle midpoint distances correctly', () => {
      // Result at exactly half the radius
      const score = calculateHybridScore(
        500, // Half of maxDistance
        5, // Middle position
        totalResults,
        maxDistance
      );
      // Relevance: 1 - 5/10 = 0.5
      // Proximity: 1 - 500/1000 = 0.5
      // Score: 0.3 * 0.5 + 0.7 * 0.5 = 0.5
      expect(score).toBe(0.5);
    });
  });

  describe('ranking scenarios', () => {
    it('should rank very close places higher than far places with better relevance', () => {
      // Scenario: User searches for "pizza" near them
      // Result A: 50m away, position 5 (medium relevance)
      const nearMediumRelevance = calculateHybridScore(
        50,
        5,
        totalResults,
        maxDistance
      );

      // Result B: 800m away, position 0 (best relevance)
      const farBestRelevance = calculateHybridScore(
        800,
        0,
        totalResults,
        maxDistance
      );

      // Very close should win
      expect(nearMediumRelevance).toBeGreaterThan(farBestRelevance);
    });

    it('should still allow highly relevant far places to beat irrelevant close places', () => {
      // Result A: 400m away, position 0 (best relevance)
      const mediumDistanceBestRelevance = calculateHybridScore(
        400,
        0,
        totalResults,
        maxDistance
      );

      // Result B: 100m away, position 9 (worst relevance)
      const veryCloseWorstRelevance = calculateHybridScore(
        100,
        9,
        totalResults,
        maxDistance
      );

      // Despite being farther, better relevance should win in this case
      expect(mediumDistanceBestRelevance).toBeGreaterThan(
        veryCloseWorstRelevance
      );
    });
  });
});
