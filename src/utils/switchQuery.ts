import { sql } from 'drizzle-orm';

import { SWITCH_CHARACTERISTICS } from '../config/materialProperties.js';
import { db } from '../db/index.js';
import { switches as switchesTable } from '../db/schema.js';
import { SwitchCandidate } from '../types/comparison.js';

export class SwitchQueryService {
  /**
   * Get all available switch names from database for resolution service
   */
  async getAllAvailableSwitchNames(): Promise<string[]> {
    try {
      const switches = await db
        .select({ name: switchesTable.name })
        .from(switchesTable)
        .where(sql`${switchesTable.name} IS NOT NULL`);
      
      return switches.map((s) => s.name);
    } catch (error) {
      console.error('Error fetching available switch names:', error);
      return [];
    }
  }

  /**
   * Validate potential switch names against the database
   */
  async validateSwitchNames(potentialNames: string[]): Promise<string[]> {
    if (potentialNames.length === 0) return [];

    const validated: string[] = [];

    for (const name of potentialNames) {
      const cleanName = name.trim();
      if (cleanName.length < 2) continue;

      const results = await db
        .select({ name: switchesTable.name })
        .from(switchesTable)
        .where(sql`LOWER(${switchesTable.name}) LIKE ${'%' + cleanName.toLowerCase() + '%'}`)
        .limit(1);

      if (results.length > 0) {
        validated.push(results[0].name);
      }
    }

    return [...new Set(validated)];
  }

  /**
   * Enhanced validation of potential switch names against the database
   * Uses multiple matching strategies for better accuracy
   */
  async validateAndMatchSwitchNames(potentialNames: string[]): Promise<string[]> {
    if (potentialNames.length === 0) return [];

    const validated: string[] = [];

    for (const name of potentialNames) {
      const cleanName = name.trim().toLowerCase();
      if (cleanName.length < 2) continue;

      // Strategy 1: Exact match (case insensitive)
      let results = await db
        .select({ name: switchesTable.name })
        .from(switchesTable)
        .where(sql`LOWER(${switchesTable.name}) = ${cleanName}`)
        .limit(1);

      if (results.length > 0) {
        validated.push(results[0].name);
        continue;
      }

      // Strategy 2: Contains match (case insensitive)
      results = await db
        .select({ name: switchesTable.name })
        .from(switchesTable)
        .where(sql`LOWER(${switchesTable.name}) LIKE ${'%' + cleanName + '%'}`)
        .limit(3);

      if (results.length > 0) {
        const bestMatch = results.reduce((best, current) =>
          current.name.length < best.name.length ? current : best
        );
        validated.push(bestMatch.name);
        continue;
      }

      // Strategy 3: Word-based matching for compound names
      const words = cleanName.split(/\s+/).filter((word) => word.length > 2);
      if (words.length > 1) {
        const wordConditions = words.map(
          (word) => sql`LOWER(${switchesTable.name}) LIKE ${'%' + word + '%'}`
        );

        results = await db
          .select({ name: switchesTable.name })
          .from(switchesTable)
          .where(
            sql`${wordConditions.reduce((acc, condition, index) =>
              index === 0 ? condition : sql`${acc} AND ${condition}`
            )}`
          )
          .limit(2);

        if (results.length > 0) {
          validated.push(results[0].name);
          continue;
        }
      }

      // Strategy 4: Brand + partial name matching
      const brandMappings = {
        gateron: ['gateron'],
        cherry: ['cherry mx', 'cherry'],
        kailh: ['kailh'],
        akko: ['akko cs', 'akko'],
        jwk: ['jwk', 'durock'],
        novelkeys: ['novelkeys', 'nk'],
        zeal: ['zealios', 'zilents', 'zeal'],
        holy: ['holy panda']
      };

      for (const [brand, dbPrefixes] of Object.entries(brandMappings)) {
        if (cleanName.includes(brand)) {
          for (const prefix of dbPrefixes) {
            results = await db
              .select({ name: switchesTable.name })
              .from(switchesTable)
              .where(sql`LOWER(${switchesTable.name}) LIKE ${prefix.toLowerCase() + '%'}`)
              .limit(5);

            if (results.length > 0) {
              const bestMatch =
                results.find((result) => {
                  const resultLower = result.name.toLowerCase();
                  return words.some((word) => resultLower.includes(word));
                }) || results[0];

              validated.push(bestMatch.name);
              break;
            }
          }
          if (validated.length > 0) break;
        }
      }
    }

    return [...new Set(validated)];
  }

