/**
 * LangChain Wrappers for SwitchAI
 *
 * This module provides custom LangChain wrapper classes that integrate our existing
 * SwitchAI services (hybrid search and local embeddings) with LangChain's interfaces.
 * These wrappers enable us to use our domain-specific search logic within LCEL chains.
 */

import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { BaseRetriever, type BaseRetrieverInput } from '@langchain/core/retrievers';
import { traceable } from 'langsmith/traceable';

import type { DatabaseLookupResult } from '../../types/analysis.js';
import { fuseResults } from '../../utils/hybridSearch.js';
import { DatabaseService } from '../db.js';
import { LocalEmbeddingService } from '../embeddingsLocal.js';

/**
 * Configuration options for the SwitchAI Retriever
 */
export interface SwitchAIRetrieverConfig extends BaseRetrieverInput {
  /** Maximum number of documents to retrieve */
  k?: number;
  /** Confidence threshold for search results */
  confidenceThreshold?: number;
  /** Whether to enable embedding-based search */
  enableEmbeddingSearch?: boolean;
  /** Whether to enable fuzzy matching */
  enableFuzzyMatching?: boolean;
  /** Whether to enable LLM-based normalization */
  enableLLMNormalization?: boolean;
  /** RRF parameter for hybrid search fusion */
  rrfK?: number;
}

/**
 * Extended DatabaseLookupResult with additional properties for our use case
 */
interface ExtendedDatabaseLookupResult extends Omit<DatabaseLookupResult, 'data'> {
  data?: any;
  switchData?: any;
  matchType?: 'hybrid' | 'semantic' | 'keyword' | 'exact' | 'fuzzy';
}

/**
 * Custom LangChain Retriever that integrates SwitchAI's hybrid search capabilities.
 *
 * This retriever combines:
 * - Semantic search using local embeddings
 * - Keyword/FTS search from the database
 * - Reciprocal Rank Fusion (RRF) to merge results
 * - Switch-specific normalization and matching logic
 */
export class SwitchAIRetriever extends BaseRetriever {
  static lc_name() {
    return 'SwitchAIRetriever';
  }

  lc_namespace = ['switchai', 'retrievers'];

  private databaseService: DatabaseService;
  private k: number;
  private confidenceThreshold: number;
  private enableEmbeddingSearch: boolean;
  private enableFuzzyMatching: boolean;
  private enableLLMNormalization: boolean;
  private rrfK: number;
  private manufacturerSet: Set<string> = new Set();

  constructor(config: SwitchAIRetrieverConfig = {}) {
    super(config);

    this.databaseService = new DatabaseService();
    this.k = config.k ?? 10;
    this.confidenceThreshold = config.confidenceThreshold ?? 0.5;
    this.enableEmbeddingSearch = config.enableEmbeddingSearch ?? true;
    this.enableFuzzyMatching = config.enableFuzzyMatching ?? true;
    this.enableLLMNormalization = config.enableLLMNormalization ?? true;
    this.rrfK = config.rrfK ?? 60;

    this.databaseService
      .getManufacturerPrefixes()
      .then((prefixes) => {
        if (prefixes && prefixes.length > 0) {
          this.manufacturerSet = new Set(prefixes.map((p) => p.toLowerCase()));
        }
      })
      .catch((err) => {
        console.warn(
          'SwitchAIRetriever: Failed to load manufacturer prefixes, using fallback list',
          err
        );
        this.manufacturerSet = new Set(['cherry', 'gateron', 'kailh', 'outemu', 'zealios']);
      });
  }

  /**
   * Main retrieval method that implements the hybrid search logic
   */
  public _getRelevantDocuments = traceable(
    async (query: string): Promise<Document[]> => {
      try {
        // Extract switch names from the query (simplified approach)
        const switchNames = this.extractSwitchNames(query);

        if (switchNames.length === 0) {
          console.log('No switch names detected in query, performing keyword search');
          return await this.performKeywordSearch(query);
        }

        // Perform hybrid search combining semantic and keyword approaches
        const results = await this.performHybridSearch(switchNames, query);

        // Convert results to LangChain Documents
        const documents = this.convertToDocuments(results, query);

        return documents.slice(0, this.k);
      } catch (error) {
        console.error('Error in SwitchAI retrieval:', error);
        return [];
      }
    },
    { name: 'SwitchAIRetriever._getRelevantDocuments' }
  );

