import { eq, sql } from 'drizzle-orm';

import { db } from '../../../db/index.js';
import { switches as switchesTable } from '../../../db/schema.js';
import { LocalEmbeddingService } from '../../embeddingsLocal.js';
import { ComparisonDataRetrievalResult, ComprehensiveSwitchData } from '../comparison/types.js';

export class DataRetrievalService {
  private embeddingService: LocalEmbeddingService;

  constructor() {
    this.embeddingService = new LocalEmbeddingService();
  }

  /**
   * Retrieve comprehensive switch data from database for comparison
   * Fetches complete records for each identified switch and handles missing data
   *
   * @param switchNames - Array of switch names to retrieve
   * @returns Complete retrieval result with found/missing switches and metadata
   */
  async retrieveComprehensiveSwitchData(
    switchNames: string[]
  ): Promise<ComparisonDataRetrievalResult> {
    console.log(
      `🔍 DataRetrievalService.retrieveComprehensiveSwitchData called with ${switchNames.length} switches`
    );
    console.log(`📋 Switch names to retrieve: ${switchNames.join(', ')}`);

    if (switchNames.length === 0) {
      console.log(`⚠️ No switch names provided - returning empty result`);
      return {
        switchesData: [],
        allSwitchesFound: false,
        missingSwitches: [],
        hasDataGaps: false,
        retrievalNotes: ['No switch names provided for retrieval']
      };
    }

    const switchesData: ComprehensiveSwitchData[] = [];
    const missingSwitches: string[] = [];
    const retrievalNotes: string[] = [];
    let hasDataGaps = false;

    for (const switchName of switchNames) {
      console.log(`🔍 Retrieving data for switch: "${switchName}"`);

      try {
        let results = await db
          .select({
            name: switchesTable.name,
            manufacturer: switchesTable.manufacturer,
            type: switchesTable.type,
            topHousing: switchesTable.topHousing,
            bottomHousing: switchesTable.bottomHousing,
            stem: switchesTable.stem,
            mount: switchesTable.mount,
            spring: switchesTable.spring,
            actuationForce: switchesTable.actuationForce,
            bottomForce: switchesTable.bottomForce,
            preTravel: switchesTable.preTravel,
            totalTravel: switchesTable.totalTravel
          })
          .from(switchesTable)
          .where(eq(switchesTable.name, switchName))
          .limit(1);

        if (results.length === 0) {
          console.log(`🔍 No exact match for "${switchName}" - trying case-insensitive search`);
          results = await db
            .select({
              name: switchesTable.name,
              manufacturer: switchesTable.manufacturer,
              type: switchesTable.type,
              topHousing: switchesTable.topHousing,
              bottomHousing: switchesTable.bottomHousing,
              stem: switchesTable.stem,
              mount: switchesTable.mount,
              spring: switchesTable.spring,
              actuationForce: switchesTable.actuationForce,
              bottomForce: switchesTable.bottomForce,
              preTravel: switchesTable.preTravel,
              totalTravel: switchesTable.totalTravel
            })
            .from(switchesTable)
            .where(sql`LOWER(${switchesTable.name}) = ${switchName.toLowerCase()}`)
            .limit(1);
        }

        if (results.length === 0) {
          console.log(`🔍 No case-insensitive match for "${switchName}" - trying partial search`);
          results = await db
            .select({
              name: switchesTable.name,
              manufacturer: switchesTable.manufacturer,
              type: switchesTable.type,
              topHousing: switchesTable.topHousing,
              bottomHousing: switchesTable.bottomHousing,
              stem: switchesTable.stem,
              mount: switchesTable.mount,
              spring: switchesTable.spring,
              actuationForce: switchesTable.actuationForce,
              bottomForce: switchesTable.bottomForce,
              preTravel: switchesTable.preTravel,
              totalTravel: switchesTable.totalTravel
            })
            .from(switchesTable)
            .where(sql`LOWER(${switchesTable.name}) LIKE ${`%${switchName.toLowerCase()}%`}`)
            .limit(3);

          if (results.length > 1) {
            results = [
              results.reduce((best, current) =>
                current.name.length < best.name.length ? current : best
              )
            ];
          }
        }

        if (results.length > 0) {
          const switchData = results[0];
          console.log(`✅ Found switch data for "${switchName}" -> "${switchData.name}"`);

          const missingFields: string[] = [];
          const fieldsToCheck = [
            { key: 'type', value: switchData.type },
            { key: 'topHousing', value: switchData.topHousing },
            { key: 'bottomHousing', value: switchData.bottomHousing },
            { key: 'stem', value: switchData.stem },
            { key: 'mount', value: switchData.mount },
            { key: 'spring', value: switchData.spring },
            { key: 'actuationForce', value: switchData.actuationForce },
            { key: 'bottomForce', value: switchData.bottomForce },
            { key: 'preTravel', value: switchData.preTravel },
            { key: 'totalTravel', value: switchData.totalTravel }
          ];

          for (const field of fieldsToCheck) {
            if (field.value === null || field.value === undefined || field.value === '') {
              missingFields.push(field.key);
            }
          }

          if (missingFields.length > 0) {
            hasDataGaps = true;
            console.log(`⚠️ Missing fields for "${switchData.name}": ${missingFields.join(', ')}`);
          }

          const matchConfidence = this.calculateNameMatchConfidence(switchName, switchData.name);

          switchesData.push({
            name: switchData.name,
            manufacturer: switchData.manufacturer,
            type: switchData.type,
            topHousing: switchData.topHousing,
            bottomHousing: switchData.bottomHousing,
            stem: switchData.stem,
            mount: switchData.mount,
            spring: switchData.spring,
            actuationForce: switchData.actuationForce,
            bottomForce: switchData.bottomForce,
            preTravel: switchData.preTravel,
            totalTravel: switchData.totalTravel,
            isFound: true,
            missingFields,
            matchConfidence,
            originalQuery: switchName
          });

          if (matchConfidence < 1.0) {
            retrievalNotes.push(
              `Fuzzy matched "${switchName}" to "${switchData.name}" (${(matchConfidence * 100).toFixed(1)}% confidence)`
            );
          }
        } else {
          console.log(`❌ No match found for "${switchName}"`);
          missingSwitches.push(switchName);

          switchesData.push({
            name: switchName,
            manufacturer: 'Unknown',
            type: null,
            topHousing: null,
            bottomHousing: null,
            stem: null,
            mount: null,
            spring: null,
            actuationForce: null,
            bottomForce: null,
            preTravel: null,
            totalTravel: null,
            isFound: false,
            missingFields: ['all'],
            originalQuery: switchName
          });
        }
      } catch (error) {
        console.error(`❌ Error retrieving data for switch "${switchName}":`, error);
        missingSwitches.push(switchName);
        retrievalNotes.push(
          `Database error retrieving "${switchName}": ${error instanceof Error ? error.message : 'Unknown error'}`
        );

        switchesData.push({
          name: switchName,
          manufacturer: 'Unknown',
          type: null,
          topHousing: null,
          bottomHousing: null,
          stem: null,
          mount: null,
          spring: null,
          actuationForce: null,
          bottomForce: null,
          preTravel: null,
          totalTravel: null,
          isFound: false,
          missingFields: ['all'],
          originalQuery: switchName
        });
      }
    }

    const allSwitchesFound = missingSwitches.length === 0;

    const result = {
      switchesData,
      allSwitchesFound,
      missingSwitches,
      hasDataGaps,
      retrievalNotes
    };

    console.log(`✅ DataRetrievalService.retrieveComprehensiveSwitchData completed:`, {
      totalRequested: switchNames.length,
      found: switchesData.filter((s) => s.isFound).length,
      missing: missingSwitches.length,
      hasDataGaps,
      notesCount: retrievalNotes.length
    });

    return result;
  }