  /**
   * Enhanced material-based switch finding with comprehensive alias detection
   */
  async findSwitchesForMaterialComparison(materialPreferences: string[]): Promise<string[]> {
    console.log(`🧪 Enhanced findSwitchesForMaterialComparison with alias detection`);
    
    const allResults: Array<{ name: string; manufacturer: string; type: string }> = [];
    
    for (const preference of materialPreferences) {
      console.log(`🔍 Processing material preference: "${preference}"`);
      
      // Step 1: Generate material aliases and search terms
      const materialAliases = this.detectMaterialAliases(preference);
      console.log(`📝 Generated ${materialAliases.length} search variations for "${preference}"`);
      
      // Step 2: Execute database queries for each alias
      for (const alias of materialAliases) {
        try {
          const results = await db.execute<{ name: string; manufacturer: string; type: string }>(
            sql`SELECT DISTINCT s.name, s.manufacturer, s.type 
                FROM ${switchesTable} AS s
                WHERE ${sql.raw(alias.condition)}
                AND s.name IS NOT NULL
                LIMIT 10`
          );
          
          console.log(`🎯 Found ${results.length} switches for search term "${alias.searchTerm}"`);
          allResults.push(...results);
        } catch (queryError) {
          console.warn(`⚠️ Query failed for alias "${alias.searchTerm}":`, queryError);
        }
      }
    }
    
    // Step 3: Select variety switches to ensure good representation
    const varietySwitches = this.selectVarietySwitches(allResults, 3);
    
    console.log(
      `✅ Material comparison completed - selected ${varietySwitches.length} representative switches`
    );
    return varietySwitches.map((s) => s.name);
  }

  /**
   * Detect material aliases and generate search conditions
   */
  private detectMaterialAliases(
    preference: string
  ): Array<{ searchTerm: string; condition: string }> {
    const aliases: Array<{ searchTerm: string; condition: string }> = [];
    const pref = preference.toLowerCase();
    
    if (pref.includes('abs') || pref === 'plastic') {
      aliases.push({
        searchTerm: 'ABS housing',
        condition: `(LOWER(s.top_housing) LIKE '%abs%' OR LOWER(s.bottom_housing) LIKE '%abs%')`
      });
    }
    
    if (pref.includes('pom') || pref.includes('polyom')) {
      aliases.push({
        searchTerm: 'POM housing',
        condition: `(LOWER(s.top_housing) LIKE '%pom%' OR LOWER(s.bottom_housing) LIKE '%pom%')`
      });
    }
    
    if (pref.includes('pc') || pref.includes('polycarbonate')) {
      aliases.push({
        searchTerm: 'PC/Polycarbonate housing',
        condition: `(LOWER(s.top_housing) LIKE '%pc%' OR LOWER(s.bottom_housing) LIKE '%pc%' OR LOWER(s.top_housing) LIKE '%polycarbonate%' OR LOWER(s.bottom_housing) LIKE '%polycarbonate%')`
      });
    }
    
    if (pref.includes('nylon')) {
      aliases.push({
        searchTerm: 'Nylon housing',
        condition: `(LOWER(s.top_housing) LIKE '%nylon%' OR LOWER(s.bottom_housing) LIKE '%nylon%')`
      });
    }
    
    if (pref.includes('gateron')) {
      aliases.push({
        searchTerm: 'Gateron switches',
        condition: `LOWER(s.manufacturer) LIKE '%gateron%'`
      });
    }
    
    if (pref.includes('cherry')) {
      aliases.push({
        searchTerm: 'Cherry switches',
        condition: `LOWER(s.manufacturer) LIKE '%cherry%'`
      });
    }
    
    aliases.push({
      searchTerm: `General search: ${preference}`,
      condition: `(LOWER(s.name) LIKE '%${pref}%' OR LOWER(s.top_housing) LIKE '%${pref}%' OR LOWER(s.bottom_housing) LIKE '%${pref}%' OR LOWER(s.stem) LIKE '%${pref}%')`
    });
    
    return aliases;
  }