  /**
   * Performs hybrid search combining database lookup and keyword search
   */
  private performHybridSearch = traceable(
    async (switchNames: string[], query: string): Promise<ExtendedDatabaseLookupResult[]> => {
      try {
        // Get semantic results using our existing database service
        const semanticResults = await this.databaseService.fetchSwitchSpecifications(switchNames, {
          confidenceThreshold: this.confidenceThreshold,
          maxSwitchesPerLookup: this.k,
          enableEmbeddingSearch: this.enableEmbeddingSearch,
          enableFuzzyMatching: this.enableFuzzyMatching,
          enableLLMNormalization: this.enableLLMNormalization
        });

        // Get keyword results using database keyword search
        const keywordResults = await this.databaseService.keywordSearch(query);

        // If we have both semantic and keyword results, apply RRF fusion
        if (semanticResults.switches.length > 0 && keywordResults.length > 0) {
          const semanticSwitches = semanticResults.switches
            .filter((result) => result.found && result.data)
            .map((result) => result.data);

          const fusedResults = fuseResults(semanticSwitches, keywordResults, this.rrfK);

          // Convert fused results back to ExtendedDatabaseLookupResult format
          return fusedResults.map((switch_) => ({
            found: true,
            data: switch_,
            switchData: switch_, // For backward compatibility
            normalizedName: switch_.name,
            confidence: switch_.rrfScore || 0.5,
            matchType: 'hybrid' as const
          }));
        }

        // Return semantic results if no keyword results
        if (semanticResults.switches.length > 0) {
          return semanticResults.switches
            .filter((result) => result.found)
            .map((result) => ({
              ...result,
              switchData: result.data,
              matchType: 'semantic' as const
            }));
        }

        // Return keyword results converted to ExtendedDatabaseLookupResult format
        return keywordResults.map((switch_) => ({
          found: true,
          data: switch_,
          switchData: switch_, // For backward compatibility
          normalizedName: switch_.switchName || switch_.name,
          confidence: 0.7,
          matchType: 'keyword' as const
        }));
      } catch (error) {
        console.error('Error in hybrid search:', error);
        return [];
      }
    },
    { name: 'SwitchAIRetriever.performHybridSearch' }
  );

  /**
   * Performs keyword-only search when no switch names are detected
   *
   * Falls back to database keyword search when the query doesn't contain
   * identifiable switch names, ensuring we can still provide relevant results.
   *
   * @param query - The user's search query
   * @returns Promise resolving to array of Documents from keyword search
   */
  private async performKeywordSearch(query: string): Promise<Document[]> {
    try {
      const keywordResults = await this.databaseService.keywordSearch(query);
      return this.convertToDocuments(
        keywordResults.map((switch_) => ({
          found: true,
          data: switch_,
          switchData: switch_,
          normalizedName: switch_.switchName || switch_.name,
          confidence: 0.6,
          matchType: 'keyword' as const
        })),
        query
      );
    } catch (error) {
      console.error('Error in keyword search:', error);
      return [];
    }
  }

