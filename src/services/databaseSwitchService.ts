import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { switches as switchesTable } from '../db/schema.js';
import { ExampleSwitch } from '../config/responseStructures.js';

/**
 * Centralized database service for all switch-related queries
 * Eliminates hardcoded lists and patterns by using the comprehensive switch database
 */
export class DatabaseSwitchService {
  private static instance: DatabaseSwitchService;
  private manufacturersCache: string[] | null = null;
  private switchNamesCache: string[] | null = null;
  private switchTypesCache: string[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  public static getInstance(): DatabaseSwitchService {
    if (!DatabaseSwitchService.instance) {
      DatabaseSwitchService.instance = new DatabaseSwitchService();
    }
    return DatabaseSwitchService.instance;
  }

  /**
   * Get all manufacturers from database (cached)
   */
  async getAllManufacturers(): Promise<string[]> {
    if (this.isCacheValid() && this.manufacturersCache) {
      return this.manufacturersCache;
    }

    try {
      const results = await db
        .select({ manufacturer: switchesTable.manufacturer })
        .from(switchesTable)
        .where(sql`${switchesTable.manufacturer} IS NOT NULL`)
        .groupBy(switchesTable.manufacturer)
        .orderBy(switchesTable.manufacturer);

      this.manufacturersCache = results.map(r => r.manufacturer).filter((m): m is string => m !== null);
      this.updateCacheTimestamp();
      console.log(`📊 Loaded ${this.manufacturersCache.length} manufacturers from database`);
      return this.manufacturersCache;
    } catch (error) {
      console.error('Error fetching manufacturers from database:', error);
      return this.getFallbackManufacturers();
    }
  }

  /**
   * Get all switch names from database (cached)
   */
  async getAllSwitchNames(): Promise<string[]> {
    if (this.isCacheValid() && this.switchNamesCache) {
      return this.switchNamesCache;
    }

    try {
      const results = await db
        .select({ name: switchesTable.name })
        .from(switchesTable)
        .where(sql`${switchesTable.name} IS NOT NULL`)
        .orderBy(switchesTable.name);

      this.switchNamesCache = results.map(r => r.name).filter((n): n is string => n !== null);
      this.updateCacheTimestamp();
      console.log(`📊 Loaded ${this.switchNamesCache.length} switch names from database`);
      return this.switchNamesCache;
    } catch (error) {
      console.error('Error fetching switch names from database:', error);
      return [];
    }
  }

  /**
   * Get all switch types from database (cached)
   */
  async getAllSwitchTypes(): Promise<string[]> {
    if (this.isCacheValid() && this.switchTypesCache) {
      return this.switchTypesCache;
    }

    try {
      const results = await db
        .select({ type: switchesTable.type })
        .from(switchesTable)
        .where(sql`${switchesTable.type} IS NOT NULL`)
        .groupBy(switchesTable.type)
        .orderBy(switchesTable.type);

      this.switchTypesCache = results.map(r => r.type).filter((t): t is string => t !== null);
      this.updateCacheTimestamp();
      console.log(`📊 Loaded ${this.switchTypesCache.length} switch types from database`);
      return this.switchTypesCache;
    } catch (error) {
      console.error('Error fetching switch types from database:', error);
      return ['linear', 'tactile', 'clicky']; // minimal fallback
    }
  }

  /**
   * Find manufacturer by switch name using database lookup
   */
  async findManufacturerBySwitch(switchName: string): Promise<string> {
    try {
      const result = await db
        .select({ manufacturer: switchesTable.manufacturer })
        .from(switchesTable)
        .where(sql`LOWER(${switchesTable.name}) LIKE ${`%${switchName.toLowerCase()}%`}`)
        .limit(1);

      if (result.length > 0) {
        return result[0].manufacturer;
      }

      // Fallback: fuzzy search
      const words = switchName.toLowerCase().split(/\s+/);
      if (words.length > 1) {
        for (const word of words) {
          if (word.length > 2) {
            const fuzzyResult = await db
              .select({ manufacturer: switchesTable.manufacturer })
              .from(switchesTable)
              .where(sql`LOWER(${switchesTable.manufacturer}) LIKE ${`%${word}%`}`)
              .limit(1);

            if (fuzzyResult.length > 0) {
              return fuzzyResult[0].manufacturer;
            }
          }
        }
      }

      return 'Unknown';
    } catch (error) {
      console.error('Error finding manufacturer by switch:', error);
      return 'Unknown';
    }
  }

  /**
   * Database-driven switch name validation using fuzzy matching
   */
  async validateSwitchName(candidateName: string): Promise<{ isValid: boolean; bestMatch?: string; confidence: number }> {
    try {
      const cleanName = candidateName.trim();
      if (cleanName.length < 2) {
        return { isValid: false, confidence: 0 };
      }

      // Strategy 1: Exact match
      let results = await db
        .select({ name: switchesTable.name })
        .from(switchesTable)
        .where(sql`LOWER(${switchesTable.name}) = ${cleanName.toLowerCase()}`)
        .limit(1);

      if (results.length > 0) {
        return { isValid: true, bestMatch: results[0].name, confidence: 1.0 };
      }

      // Strategy 2: Contains match
      results = await db
        .select({ name: switchesTable.name })
        .from(switchesTable)
        .where(sql`LOWER(${switchesTable.name}) LIKE ${`%${cleanName.toLowerCase()}%`}`)
        .limit(5);

      if (results.length > 0) {
        // Find best match based on length similarity
        const bestMatch = results.reduce((best, current) => {
          const bestScore = this.calculateNameSimilarity(cleanName, best.name);
          const currentScore = this.calculateNameSimilarity(cleanName, current.name);
          return currentScore > bestScore ? current : best;
        });

        const confidence = this.calculateNameSimilarity(cleanName, bestMatch.name);
        return { 
          isValid: confidence > 0.5, 
          bestMatch: bestMatch.name, 
          confidence 
        };
      }

      // Strategy 3: Word-based matching
      const words = cleanName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      if (words.length > 0) {
        const wordConditions = words.map(word => 
          sql`LOWER(${switchesTable.name}) LIKE ${`%${word}%`}`
        );

        const wordQuery = wordConditions.reduce((acc, condition, index) =>
          index === 0 ? condition : sql`${acc} AND ${condition}`
        );

        results = await db
          .select({ name: switchesTable.name })
          .from(switchesTable)
          .where(wordQuery)
          .limit(3);

        if (results.length > 0) {
          return { 
            isValid: true, 
            bestMatch: results[0].name, 
            confidence: 0.7 
          };
        }
      }

      return { isValid: false, confidence: 0 };
    } catch (error) {
      console.error('Error validating switch name:', error);
      return { isValid: false, confidence: 0 };
    }
  }

  /**
   * Extract switch names from text using database-driven approach
   */
  async extractSwitchNamesFromText(text: string): Promise<string[]> {
    const foundSwitches: string[] = [];
    const allSwitchNames = await this.getAllSwitchNames();
    const allManufacturers = await this.getAllManufacturers();

    // Strategy 1: Direct name matching
    for (const switchName of allSwitchNames) {
      const lowerText = text.toLowerCase();
      const lowerSwitch = switchName.toLowerCase();
      
      if (lowerText.includes(lowerSwitch)) {
        foundSwitches.push(switchName);
        continue;
      }

      // Check for partial matches (at least 70% of switch name)
      const words = lowerSwitch.split(/\s+/);
      if (words.length > 1) {
        const matchedWords = words.filter(word => 
          word.length > 2 && lowerText.includes(word)
        );
        
        if (matchedWords.length / words.length >= 0.7) {
          foundSwitches.push(switchName);
        }
      }
    }

    // Strategy 2: Manufacturer + pattern matching
    for (const manufacturer of allManufacturers) {
      if (text.toLowerCase().includes(manufacturer.toLowerCase())) {
        const manufacturerSwitches = await this.getSwitchesByManufacturer(manufacturer);
        
        for (const switchName of manufacturerSwitches) {
          const switchWords = switchName.toLowerCase().split(/\s+/);
          const relevantWords = switchWords.filter(word => 
            !manufacturer.toLowerCase().includes(word) && word.length > 2
          );

          if (relevantWords.some(word => text.toLowerCase().includes(word))) {
            foundSwitches.push(switchName);
          }
        }
      }
    }

    return [...new Set(foundSwitches)];
  }

  /**
   * Get switches by manufacturer
   */
  async getSwitchesByManufacturer(manufacturer: string): Promise<string[]> {
    try {
      const results = await db
        .select({ name: switchesTable.name })
        .from(switchesTable)
        .where(sql`LOWER(${switchesTable.manufacturer}) = ${manufacturer.toLowerCase()}`)
        .orderBy(switchesTable.name);

      return results.map(r => r.name);
    } catch (error) {
      console.error('Error getting switches by manufacturer:', error);
      return [];
    }
  }

  /**
   * Find similar switches using database patterns
   */
  async findSimilarSwitches(switchName: string, limit: number = 5): Promise<ExampleSwitch[]> {
    try {
      const targetSwitch = await db
        .select({
          name: switchesTable.name,
          manufacturer: switchesTable.manufacturer,
          type: switchesTable.type,
          actuationForce: switchesTable.actuationForce,
          topHousing: switchesTable.topHousing,
          bottomHousing: switchesTable.bottomHousing,
          stem: switchesTable.stem
        })
        .from(switchesTable)
        .where(sql`LOWER(${switchesTable.name}) = ${switchName.toLowerCase()}`)
        .limit(1);

      if (targetSwitch.length === 0) {
        return [];
      }

      const target = targetSwitch[0];
      const similarityConditions: any[] = [];

      // Same type
      if (target.type) {
        similarityConditions.push(sql`LOWER(${switchesTable.type}) = ${target.type.toLowerCase()}`);
      }

      // Same manufacturer
      if (target.manufacturer) {
        similarityConditions.push(sql`LOWER(${switchesTable.manufacturer}) = ${target.manufacturer.toLowerCase()}`);
      }

      // Similar actuation force (±10g)
      if (target.actuationForce) {
        similarityConditions.push(sql`ABS(${switchesTable.actuationForce} - ${target.actuationForce}) <= 10`);
      }

      // Same housing materials
      if (target.topHousing) {
        similarityConditions.push(sql`LOWER(${switchesTable.topHousing}) = ${target.topHousing.toLowerCase()}`);
      }
      if (target.bottomHousing) {
        similarityConditions.push(sql`LOWER(${switchesTable.bottomHousing}) = ${target.bottomHousing.toLowerCase()}`);
      }

      const similarSwitches = await db
        .select({
          name: switchesTable.name,
          manufacturer: switchesTable.manufacturer,
          type: switchesTable.type,
          actuationForce: switchesTable.actuationForce,
          topHousing: switchesTable.topHousing,
          bottomHousing: switchesTable.bottomHousing,
          stem: switchesTable.stem
        })
        .from(switchesTable)
        .where(sql`${switchesTable.name} != ${switchName} AND (${similarityConditions.reduce((acc, cond, index) => 
          index === 0 ? cond : sql`${acc} OR ${cond}`
        )})`)
        .orderBy(sql`RANDOM()`)
        .limit(limit);

      return similarSwitches.map(sw => ({
        name: sw.name,
        manufacturer: sw.manufacturer,
        description: this.generateSwitchDescription(sw)
      }));
    } catch (error) {
      console.error('Error finding similar switches:', error);
      return [];
    }
  }

  /**
   * Check if a string is likely a switch name using database knowledge
   */
  async isLikelySwitchName(candidateName: string): Promise<boolean> {
    const validation = await this.validateSwitchName(candidateName);
    return validation.isValid && validation.confidence > 0.6;
  }

  /**
   * Find switches by characteristics using database queries
   */
  async findSwitchesByCharacteristics(characteristics: string[]): Promise<ExampleSwitch[]> {
    const allResults: any[] = [];

    for (const characteristic of characteristics) {
      try {
        const results = await this.buildCharacteristicQuery(characteristic);
        allResults.push(...results);
      } catch (error) {
        console.error(`Error querying characteristic "${characteristic}":`, error);
      }
    }

    // Remove duplicates and convert to ExampleSwitch format
    const uniqueSwitches = allResults.filter((sw, index, arr) => 
      arr.findIndex(s => s.name === sw.name) === index
    );

    return uniqueSwitches.slice(0, 10).map(sw => ({
      name: sw.name,
      manufacturer: sw.manufacturer,
      description: this.generateSwitchDescription(sw)
    }));
  }

  /**
   * Build database query for specific characteristic
   */
  private async buildCharacteristicQuery(characteristic: string): Promise<any[]> {
    const char = characteristic.toLowerCase();
    let whereCondition: any;

    if (char.includes('linear') || char.includes('smooth')) {
      whereCondition = sql`LOWER(${switchesTable.type}) LIKE '%linear%'`;
    } else if (char.includes('tactile')) {
      whereCondition = sql`LOWER(${switchesTable.type}) LIKE '%tactile%'`;
    } else if (char.includes('clicky')) {
      whereCondition = sql`LOWER(${switchesTable.type}) LIKE '%clicky%'`;
    } else if (char.includes('silent')) {
      whereCondition = sql`LOWER(${switchesTable.name}) LIKE '%silent%'`;
    } else if (char.includes('heavy')) {
      whereCondition = sql`${switchesTable.actuationForce} > 60`;
    } else if (char.includes('light')) {
      whereCondition = sql`${switchesTable.actuationForce} < 50`;
    } else {
      // Generic search
      whereCondition = sql`(
        LOWER(${switchesTable.name}) LIKE ${`%${char}%`} OR
        LOWER(${switchesTable.type}) LIKE ${`%${char}%`} OR
        LOWER(${switchesTable.topHousing}) LIKE ${`%${char}%`} OR
        LOWER(${switchesTable.bottomHousing}) LIKE ${`%${char}%`} OR
        LOWER(${switchesTable.stem}) LIKE ${`%${char}%`}
      )`;
    }

    return await db
      .select({
        name: switchesTable.name,
        manufacturer: switchesTable.manufacturer,
        type: switchesTable.type,
        actuationForce: switchesTable.actuationForce,
        topHousing: switchesTable.topHousing,
        bottomHousing: switchesTable.bottomHousing,
        stem: switchesTable.stem
      })
      .from(switchesTable)
      .where(whereCondition)
      .orderBy(sql`RANDOM()`)
      .limit(15);
  }

  /**
   * Generate dynamic regex patterns from database data
   */
  async generateSwitchDetectionPatterns(): Promise<RegExp[]> {
    const manufacturers = await this.getAllManufacturers();
    const switchTypes = await this.getAllSwitchTypes();
    
    const patterns: RegExp[] = [];

    // Manufacturer + type patterns
    const manufacturerGroup = manufacturers.join('|');
    const typeGroup = switchTypes.join('|');
    
    patterns.push(
      new RegExp(`\\b(${manufacturerGroup})\\s+[\\w\\s]*?(${typeGroup})\\b`, 'gi'),
      new RegExp(`\\b(${manufacturerGroup})\\s+[\\w\\s]+`, 'gi'),
      new RegExp(`\\*\\*([^*]*(?:${manufacturerGroup})[^*]*)\\*\\*`, 'gi')
    );

    // Common switch color patterns from database
    const commonColors = await this.getCommonSwitchColors();
    if (commonColors.length > 0) {
      const colorGroup = commonColors.join('|');
      patterns.push(
        new RegExp(`\\b(?:${manufacturerGroup})\\s+(${colorGroup})\\b`, 'gi'),
        new RegExp(`\\b(${colorGroup})\\s+(?:switch|linear|tactile|clicky)\\b`, 'gi')
      );
    }

    return patterns;
  }

  /**
   * Get common switch colors from database by analyzing switch names
   */
  private async getCommonSwitchColors(): Promise<string[]> {
    try {
      const allNames = await this.getAllSwitchNames();
      const colorCounts = new Map<string, number>();
      
      const colorPatterns = [
        'red', 'blue', 'brown', 'black', 'green', 'yellow', 'white', 
        'silver', 'gold', 'pink', 'purple', 'orange', 'clear', 'cream'
      ];

      for (const name of allNames) {
        const lowerName = name.toLowerCase();
        for (const color of colorPatterns) {
          if (lowerName.includes(color)) {
            colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
          }
        }
      }

      // Return colors that appear in at least 5 switch names
      return Array.from(colorCounts.entries())
        .filter(([, count]) => count >= 5)
        .sort(([, a], [, b]) => b - a)
        .map(([color]) => color);
    } catch (error) {
      console.error('Error getting common switch colors:', error);
      return ['red', 'blue', 'brown', 'black', 'green', 'yellow'];
    }
  }

  /**
   * Calculate name similarity for fuzzy matching
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const longer = name1.length > name2.length ? name1 : name2;
    const shorter = name1.length > name2.length ? name2 : name1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance for string similarity
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i] + 1, // deletion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Generate intelligent switch description
   */
  private generateSwitchDescription(switchData: any): string {
    const parts: string[] = [];
    
    if (switchData.type) {
      parts.push(switchData.type);
    }
    
    if (switchData.actuationForce) {
      parts.push(`${switchData.actuationForce}g`);
    }
    
    const materials: string[] = [];
    if (switchData.topHousing) materials.push(switchData.topHousing);
    if (switchData.bottomHousing && switchData.bottomHousing !== switchData.topHousing) {
      materials.push(switchData.bottomHousing);
    }
    if (switchData.stem) materials.push(`${switchData.stem} stem`);
    
    if (materials.length > 0) {
      parts.push(`(${materials.join('/')})`);
    }
    
    return `${switchData.type || 'Switch'} by ${switchData.manufacturer}${parts.length > 1 ? ` - ${parts.slice(1).join(', ')}` : ''}`;
  }

  /**
   * Cache management
   */
  private isCacheValid(): boolean {
    return Date.now() - this.cacheTimestamp < this.CACHE_DURATION;
  }

  private updateCacheTimestamp(): void {
    this.cacheTimestamp = Date.now();
  }

  /**
   * Fallback manufacturers (minimal list for emergencies)
   */
  private getFallbackManufacturers(): string[] {
    return [
      'Cherry', 'Gateron', 'Kailh', 'Akko', 'JWK', 'Durock', 
      'NovelKeys', 'ZealPC', 'Drop', 'TTC', 'Outemu'
    ];
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  public clearCache(): void {
    this.manufacturersCache = null;
    this.switchNamesCache = null;
    this.switchTypesCache = null;
    this.cacheTimestamp = 0;
  }
} 