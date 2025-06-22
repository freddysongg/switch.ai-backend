/**
 * Hybrid Search Utilities - Reciprocal Rank Fusion (RRF)
 *
 * This module implements Reciprocal Rank Fusion to combine semantic and keyword search results
 * into a single ranked list with improved relevance.
 */

interface RankedSwitch {
  id: string;
  name: string;
  manufacturer: string;
  type: string | null;
  topHousing: string | null;
  bottomHousing: string | null;
  stem: string | null;
  mount: string | null;
  spring: string | null;
  actuationForce: number | null;
  bottomForce: number | null;
  preTravel: number | null;
  totalTravel: number | null;
  embedding?: any;
  semanticRank?: number;
  keywordRank?: number;
  rrfScore?: number;
}

/**
 * Implements Reciprocal Rank Fusion (RRF) to merge semantic and keyword search results
 *
 * @param semanticResults Results from semantic/vector search, ordered by relevance
 * @param keywordResults Results from keyword/FTS search, ordered by relevance
 * @param k RRF parameter that controls the influence of higher-ranked documents (default: 60)
 * @returns Merged and re-ranked list of switches using RRF scores
 */
export function fuseResults(
  semanticResults: any[],
  keywordResults: any[],
  k: number = 60
): RankedSwitch[] {
  const semanticMap = new Map<string, { switch: any; rank: number }>();
  const keywordMap = new Map<string, { switch: any; rank: number }>();

  semanticResults.forEach((switchItem, index) => {
    const id = switchItem.id || switchItem.name;
    semanticMap.set(id, { switch: switchItem, rank: index + 1 });
  });

  keywordResults.forEach((switchItem, index) => {
    const id = switchItem.id || switchItem.name;
    keywordMap.set(id, { switch: switchItem, rank: index + 1 });
  });

  const allSwitchIds = new Set([...semanticMap.keys(), ...keywordMap.keys()]);

  const fusedResults: RankedSwitch[] = [];

  for (const switchId of allSwitchIds) {
    const semanticEntry = semanticMap.get(switchId);
    const keywordEntry = keywordMap.get(switchId);

    let rrfScore = 0;
    let semanticRank: number | undefined;
    let keywordRank: number | undefined;

    if (semanticEntry) {
      semanticRank = semanticEntry.rank;
      rrfScore += 1 / (semanticEntry.rank + k);
    }

    if (keywordEntry) {
      keywordRank = keywordEntry.rank;
      rrfScore += 1 / (keywordEntry.rank + k);
    }

    const switchData = semanticEntry?.switch || keywordEntry?.switch;

    if (switchData) {
      fusedResults.push({
        ...switchData,
        semanticRank,
        keywordRank,
        rrfScore
      });
    }
  }

  fusedResults.sort((a, b) => (b.rrfScore || 0) - (a.rrfScore || 0));

  console.log(
    `RRF fusion completed: ${semanticResults.length} semantic + ${keywordResults.length} keyword → ${fusedResults.length} fused results`
  );

  return fusedResults;
}

/**
 * Helper function to log RRF fusion details for debugging (for development purposes)
 */
export function logFusionDetails(fusedResults: RankedSwitch[], topN: number = 5): void {
  console.log('\n=== RRF Fusion Details ===');

  const topResults = fusedResults.slice(0, topN);

  topResults.forEach((result, index) => {
    const semanticInfo = result.semanticRank
      ? `semantic: #${result.semanticRank}`
      : 'semantic: N/A';
    const keywordInfo = result.keywordRank ? `keyword: #${result.keywordRank}` : 'keyword: N/A';
    const score = result.rrfScore?.toFixed(6) || 'N/A';

    console.log(`${index + 1}. ${result.name} (RRF: ${score}) - ${semanticInfo}, ${keywordInfo}`);
  });

  console.log('========================\n');
}