  /**
   * Extract potential switch names from the query using heuristics
   *
   * Analyzes the query text to identify potential switch names by looking for:
   * - Known manufacturer names (Cherry, Gateron, etc.)
   * - Switch model patterns (MX Red, Blue, etc.)
   * - Common switch naming conventions
   *
   * This is a simplified implementation - could be enhanced with NER or better parsing
   *
   * @param query - The user's search query
   * @returns Array of potential switch names found in the query
   */
  private extractSwitchNames(query: string): string[] {
    // Simple approach: look for capitalized words that might be switch names
    // This could be enhanced with a more sophisticated approach
    const words = query.split(/\s+/);
    const potentialSwitches: string[] = [];

    // Look for patterns like "Cherry MX Red", "Gateron Yellow", etc.
    for (let i = 0; i < words.length - 1; i++) {
      const currentWord = words[i];
      const nextWord = words[i + 1];

      // Check for common switch manufacturer patterns
      if (this.isKnownManufacturer(currentWord) && nextWord) {
        const potentialSwitch = `${currentWord} ${nextWord}`;
        potentialSwitches.push(potentialSwitch);

        // Check for three-part names like "Cherry MX Red"
        if (i < words.length - 2 && words[i + 2]) {
          const threePartName = `${currentWord} ${nextWord} ${words[i + 2]}`;
          potentialSwitches.push(threePartName);
        }
      }
    }

    // If no manufacturer patterns found, extract any capitalized sequences
    if (potentialSwitches.length === 0) {
      const capitalizedWords = words.filter(
        (word) =>
          word.length > 2 &&
          /^[A-Z]/.test(word) &&
          !/^(I|A|The|This|That|Which|What|How|Why|When|Where)$/i.test(word)
      );

      if (capitalizedWords.length > 0) {
        potentialSwitches.push(capitalizedWords.join(' '));
      }
    }

    return potentialSwitches.length > 0 ? potentialSwitches : [query];
  }

  /**
   * Check if a word is a known switch manufacturer
   *
   * Determines whether a given word matches any of the known mechanical keyboard
   * switch manufacturers in our database.
   *
   * @param word - The word to check against known manufacturers
   * @returns True if the word is a recognized manufacturer name
   */
  private isKnownManufacturer(word: string): boolean {
    // Ensure lowercase normalization for matching
    return this.manufacturerSet.has(word.toLowerCase());
  }

  /**
   * Convert database lookup results to LangChain Documents
   *
   * Transforms our internal search results into LangChain Document format,
   * including metadata and formatted content for use in RAG pipelines.
   *
   * @param results - Array of database lookup results to convert
   * @param originalQuery - The original user query for context
   * @returns Array of LangChain Document objects with formatted content and metadata
   */
  private convertToDocuments(
    results: ExtendedDatabaseLookupResult[],
    originalQuery: string
  ): Document[] {
    return results
      .filter((result) => result.found && (result.switchData || result.data))
      .map((result) => {
        const switch_ = result.switchData || result.data!;

        const pageContent = this.formatSwitchContent(switch_);

        const metadata = {
          switchName: switch_.switchName || switch_.name,
          manufacturer: switch_.manufacturer,
          type: switch_.type,
          confidence: result.confidence,
          matchType: result.matchType || 'unknown',
          originalQuery,
          specifications: {
            topHousing: switch_.topHousing,
            bottomHousing: switch_.bottomHousing,
            stem: switch_.stem,
            mount: switch_.mount,
            spring: switch_.spring,
            actuationForce: switch_.actuationForceG || switch_.actuationForce,
            bottomForce: switch_.bottomOutForceG || switch_.bottomForce,
            preTravel: switch_.preTravelMm || switch_.preTravel,
            totalTravel: switch_.totalTravelMm || switch_.totalTravel
          }
        };

        return new Document({
          pageContent,
          metadata
        });
      });
  }