  /**
   * Calculate match confidence based on string similarity between requested and found names
   */
  private calculateNameMatchConfidence(requested: string, found: string): number {
    if (requested.toLowerCase() === found.toLowerCase()) {
      return 1.0;
    }

    const requestedWords = requested.toLowerCase().split(/\s+/);
    const foundWords = found.toLowerCase().split(/\s+/);

    const commonWords = requestedWords.filter((word) =>
      foundWords.some((foundWord) => foundWord.includes(word) || word.includes(foundWord))
    );

    const wordSimilarity = commonWords.length / Math.max(requestedWords.length, foundWords.length);

    const maxLength = Math.max(requested.length, found.length);
    const commonChars = requested
      .toLowerCase()
      .split('')
      .filter((char, index) => found.toLowerCase().charAt(index) === char).length;

    const charSimilarity = commonChars / maxLength;

    return wordSimilarity * 0.7 + charSimilarity * 0.3;
  }

  /**
   * Formats missing data information for prompt building stage
   * Provides structured information about missing switches and null fields
   */
  formatMissingDataForPrompt(retrievalResult: ComparisonDataRetrievalResult): {
    missingDataSummary: string;
    switchDataBlocks: string[];
    hasIncompleteData: boolean;
    promptInstructions: string;
  } {
    console.log(
      `🔧 formatMissingDataForPrompt called with ${retrievalResult.switchesData.length} switches`
    );
    const { switchesData, missingSwitches, hasDataGaps, allSwitchesFound } = retrievalResult;

    const switchDataBlocks: string[] = [];
    console.log(`📝 Building switch data blocks...`);

    for (const switchData of switchesData) {
      console.log(
        `📄 Processing switch data block for: ${switchData.name} (found: ${switchData.isFound})`
      );

      if (switchData.isFound) {
        let dataBlock = `SWITCH_NAME: ${switchData.name}\n`;
        dataBlock += `MANUFACTURER: ${switchData.manufacturer || 'N/A'}\n`;
        dataBlock += `TYPE: ${switchData.type || 'N/A'}\n`;
        dataBlock += `TOP_HOUSING: ${switchData.topHousing || 'N/A'}\n`;
        dataBlock += `BOTTOM_HOUSING: ${switchData.bottomHousing || 'N/A'}\n`;
        dataBlock += `STEM: ${switchData.stem || 'N/A'}\n`;
        dataBlock += `MOUNT: ${switchData.mount || 'N/A'}\n`;
        dataBlock += `SPRING: ${switchData.spring || 'N/A'}\n`;
        dataBlock += `ACTUATION_FORCE_G: ${switchData.actuationForce !== null ? switchData.actuationForce : 'N/A'}\n`;
        dataBlock += `BOTTOM_OUT_FORCE_G: ${switchData.bottomForce !== null ? switchData.bottomForce : 'N/A'}\n`;
        dataBlock += `PRE_TRAVEL_MM: ${switchData.preTravel !== null ? switchData.preTravel : 'N/A'}\n`;
        dataBlock += `TOTAL_TRAVEL_MM: ${switchData.totalTravel !== null ? switchData.totalTravel : 'N/A'}\n`;

        if (switchData.matchConfidence && switchData.matchConfidence < 1.0) {
          dataBlock += `MATCH_CONFIDENCE: ${(switchData.matchConfidence * 100).toFixed(1)}% (matched "${switchData.originalQuery}" to "${switchData.name}")\n`;
        }

        if (switchData.missingFields.length > 0) {
          dataBlock += `MISSING_FIELDS_NOTE: Data not available for: ${switchData.missingFields.join(', ')}\n`;
        }

        switchDataBlocks.push(dataBlock);
        console.log(
          `✅ Data block created for ${switchData.name} (${dataBlock.length} characters)`
        );
      } else {
        const notFoundBlock =
          `SWITCH_NAME: ${switchData.originalQuery}\n` +
          `DATABASE_STATUS: Not found in database\n` +
          `NOTE: This switch was not found in our database. General knowledge may be used if available.\n`;

        switchDataBlocks.push(notFoundBlock);
        console.log(`⚠️ Not-found block created for ${switchData.originalQuery}`);
      }
    }

    console.log(`📊 Generated ${switchDataBlocks.length} switch data blocks`);

    console.log(`📝 Generating missing data summary...`);
    let missingDataSummary = '';
    if (missingSwitches.length > 0) {
      missingDataSummary += `Missing switches (not in database): ${missingSwitches.join(', ')}. `;
      console.log(`⚠️ Missing switches: ${missingSwitches.join(', ')}`);
    }

    const switchesWithMissingFields = switchesData.filter(
      (s) => s.isFound && s.missingFields.length > 0
    );
    if (switchesWithMissingFields.length > 0) {
      missingDataSummary += `Switches with incomplete data: ${switchesWithMissingFields
        .map((s) => `${s.name} (missing: ${s.missingFields.join(', ')})`)
        .join('; ')}. `;
      console.log(`📋 Switches with missing fields: ${switchesWithMissingFields.length}`);
    }

    console.log(`📝 Generating prompt instructions...`);
    let promptInstructions = '';
    if (!allSwitchesFound || hasDataGaps) {
      promptInstructions = 'MISSING_SWITCH_DATA_NOTE: ';

      if (missingSwitches.length > 0) {
        promptInstructions += `${missingSwitches.join(', ')} not found in database - use general knowledge if available and clearly indicate sources. `;
      }

      if (hasDataGaps) {
        promptInstructions +=
          'Some switches have incomplete database records - mark missing specifications as "N/A" in technical specifications and note in analysis where general knowledge is used.';
      }
    }

    const result = {
      missingDataSummary: missingDataSummary.trim(),
      switchDataBlocks,
      hasIncompleteData: !allSwitchesFound || hasDataGaps,
      promptInstructions: promptInstructions.trim()
    };

    console.log(`✅ formatMissingDataForPrompt completed successfully:`, {
      missingDataSummaryLength: result.missingDataSummary.length,
      switchDataBlocksCount: result.switchDataBlocks.length,
      hasIncompleteData: result.hasIncompleteData,
      promptInstructionsLength: result.promptInstructions.length
    });

    return result;
  }
}
