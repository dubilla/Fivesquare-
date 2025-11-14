/**
 * Calculate a hybrid ranking score combining proximity and relevance
 * @param distance Distance in meters from search origin
 * @param googlePosition Position in Google's results (0-indexed, 0 is best)
 * @param totalResults Total number of results from Google
 * @param maxDistance Maximum search radius in meters
 * @returns Hybrid score between 0 and 1 (higher is better)
 */
export function calculateHybridScore(
  distance: number,
  googlePosition: number,
  totalResults: number,
  maxDistance: number
): number {
  // Relevance score: higher position = lower score (0 is best)
  const relevanceScore = 1 - googlePosition / totalResults;

  // Proximity score: closer = higher score (inverse of normalized distance)
  const proximityScore = 1 - Math.min(distance / maxDistance, 1);

  // 70% proximity, 30% Google relevance
  return 0.3 * relevanceScore + 0.7 * proximityScore;
}