  /**
   * Format switch data into readable content for the document
   *
   * Creates a structured text representation of switch data that includes
   * all relevant specifications and characteristics for use in LLM prompts.
   *
   * @param switch_ - The switch data object to format
   * @returns Formatted string representation of the switch specifications
   */
  private formatSwitchContent(switch_: any): string {
    const switchName = switch_.switchName || switch_.name;
    const sections = [`Switch: ${switchName}`, `Manufacturer: ${switch_.manufacturer}`];

    if (switch_.type) {
      sections.push(`Type: ${switch_.type}`);
    }

    const specs = [];
    const actuationForce = switch_.actuationForceG || switch_.actuationForce;
    const bottomForce = switch_.bottomOutForceG || switch_.bottomForce;
    const preTravel = switch_.preTravelMm || switch_.preTravel;
    const totalTravel = switch_.totalTravelMm || switch_.totalTravel;

    if (actuationForce) specs.push(`Actuation Force: ${actuationForce}g`);
    if (bottomForce) specs.push(`Bottom Force: ${bottomForce}g`);
    if (preTravel) specs.push(`Pre-travel: ${preTravel}mm`);
    if (totalTravel) specs.push(`Total Travel: ${totalTravel}mm`);

    if (specs.length > 0) {
      sections.push(`Specifications: ${specs.join(', ')}`);
    }

    const materials = [];
    if (switch_.topHousing) materials.push(`Top Housing: ${switch_.topHousing}`);
    if (switch_.bottomHousing) materials.push(`Bottom Housing: ${switch_.bottomHousing}`);
    if (switch_.stem) materials.push(`Stem: ${switch_.stem}`);
    if (switch_.spring) materials.push(`Spring: ${switch_.spring}`);
    if (switch_.mount) materials.push(`Mount: ${switch_.mount}`);

    if (materials.length > 0) {
      sections.push(`Materials: ${materials.join(', ')}`);
    }

    return sections.join('\n');
  }
}

/**
 * Custom LangChain Embeddings wrapper for SwitchAI's local embedding service.
 *
 * This wrapper allows our local embedding model to be used within LangChain chains
 * while maintaining compatibility with the existing LocalEmbeddingService.
 */
export class SwitchAIEmbeddings extends Embeddings {
  static lc_name() {
    return 'SwitchAIEmbeddings';
  }

  lc_namespace = ['switchai', 'embeddings'];

  private embeddingService: LocalEmbeddingService;

  constructor() {
    super({});
    this.embeddingService = new LocalEmbeddingService();
  }

  /**
   * Embed multiple documents
   *
   * Generates embeddings for an array of text documents using our local
   * embedding service. This method is used for processing retrieved documents
   * in the RAG pipeline.
   *
   * @param documents - Array of text documents to embed
   * @returns Promise resolving to array of embedding vectors
   */
  public embedDocuments = traceable(
    async (texts: string[]): Promise<number[][]> => {
      try {
        const embeddings = await Promise.all(
          texts.map((text) => this.embeddingService.embedText(text))
        );
        return embeddings;
      } catch (error) {
        console.error('Error embedding documents:', error);
        throw new Error(
          `Failed to embed documents: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    { name: 'SwitchAIEmbeddings.embedDocuments' }
  );

  /**
   * Embed a single query
   *
   * Generates an embedding vector for a single query text using our local
   * embedding service. This method is used for semantic similarity search
   * in the retrieval process.
   *
   * @param document - The query text to embed
   * @returns Promise resolving to embedding vector
   */
  public embedQuery = traceable(
    async (text: string): Promise<number[]> => {
      try {
        return await this.embeddingService.embedText(text);
      } catch (error) {
        console.error('Error embedding query:', error);
        throw new Error(
          `Failed to embed query: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    { name: 'SwitchAIEmbeddings.embedQuery' }
  );
}

/**
 * Factory function to create a configured SwitchAI retriever
 *
 * Convenience function for creating a properly configured SwitchAIRetriever
 * with the specified configuration options.
 *
 * @param config - Configuration options for the retriever
 * @returns A new SwitchAIRetriever instance
 */
export function createSwitchAIRetriever(config: SwitchAIRetrieverConfig = {}): SwitchAIRetriever {
  return new SwitchAIRetriever(config);
}

/**
 * Factory function to create SwitchAI embeddings instance
 *
 * Convenience function for creating a new SwitchAIEmbeddings instance
 * with default configuration.
 *
 * @returns A new SwitchAIEmbeddings instance
 */
export function createSwitchAIEmbeddings(): SwitchAIEmbeddings {
  return new SwitchAIEmbeddings();
}