  /**
   * Select variety switches to ensure good representation across manufacturers and types
   */
  private selectVarietySwitches(
    switches: Array<{ name: string; manufacturer: string; type: string }>, 
    maxCount: number
  ): Array<{ name: string; manufacturer: string; type: string }> {
    const uniqueSwitches = switches.filter(
      (switch_, index, arr) => arr.findIndex((s) => s.name === switch_.name) === index
    );
    
    if (uniqueSwitches.length <= maxCount) {
      return uniqueSwitches;
    }
    
    const selected: Array<{ name: string; manufacturer: string; type: string }> = [];
    const usedManufacturers = new Set<string>();
    const usedTypes = new Set<string>();
    
    // Priority 1: Ensure manufacturer diversity
    for (const switch_ of uniqueSwitches) {
      if (selected.length >= maxCount) break;
      
      if (!usedManufacturers.has(switch_.manufacturer?.toLowerCase() || '')) {
        selected.push(switch_);
        usedManufacturers.add(switch_.manufacturer?.toLowerCase() || '');
        usedTypes.add(switch_.type?.toLowerCase() || '');
      }
    }
    
    // Priority 2: Ensure type diversity
    for (const switch_ of uniqueSwitches) {
      if (selected.length >= maxCount) break;
      
      if (
        !selected.some((s) => s.name === switch_.name) &&
        !usedTypes.has(switch_.type?.toLowerCase() || '')
      ) {
        selected.push(switch_);
        usedTypes.add(switch_.type?.toLowerCase() || '');
      }
    }
    
    // Priority 3: Fill remaining slots
    for (const switch_ of uniqueSwitches) {
      if (selected.length >= maxCount) break;
      
      if (!selected.some((s) => s.name === switch_.name)) {
        selected.push(switch_);
      }
    }
    
    return selected.slice(0, maxCount);
  }

  /**
   * Find candidate switches for characteristics-based comparison
   */
  async findCandidateSwitchesForCharacteristics(
    characteristics: string[]
  ): Promise<SwitchCandidate[]> {
    console.log(`🔍 Finding candidate switches for characteristics: ${characteristics.join(', ')}`);
    
    const candidates: SwitchCandidate[] = [];
    const processedSwitches = new Set<string>();
    
    for (const characteristic of characteristics) {
      const char = characteristic.toLowerCase();
      console.log(`🎯 Processing characteristic: "${char}"`);
      
      try {
        let query: any;
        
        // Build queries based on characteristic type
        if (char.includes('smooth') || char.includes('linear')) {
          query = sql`
            SELECT s.name, s.manufacturer, s.type, s.actuationForce, s.descriptionText
            FROM ${switchesTable} AS s
            WHERE (LOWER(s.type) LIKE '%linear%' 
                  OR LOWER(s.name) LIKE '%smooth%'
                  OR LOWER(s.name) LIKE '%linear%'
                  OR LOWER(s.descriptionText) LIKE '%smooth%'
                  OR LOWER(s.descriptionText) LIKE '%linear%')
            AND s.name IS NOT NULL
            ORDER BY s.actuationForce ASC NULLS LAST
            LIMIT 15
          `;
        } else if (char.includes('clicky') || char.includes('click')) {
          query = sql`
            SELECT s.name, s.manufacturer, s.type, s.actuationForce, s.descriptionText
            FROM ${switchesTable} AS s
            WHERE (LOWER(s.type) LIKE '%clicky%'
                  OR LOWER(s.name) LIKE '%blue%'
                  OR LOWER(s.name) LIKE '%clicky%'
                  OR LOWER(s.descriptionText) LIKE '%clicky%'
                  OR LOWER(s.descriptionText) LIKE '%click%')
            AND s.name IS NOT NULL
            ORDER BY s.actuationForce ASC NULLS LAST
            LIMIT 15
          `;
        } else if (char.includes('tactile') || char.includes('bump')) {
          query = sql`
            SELECT s.name, s.manufacturer, s.type, s.actuationForce, s.descriptionText
            FROM ${switchesTable} AS s
            WHERE (LOWER(s.type) LIKE '%tactile%'
                  OR LOWER(s.name) LIKE '%brown%'
                  OR LOWER(s.name) LIKE '%tactile%'
                  OR LOWER(s.descriptionText) LIKE '%tactile%'
                  OR LOWER(s.descriptionText) LIKE '%bump%')
            AND s.name IS NOT NULL
            ORDER BY s.actuationForce ASC NULLS LAST
            LIMIT 15
          `;
        } else {
          // Generic search for other characteristics
          query = sql`
            SELECT s.name, s.manufacturer, s.type, s.actuationForce, s.descriptionText
            FROM ${switchesTable} AS s
            WHERE (LOWER(s.name) LIKE ${`%${char}%`}
                  OR LOWER(s.descriptionText) LIKE ${`%${char}%`}
                  OR LOWER(s.type) LIKE ${`%${char}%`})
            AND s.name IS NOT NULL
            ORDER BY s.actuationForce ASC NULLS LAST
            LIMIT 10
          `;
        }
        
        const results = await db.execute<{
          name: string;
          manufacturer: string;
          type: string;
          actuationForce: number | null;
          description: string;
        }>(query);
        
        console.log(`📊 Found ${results.length} candidates for "${char}"`);
        
        // Add to candidates if not already processed
        for (const result of results) {
          if (!processedSwitches.has(result.name)) {
            candidates.push({
              name: result.name,
              manufacturer: result.manufacturer,
              type: result.type,
              actuationForce: result.actuationForce,
              description: result.description || ''
            });
            processedSwitches.add(result.name);
          }
        }
      } catch (error) {
        console.error(`❌ Error querying for characteristic "${char}":`, error);
      }
    }
    
    console.log(`✅ Total candidates found: ${candidates.length}`);
    return candidates;
  }

  /**
   * Enhanced switch name parsing and extraction logic
   * Handles multiple query formats and extraction strategies
   */
  async parseAndExtractSwitchNames(userQuery: string): Promise<string[]> {
    const query = userQuery.toLowerCase().trim();
    const extractedNames: string[] = [];

    // Strategy 1: Direct pattern matching for common comparison formats
    const directPatterns = [
      // "X vs Y" patterns
      /(\w[\w\s-]*?)\s+(?:vs|versus)\s+(\w[\w\s-]*?)(?:\s|$|\?|\.|,)/gi,
      // "compare X and Y" patterns
      /compare\s+(\w[\w\s-]*?)\s+(?:and|with|to)\s+(\w[\w\s-]*?)(?:\s|$|\?|\.|,)/gi,
      // "difference between X and Y" patterns
      /difference\s+between\s+(\w[\w\s-]*?)\s+and\s+(\w[\w\s-]*?)(?:\s|$|\?|\.|,)/gi,
      // "X or Y" patterns (when comparison keywords are present)
      /(\w[\w\s-]*?)\s+or\s+(\w[\w\s-]*?)(?:\s|$|\?|\.|,)/gi
    ];

    for (const pattern of directPatterns) {
      const matches = [...query.matchAll(pattern)];
      for (const match of matches) {
        if (match[1] && match[2]) {
          extractedNames.push(match[1].trim(), match[2].trim());
        }
      }
    }

    // Strategy 2: Enhanced brand-based extraction
    const brandPatterns = [
      /(?:gateron)\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(?:cherry)\s+mx\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(?:cherry)\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(?:kailh)\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(?:akko)\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(?:jwk|durock)\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(?:novelkeys|novel\s*keys)\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(?:zeal|zealios)\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(?:holy)\s+([\w\s-]+?)(?:\s+switch|\s*$|\s*[,.\?])/gi
    ];

    for (const pattern of brandPatterns) {
      const matches = [...query.matchAll(pattern)];
      for (const match of matches) {
        if (match[1]) {
          const fullName = match[0].replace(/\s+switch$/i, '').trim();
          extractedNames.push(fullName);
        }
      }
    }

    // Strategy 3: Color-based switch extraction with context
    const colorPatterns = [
      /(?:gateron|cherry|kailh|akko)\s+(red|blue|brown|black|green|yellow|white|silver|gold|pink|purple|orange|clear)(?:\s+switch|\s*$|\s*[,.\?])/gi,
      /(red|blue|brown|black|green|yellow|white|silver|gold|pink|purple|orange|clear)\s+(?:switch|linear|tactile|clicky)(?:\s*$|\s*[,.\?])/gi
    ];

    for (const pattern of colorPatterns) {
      const matches = [...query.matchAll(pattern)];
      for (const match of matches) {
        extractedNames.push(match[0].replace(/\s+switch$/i, '').trim());
      }
    }

    // Strategy 4: Handle quoted or explicitly mentioned switches
    const quotedSwitches = query.match(/"([^"]+)"/g) || query.match(/'([^']+)'/g);
    if (quotedSwitches) {
      for (const quoted of quotedSwitches) {
        const cleaned = quoted.replace(/['"]/g, '').trim();
        if (cleaned.length > 2) {
          extractedNames.push(cleaned);
        }
      }
    }

    // Strategy 5: List detection (switches separated by commas, "and", etc.)
    if (query.includes(',') || query.includes(' and ')) {
      const listItems = query
        .split(/,|\s+and\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length > 2)
        .filter((item) => {
          const switchIndicators = [
            'switch',
            'linear',
            'tactile',
            'clicky',
            'mx',
            'gateron',
            'cherry',
            'kailh'
          ];
          return (
            switchIndicators.some((indicator) => item.includes(indicator)) ||
            /^[a-z\s-]+$/.test(item)
          );
        });

      extractedNames.push(...listItems);
    }

    const cleanedNames = extractedNames
      .map((name) => name.trim())
      .filter((name) => name.length > 2)
      .filter((name) => !['switch', 'switches', 'linear', 'tactile', 'clicky'].includes(name))
      .map((name) => name.replace(/\s*switches?\s*$/i, ''))
      .filter((name, index, array) => array.indexOf(name) === index);

    return cleanedNames;
  }

  /**
   * Extracts potential switch names from the query using heuristics
   */
  async extractPotentialSwitchNames(query: string): Promise<string[]> {
    const potential: string[] = [];

    // Common switch name patterns (Brand + Name/Type)
    const switchPatterns = [
      // Brand + descriptive name patterns
      /(?:gateron|cherry|kailh|akko|jwk|novelkeys|zeal|holy)\s+[\w\s-]+/gi,
      // Color-based switch names
      /(?:red|blue|brown|black|green|yellow|white|silver|gold|pink|purple|orange)\s*(?:switch|switches)?/gi,
      // Common specific switch names
      /(?:cream|ink|oil\s*king|banana\s*split|alpaca|tangerine|lavender|silent|tactile|linear|clicky)/gi
    ];

    for (const pattern of switchPatterns) {
      const matches = [...query.matchAll(pattern)];
      for (const match of matches) {
        const candidate = match[0].trim().replace(/\s*switches?\s*$/i, '');
        if (candidate.length > 2) {
          potential.push(candidate);
        }
      }
    }

    return [...new Set(potential)];
  }

  /**
   * Find all switches that match a specific characteristic (for characteristics explanation)
   * Returns all switches of a given type for random sampling
   * Enhanced: Focuses on material properties and design rather than just name matching
   */
  async findAllSwitchesForCharacteristic(characteristic: string): Promise<SwitchCandidate[]> {
    console.log(
      `🔍 Finding all switches for characteristic: "${characteristic}" (material-based approach)`
    );

    try {
      let queryCondition: any;

      switch (characteristic.toLowerCase()) {
        case 'linear':
        case 'smooth':
          // Focus on linear type and materials that contribute to smoothness
          queryCondition = sql`(
            LOWER(${switchesTable.type}) LIKE '%linear%' 
            OR (LOWER(${switchesTable.stem}) LIKE '%pom%') 
            OR (LOWER(${switchesTable.topHousing}) LIKE '%pom%' OR LOWER(${switchesTable.bottomHousing}) LIKE '%pom%')
            OR (LOWER(${switchesTable.name}) LIKE '%oil%' OR LOWER(${switchesTable.name}) LIKE '%smooth%')
          )`;
          break;

        case 'clicky':
          // Focus on clicky type and design elements
          queryCondition = sql`(
            LOWER(${switchesTable.type}) LIKE '%clicky%'
            OR LOWER(${switchesTable.name}) LIKE '%blue%'
            OR LOWER(${switchesTable.name}) LIKE '%green%'
          )`;
          break;

        case 'tactile':
          // Focus on tactile type and bump characteristics
          queryCondition = sql`(
            LOWER(${switchesTable.type}) LIKE '%tactile%'
            OR LOWER(${switchesTable.name}) LIKE '%brown%'
            OR LOWER(${switchesTable.name}) LIKE '%clear%'
          )`;
          break;

        case 'silent':
        case 'quiet':
          // Focus on dampened designs and silent mechanisms
          queryCondition = sql`(
            LOWER(${switchesTable.name}) LIKE '%silent%' 
            OR LOWER(${switchesTable.name}) LIKE '%quiet%'
            OR LOWER(${switchesTable.type}) LIKE '%silent%'
          )`;
          break;

        case 'creamy':
        case 'buttery':
          // Focus on materials and manufacturing that create creamy feel
          queryCondition = sql`(
            (LOWER(${switchesTable.stem}) LIKE '%pom%') 
            OR (LOWER(${switchesTable.topHousing}) LIKE '%pom%' AND LOWER(${switchesTable.bottomHousing}) LIKE '%pom%')
            OR (LOWER(${switchesTable.type}) LIKE '%linear%' AND ${switchesTable.actuationForce} BETWEEN 45 AND 60)
            OR (LOWER(${switchesTable.name}) LIKE '%cream%' OR LOWER(${switchesTable.name}) LIKE '%oil%')
          )`;
          break;

        case 'thocky':
        case 'deep':
          // Focus on housing materials that create deep, thocky sounds
          queryCondition = sql`(
            (LOWER(${switchesTable.topHousing}) LIKE '%nylon%' OR LOWER(${switchesTable.bottomHousing}) LIKE '%nylon%')
            OR (LOWER(${switchesTable.topHousing}) LIKE '%pom%' AND LOWER(${switchesTable.bottomHousing}) LIKE '%pom%')
            OR (${switchesTable.actuationForce} > 55)
          )`;
          break;

        case 'crisp':
        case 'clacky':
          // Focus on housing materials that create crisp, clacky sounds
          queryCondition = sql`(
            (LOWER(${switchesTable.topHousing}) LIKE '%pc%' OR LOWER(${switchesTable.bottomHousing}) LIKE '%pc%')
            OR (LOWER(${switchesTable.topHousing}) LIKE '%polycarbonate%' OR LOWER(${switchesTable.bottomHousing}) LIKE '%polycarbonate%')
            OR LOWER(${switchesTable.type}) LIKE '%clicky%'
          )`;
          break;

        case 'heavy':
          // Focus on actuation force
          queryCondition = sql`${switchesTable.actuationForce} > 60`;
          break;

        case 'light':
          // Focus on low actuation force
          queryCondition = sql`${switchesTable.actuationForce} < 50`;
          break;

        default:
          // Enhanced generic search - look at multiple fields
          queryCondition = sql`(
            LOWER(${switchesTable.name}) LIKE ${'%' + characteristic.toLowerCase() + '%'}
            OR LOWER(${switchesTable.type}) LIKE ${'%' + characteristic.toLowerCase() + '%'}
            OR LOWER(${switchesTable.topHousing}) LIKE ${'%' + characteristic.toLowerCase() + '%'}
            OR LOWER(${switchesTable.bottomHousing}) LIKE ${'%' + characteristic.toLowerCase() + '%'}
            OR LOWER(${switchesTable.stem}) LIKE ${'%' + characteristic.toLowerCase() + '%'}
          )`;
      }

      const results = await db
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
        .where(queryCondition)
        .orderBy(sql`RANDOM()`)
        .limit(20);

      const candidates: SwitchCandidate[] = results.map((result) => ({
        name: result.name,
        manufacturer: result.manufacturer,
        type: result.type || 'Unknown',
        actuationForce: result.actuationForce,
        description: `${result.type || 'Unknown'} switch by ${result.manufacturer}${result.actuationForce ? `, ${result.actuationForce}g` : ''}${
          result.topHousing || result.bottomHousing || result.stem
            ? ` (${[result.topHousing, result.bottomHousing, result.stem].filter(Boolean).join('/')})`
            : ''
        }`
      }));

      console.log(
        `✅ Found ${candidates.length} switches for characteristic "${characteristic}" using material-based matching`
      );
      return candidates;
    } catch (error) {
      console.error(`❌ Error finding switches for characteristic "${characteristic}":`, error);
      return [];
    }
  }

  /**
   * AI-Enhanced characteristic-based switch finding
   * Uses centralized characteristic definitions instead of hard-coded checks
   */
  async findAllSwitchesForCharacteristicAI(characteristic: string): Promise<SwitchCandidate[]> {
    console.log(`🧠 AI-enhanced characteristic search for: "${characteristic}"`);

    try {
      // Get the characteristic definition from our centralized config
      const characteristicDef = SWITCH_CHARACTERISTICS[characteristic.toLowerCase()];

      if (!characteristicDef) {
        console.log(`⚠️ Unknown characteristic "${characteristic}", falling back to legacy method`);
        return this.findAllSwitchesForCharacteristic(characteristic);
      }

      console.log(
        `📋 Using ${characteristicDef.databaseMappingStrategy} strategy for "${characteristicDef.primaryName}"`
      );

      // Build SQL condition based on the characteristic definition
      const sqlCondition = this.buildSQLConditionFromCharacteristic(characteristicDef);

      const results = await db
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
        .where(sqlCondition)
        .orderBy(sql`RANDOM()`)
        .limit(20);

      const candidates: SwitchCandidate[] = results.map((result) => ({
        name: result.name,
        manufacturer: result.manufacturer,
        type: result.type || 'Unknown',
        actuationForce: result.actuationForce,
        description: `${result.type || 'Unknown'} switch by ${result.manufacturer}${result.actuationForce ? `, ${result.actuationForce}g` : ''}${
          result.topHousing || result.bottomHousing || result.stem
            ? ` (${[result.topHousing, result.bottomHousing, result.stem].filter(Boolean).join('/')})`
            : ''
        }`
      }));

      console.log(
        `✅ Found ${candidates.length} switches for characteristic "${characteristic}" using AI-enhanced approach`
      );
      return candidates;
    } catch (error) {
      console.error(`❌ AI-enhanced characteristic search failed for "${characteristic}":`, error);
      return this.findAllSwitchesForCharacteristic(characteristic);
    }
  }

  /**
   * Build SQL condition from characteristic definition
   */
  private buildSQLConditionFromCharacteristic(characteristicDef: any): any {
    const conditions: any[] = [];
    const dbConditions = characteristicDef.databaseConditions;

    // Type-based conditions
    if (dbConditions.typeConditions && dbConditions.typeConditions.length > 0) {
      const typeConditions = dbConditions.typeConditions.map(
        (type: string) => sql`LOWER(${switchesTable.type}) LIKE ${'%' + type.toLowerCase() + '%'}`
      );
      conditions.push(
        sql`(${typeConditions.reduce((acc: any, cond: any, idx: number) =>
          idx === 0 ? cond : sql`${acc} OR ${cond}`
        )})`
      );
    }

    // Material-based conditions
    if (dbConditions.materialConditions) {
      const materialConds: any[] = [];

      if (
        dbConditions.materialConditions.housing &&
        dbConditions.materialConditions.housing.length > 0
      ) {
        const housingConds = dbConditions.materialConditions.housing.map(
          (material: string) =>
            sql`(LOWER(${switchesTable.topHousing}) LIKE ${'%' + material.toLowerCase() + '%'} OR LOWER(${switchesTable.bottomHousing}) LIKE ${'%' + material.toLowerCase() + '%'})`
        );
        materialConds.push(
          sql`(${housingConds.reduce((acc: any, cond: any, idx: number) =>
            idx === 0 ? cond : sql`${acc} OR ${cond}`
          )})`
        );
      }

      if (dbConditions.materialConditions.stem && dbConditions.materialConditions.stem.length > 0) {
        const stemConds = dbConditions.materialConditions.stem.map(
          (material: string) =>
            sql`LOWER(${switchesTable.stem}) LIKE ${'%' + material.toLowerCase() + '%'}`
        );
        materialConds.push(
          sql`(${stemConds.reduce((acc: any, cond: any, idx: number) =>
            idx === 0 ? cond : sql`${acc} OR ${cond}`
          )})`
        );
      }

      if (materialConds.length > 0) {
        conditions.push(
          sql`(${materialConds.reduce((acc: any, cond: any, idx: number) =>
            idx === 0 ? cond : sql`${acc} OR ${cond}`
          )})`
        );
      }
    }

    // Force-based conditions
    if (dbConditions.forceConditions) {
      const force = dbConditions.forceConditions;
      if (force.operator === '>') {
        conditions.push(sql`${switchesTable.actuationForce} > ${force.values[0]}`);
      } else if (force.operator === '<') {
        conditions.push(sql`${switchesTable.actuationForce} < ${force.values[0]}`);
      } else if (force.operator === 'BETWEEN') {
        conditions.push(
          sql`${switchesTable.actuationForce} BETWEEN ${force.values[0]} AND ${force.values[1]}`
        );
      }
    }

    // Name-based conditions
    if (dbConditions.nameConditions && dbConditions.nameConditions.length > 0) {
      const nameConds = dbConditions.nameConditions.map(
        (name: string) => sql`LOWER(${switchesTable.name}) LIKE ${'%' + name.toLowerCase() + '%'}`
      );
      conditions.push(
        sql`(${nameConds.reduce((acc: any, cond: any, idx: number) =>
          idx === 0 ? cond : sql`${acc} OR ${cond}`
        )})`
      );
    }

    // Combine all conditions with OR logic
    if (conditions.length === 0) {
      conditions.push(
        sql`LOWER(${switchesTable.name}) LIKE ${'%' + characteristicDef.primaryName.toLowerCase() + '%'}`
      );
    }

    return conditions.reduce((acc: any, cond: any, idx: number) =>
      idx === 0 ? cond : sql`${acc} OR ${cond}`
    );
  }

  /**
   * Find example switches for a specific material with full switch details
   */
  async findSwitchesForSpecificMaterial(material: string): Promise<any[]> {
    console.log(`🔍 Finding switches for specific material: "${material}"`);

    const materialLower = material.toLowerCase();
    let searchCondition = '';

    // Build search condition based on material type
    if (materialLower === 'polycarbonate' || materialLower === 'pc') {
      searchCondition = `(LOWER(s.top_housing) LIKE '%pc%' OR LOWER(s.bottom_housing) LIKE '%pc%' OR LOWER(s.top_housing) LIKE '%polycarbonate%' OR LOWER(s.bottom_housing) LIKE '%polycarbonate%')`;
    } else if (materialLower === 'nylon') {
      searchCondition = `(LOWER(s.top_housing) LIKE '%nylon%' OR LOWER(s.bottom_housing) LIKE '%nylon%')`;
    } else if (materialLower === 'pom') {
      searchCondition = `(LOWER(s.top_housing) LIKE '%pom%' OR LOWER(s.bottom_housing) LIKE '%pom%' OR LOWER(s.stem) LIKE '%pom%')`;
    } else if (materialLower === 'pa12') {
      searchCondition = `(LOWER(s.top_housing) LIKE '%pa12%' OR LOWER(s.bottom_housing) LIKE '%pa12%' OR LOWER(s.top_housing) LIKE '%nylon 12%' OR LOWER(s.bottom_housing) LIKE '%nylon 12%')`;
    } else if (materialLower === 'uhmwpe') {
      searchCondition = `(LOWER(s.stem) LIKE '%uhmwpe%' OR LOWER(s.stem) LIKE '%ultra%high%molecular%')`;
    } else if (materialLower === 'pok') {
      searchCondition = `(LOWER(s.stem) LIKE '%pok%' OR LOWER(s.stem) LIKE '%polyketone%')`;
    } else if (materialLower === 'ink') {
      searchCondition = `(LOWER(s.top_housing) LIKE '%ink%' OR LOWER(s.bottom_housing) LIKE '%ink%' OR LOWER(s.name) LIKE '%ink%')`;
    } else {
      searchCondition = `(LOWER(s.top_housing) LIKE '%${materialLower}%' OR LOWER(s.bottom_housing) LIKE '%${materialLower}%' OR LOWER(s.stem) LIKE '%${materialLower}%' OR LOWER(s.name) LIKE '%${materialLower}%')`;
    }

    try {
      const results = await db.execute<{
        name: string;
        manufacturer: string;
        type: string;
        actuationForce: number | null;
        topHousing: string | null;
        bottomHousing: string | null;
        stem: string | null;
      }>(sql`
        SELECT DISTINCT 
          s.name, 
          s.manufacturer, 
          s.type,
          s.actuation_force as "actuationForce",
          s.top_housing as "topHousing",
          s.bottom_housing as "bottomHousing",
          s.stem
        FROM ${switchesTable} AS s
        WHERE ${sql.raw(searchCondition)}
        AND s.name IS NOT NULL
        ORDER BY s.name
        LIMIT 5
      `);

      console.log(`📊 Found ${results.length} switches for material "${material}"`);
      return results;
    } catch (error) {
      console.error(`❌ Failed to find switches for material "${material}":`, error);
      return [];
    }
  }
}
