/**
 * Markdown processing utilities
 * 
 * Provides core markdown parsing and processing functionality
 * including section extraction, table parsing, and list processing.
 */

import { TechnicalSpecSwitch, ExampleSwitch, AnalysisSection } from '../config/responseStructures.js';
import { DatabaseSwitchService } from '../services/databaseSwitchService.js';

/**
 * Core markdown parsing utilities
 */
export class MarkdownProcessor {
  private databaseSwitchService: DatabaseSwitchService;

  constructor() {
    this.databaseSwitchService = DatabaseSwitchService.getInstance();
  }

  /**
   * Parses markdown into structured sections, tables, and lists
   * 
   * @param markdown - Raw markdown content
   * @returns Parsed structure with sections, tables, lists, and metadata
   */
  static parseMarkdown(markdown: string): any {
    console.log(`🔍 parseMarkdown called with ${markdown.length} characters`);
    
    const lines = markdown.split('\n');
    const sections: any[] = [];
    const tables: any[] = [];
    const lists: any[] = [];
    let currentSection: any = null;
    let currentTable: any = null;
    let currentList: any = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) {
        continue;
      }
      
      // Parse headers (H1-H6)
      const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const title = headerMatch[2];
        
        // Close any current structures
        this.finalizeCurrent(currentTable, currentList, tables, lists);
        currentTable = null;
        currentList = null;
        
        // Start new section
        currentSection = {
          type: 'section',
          level,
          title,
          content: [],
          startLine: i
        };
        sections.push(currentSection);
        continue;
      }
      
      // Parse table rows
      if (trimmedLine.includes('|')) {
        if (!currentTable) {
          currentTable = {
            type: 'table',
            headers: [],
            rows: [],
            startLine: i
          };
        }
        
        const cells = trimmedLine.split('|').map(cell => cell.trim()).filter(cell => cell);
        
        if (currentTable.headers.length === 0) {
          currentTable.headers = cells;
        } else if (!trimmedLine.includes('---')) {
          currentTable.rows.push(cells);
        }
        continue;
      }
      
      // Parse list items
      const listMatch = trimmedLine.match(/^[\s]*[-*+]\s+(.+)$/) || trimmedLine.match(/^[\s]*\d+\.\s+(.+)$/);
      if (listMatch) {
        const item = listMatch[1];
        const isNumbered = /^\d+\./.test(trimmedLine);
        
        if (!currentList || currentList.type !== (isNumbered ? 'numbered' : 'bulleted')) {
          this.finalizeCurrent(currentTable, null, tables, lists);
          currentTable = null;
          
          currentList = {
            type: isNumbered ? 'numbered' : 'bulleted',
            items: [],
            startLine: i
          };
        }
        
        currentList.items.push(item);
        continue;
      }
      
      // Regular content
      if (currentSection) {
        currentSection.content.push(line);
      }
    }
    
    // Finalize any remaining structures
    this.finalizeCurrent(currentTable, currentList, tables, lists);
    
    const result = {
      raw: markdown,
      sections,
      tables,
      lists,
      metadata: {
        totalLines: lines.length,
        sectionsCount: sections.length,
        tablesCount: tables.length,
        listsCount: lists.length
      }
    };
    
    console.log(`✅ parseMarkdown completed: ${result.metadata.sectionsCount} sections, ${result.metadata.tablesCount} tables, ${result.metadata.listsCount} lists`);
    return result;
  }

  /**
   * Finalizes current parsing structures and adds them to collections
   */
  private static finalizeCurrent(currentTable: any, currentList: any, tables: any[], lists: any[]): void {
    if (currentTable) {
      tables.push(currentTable);
    }
    if (currentList) {
      lists.push(currentList);
    }
  }

  /**
   * Extracts sections by header level and returns structured content
   * 
   * @param parsedMarkdown - Output from parseMarkdown
   * @param targetLevels - Array of header levels to extract (default: [2, 3])
   * @returns Array of analysis sections
   */
  static extractSections(parsedMarkdown: any, targetLevels: number[] = [2, 3]): AnalysisSection[] {
    console.log(`🔍 Extracting sections at levels: ${targetLevels.join(', ')}`);
    
    const sections: AnalysisSection[] = [];
    
    for (const section of parsedMarkdown.sections) {
      if (targetLevels.includes(section.level)) {
        sections.push({
          title: section.title,
          content: this.extractFormattedText(section.content)
        });
      }
    }
    
    console.log(`✅ Extracted ${sections.length} sections`);
    return sections;
  }

  /**
   * Finds a section by keywords in the title
   * 
   * @param parsedMarkdown - Parsed markdown structure
   * @param keywords - Keywords to search for in section titles
   * @param exactMatch - Whether to require exact keyword match
   * @returns First matching section or null
   */
  static findSection(
    parsedMarkdown: any,
    keywords: string[],
    exactMatch: boolean = false
  ): AnalysisSection | null {
    console.log(`🔍 Finding section with keywords: ${keywords.join(', ')}, exact: ${exactMatch}`);
    
    for (const section of parsedMarkdown.sections) {
      const titleLower = section.title.toLowerCase();
      
      const matches = exactMatch 
        ? keywords.some(keyword => titleLower === keyword.toLowerCase())
        : keywords.some(keyword => titleLower.includes(keyword.toLowerCase()));
      
      if (matches) {
        console.log(`✅ Found section: "${section.title}"`);
        return {
          title: section.title,
          content: this.extractFormattedText(section.content)
        };
      }
    }
    
    console.log(`⚠️ No section found for keywords: ${keywords.join(', ')}`);
    return null;
  }

  /**
   * Extracts content between specific headers
   * 
   * @param markdown - Raw markdown string
   * @param startHeader - Starting header text
   * @param endHeader - Optional ending header text
   * @returns Content between headers
   */
  static extractContentBetweenHeaders(
    markdown: string,
    startHeader: string,
    endHeader?: string
  ): string {
    const lines = markdown.split('\n');
    let capturing = false;
    const capturedContent: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check for start header
      if (trimmedLine.toLowerCase().includes(startHeader.toLowerCase()) && trimmedLine.startsWith('#')) {
        capturing = true;
        continue;
      }
      
      // Check for end header
      if (capturing && endHeader && trimmedLine.toLowerCase().includes(endHeader.toLowerCase()) && trimmedLine.startsWith('#')) {
        break;
      }
      
      // Capture content
      if (capturing) {
        capturedContent.push(line);
      }
    }
    
    return capturedContent.join('\n').trim();
  }

  /**
   * Converts markdown lines to formatted text while preserving structure
   * 
   * @param lines - Array of content lines
   * @returns Formatted text string
   */
  static extractFormattedText(lines: string[]): string {
    if (!lines || lines.length === 0) {
      return '';
    }
    
    // Join lines and clean up extra whitespace while preserving paragraphs
    const text = lines
      .join('\n')
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove extra line breaks
      .trim();
    
    return text;
  }

  /**
   * Database-driven switch validation instead of hardcoded patterns
   */
  public async isLikelyValidSwitch(switchName: string): Promise<boolean> {
    if (!switchName || switchName.length < 2) return false;

    // Clean the switch name
    const cleanedName = switchName.trim().toLowerCase();

    // Check against actual database switches using validation
    const validation = await this.databaseSwitchService.validateSwitchName(cleanedName);
    if (validation.isValid) return true;

    // Use isLikelySwitchName method as fallback
    const isLikely = await this.databaseSwitchService.isLikelySwitchName(cleanedName);
    if (isLikely) return true;

    // Check if it contains manufacturer names from database
    const manufacturers = await this.databaseSwitchService.getAllManufacturers();
    const hasValidManufacturer = manufacturers.some(manufacturer => 
      cleanedName.includes(manufacturer.toLowerCase())
    );

    return hasValidManufacturer;
  }

  /**
   * Database-driven manufacturer identification instead of hardcoded if statements
   */
  public async identifyManufacturer(switchName: string): Promise<string> {
    if (!switchName) return 'Unknown';

    const cleanedName = switchName.trim();

    // Check database first using the available method
    const manufacturerFromDb = await this.databaseSwitchService.findManufacturerBySwitch(cleanedName);
    if (manufacturerFromDb && manufacturerFromDb !== 'Unknown') return manufacturerFromDb;

    // Fuzzy match approach for variations
    const fuzzyMatches = await this.databaseSwitchService.findSimilarSwitches(cleanedName, 3);
    if (fuzzyMatches.length > 0) {
      // Try to get manufacturer from the similar switch
      const match = await this.databaseSwitchService.findManufacturerBySwitch(fuzzyMatches[0].name);
      if (match && match !== 'Unknown') return match;
    }

    return 'Unknown';
  }

  /**
   * Database-driven switch description generation
   */
  public async generateSwitchDescription(switchName: string): Promise<string> {
    const cleanedName = switchName.trim();

    // Try to find similar switches in database
    const similarSwitches = await this.databaseSwitchService.findSimilarSwitches(cleanedName, 1);
    if (similarSwitches.length > 0) {
      return similarSwitches[0].description || this.formatBasicSwitchDescription(cleanedName);
    }

    // Fallback for unknown switches
    const manufacturer = await this.identifyManufacturer(cleanedName);
    return this.formatBasicSwitchDescription(cleanedName, manufacturer);
  }

  /**
   * Format basic switch description when no database match
   */
  private formatBasicSwitchDescription(switchName: string, manufacturer?: string): string {
    const name = switchName.toLowerCase();
    const mfg = manufacturer && manufacturer !== 'Unknown' ? manufacturer : 'Unknown manufacturer';
    
    const type = name.includes('linear') ? 'linear' : 
                 name.includes('tactile') ? 'tactile' : 
                 name.includes('clicky') ? 'clicky' : 'unknown type';
    
    return `${mfg} switch with ${type} characteristics`;
  }
}

/**
 * Table processing utilities
 */
export class TableProcessor {
  /**
   * Parses tables from parsed markdown as objects
   * 
   * @param parsedMarkdown - Output from parseMarkdown
   * @returns Array of table data as object arrays
   */
  static parseTablesAsObjects(parsedMarkdown: any): Record<string, any>[][] {
    console.log(`🔍 Parsing ${parsedMarkdown.tables.length} tables as objects`);
    
    const tableData: Record<string, any>[][] = [];
    
    for (const table of parsedMarkdown.tables) {
      const objectRows: Record<string, any>[] = [];
      
      for (const row of table.rows) {
        const rowObject: Record<string, any> = {};
        
        for (let i = 0; i < Math.min(row.length, table.headers.length); i++) {
          const header = table.headers[i];
          const value = row[i];
          if (header && value) {
            rowObject[header] = value;
          }
        }
        
        objectRows.push(rowObject);
      }
      
      tableData.push(objectRows);
    }
    
    console.log(`✅ Parsed ${tableData.length} tables with ${tableData.reduce((sum, table) => sum + table.length, 0)} total rows`);
    return tableData;
  }

  /**
   * Finds table by header keywords
   * 
   * @param parsedMarkdown - Parsed markdown structure
   * @param headerKeywords - Keywords to search for in headers
   * @param position - Which matching table to return (default: 0 for first)
   * @returns Table data as objects or null if not found
   */
  static findTableByHeaders(
    parsedMarkdown: any,
    headerKeywords: string[],
    position: number = 0
  ): Record<string, any>[] | null {
    console.log(`🔍 Finding table with header keywords: ${headerKeywords.join(', ')}`);
    
    const tables = this.parseTablesAsObjects(parsedMarkdown);
    let matchCount = 0;
    
    for (const table of tables) {
      if (table.length === 0) continue;
      
      const firstRow = table[0];
      const headers = Object.keys(firstRow).join(' ').toLowerCase();
      
      const hasMatchingHeaders = headerKeywords.some(keyword => 
        headers.includes(keyword.toLowerCase())
      );
      
      if (hasMatchingHeaders) {
        if (matchCount === position) {
          console.log(`✅ Found table at position ${position} with ${table.length} rows`);
          return table;
        }
        matchCount++;
      }
    }
    
    console.log(`⚠️ No table found with header keywords: ${headerKeywords.join(', ')}`);
    return null;
  }

  /**
   * Converts table data to technical specifications
   * 
   * @param tableData - Table data as object array
   * @returns Array of technical spec switches
   */
  static convertToTechnicalSpecs(tableData: Record<string, any>[]): TechnicalSpecSwitch[] {
    console.log(`🔍 Converting table data to technical specs: ${tableData.length} rows`);
    
    const specs: TechnicalSpecSwitch[] = [];
    
    for (const row of tableData) {
      const spec: TechnicalSpecSwitch = {
        name: this.extractValue(row, ['name', 'switch', 'model']) || 'Unknown Switch',
        manufacturer: this.extractValue(row, ['manufacturer', 'brand', 'company']) || 'Unknown',
        type: this.extractValue(row, ['type', 'category']) || null,
        actuationForce: this.extractValue(row, ['actuation', 'force', 'actuation force']) || null,
        bottomOutForce: this.extractValue(row, ['bottom out', 'bottom-out', 'bottom_out']) || null,
        preTravel: this.extractValue(row, ['pre travel', 'pre-travel', 'pretravel', 'actuation point']) || null,
        totalTravel: this.extractValue(row, ['total travel', 'total-travel', 'totaltravel', 'travel distance']) || null,
        mount: this.extractValue(row, ['mount', 'mounting']) || null,
        topHousing: this.extractValue(row, ['top housing', 'top_housing', 'top']) || null,
        bottomHousing: this.extractValue(row, ['bottom housing', 'bottom_housing', 'bottom']) || null,
        stem: this.extractValue(row, ['stem', 'stem material']) || null,
        spring: this.extractValue(row, ['spring', 'spring weight']) || null,
        notes: this.extractValue(row, ['notes', 'comments', 'remarks']) || undefined
      };
      
      specs.push(spec);
    }
    
    console.log(`✅ Converted ${specs.length} technical specifications`);
    return specs;
  }

  /**
   * Extracts value from row using possible key variations
   */
  private static extractValue(row: Record<string, any>, possibleKeys: string[]): string | null {
    for (const key of possibleKeys) {
      // Try exact match
      if (row[key]) return row[key];
      
      // Try case-insensitive match
      const foundKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
      if (foundKey && row[foundKey]) return row[foundKey];
      
      // Try partial match
      const partialKey = Object.keys(row).find(k => k.toLowerCase().includes(key.toLowerCase()));
      if (partialKey && row[partialKey]) return row[partialKey];
    }
    return null;
  }
}

/**
 * List processing utilities
 */
export class ListProcessor {
  /**
   * Parses lists from parsed markdown as arrays
   * 
   * @param parsedMarkdown - Output from parseMarkdown
   * @returns Object containing different types of lists
   */
  static parseListsAsArrays(parsedMarkdown: any): {
    bulletedLists: string[][];
    numberedLists: string[][];
    allLists: { type: 'bulleted' | 'numbered'; items: string[]; startLine: number }[];
  } {
    console.log(`🔍 Parsing ${parsedMarkdown.lists.length} lists as arrays`);
    
    const bulletedLists: string[][] = [];
    const numberedLists: string[][] = [];
    const allLists: { type: 'bulleted' | 'numbered'; items: string[]; startLine: number }[] = [];
    
    for (const list of parsedMarkdown.lists) {
      allLists.push({
        type: list.type,
        items: list.items,
        startLine: list.startLine
      });
      
      if (list.type === 'bulleted') {
        bulletedLists.push(list.items);
      } else if (list.type === 'numbered') {
        numberedLists.push(list.items);
      }
    }
    
    console.log(`✅ Parsed ${bulletedLists.length} bulleted lists, ${numberedLists.length} numbered lists`);
    return { bulletedLists, numberedLists, allLists };
  }

  /**
   * Finds lists within a specific section
   * 
   * @param parsedMarkdown - Parsed markdown structure
   * @param sectionTitle - Title of section to search in
   * @returns Array of lists found in the section
   */
  static findListsInSection(
    parsedMarkdown: any,
    sectionTitle: string
  ): { type: 'bulleted' | 'numbered'; items: string[] }[] {
    console.log(`🔍 Finding lists in section: "${sectionTitle}"`);
    
    const targetSection = parsedMarkdown.sections.find((section: any) =>
      section.title.toLowerCase().includes(sectionTitle.toLowerCase())
    );
    
    if (!targetSection) {
      console.log(`⚠️ Section not found: "${sectionTitle}"`);
      return [];
    }
    
    const sectionStartLine = targetSection.startLine;
    const nextSectionStartLine = parsedMarkdown.sections.find((section: any) =>
      section.startLine > sectionStartLine
    )?.startLine || Infinity;
    
    const listsInSection = parsedMarkdown.lists.filter((list: any) =>
      list.startLine > sectionStartLine && list.startLine < nextSectionStartLine
    );
    
    console.log(`✅ Found ${listsInSection.length} lists in section`);
    return listsInSection.map((list: any) => ({
      type: list.type,
      items: list.items
    }));
  }

  /**
   * Extracts key points from lists with optional limit
   * 
   * @param parsedMarkdown - Parsed markdown structure
   * @param maxItems - Maximum number of items to return
   * @returns Array of key point strings
   */
  static extractKeyPointsFromLists(
    parsedMarkdown: any,
    maxItems?: number
  ): string[] {
    console.log(`🔍 Extracting key points from lists, max: ${maxItems || 'unlimited'}`);
    
    const allItems: string[] = [];
    
    for (const list of parsedMarkdown.lists) {
      allItems.push(...list.items);
    }
    
    // Remove duplicates and filter out very short items
    const uniqueItems = [...new Set(allItems)]
      .filter(item => item.length > 10)
      .slice(0, maxItems);
    
    console.log(`✅ Extracted ${uniqueItems.length} key points`);
    return uniqueItems;
  }

  /**
   * Converts list items to example switches using database-driven approach
   */
  static async convertToExampleSwitches(listItems: string[]): Promise<ExampleSwitch[]> {
    console.log(`🔍 convertToExampleSwitches called with ${listItems.length} items`);
    
    const examples: ExampleSwitch[] = [];
    const processor = new MarkdownProcessor(); // Create instance to access database methods
    
    for (const item of listItems) {
      const cleanItem = item.trim();
      
      if (cleanItem.length < 3) continue;
      
      // Pattern 1: **Switch Name** (Manufacturer) - Description
      const boldManufacturerPattern = /\*\*([^*]+)\*\*\s*\(([^)]+)\)\s*[-–—]\s*(.+)/;
      const boldManufacturerMatch = cleanItem.match(boldManufacturerPattern);
      if (boldManufacturerMatch) {
        examples.push({
          name: boldManufacturerMatch[1].trim(),
          manufacturer: boldManufacturerMatch[2].trim(),
          description: boldManufacturerMatch[3].trim()
        });
        continue;
      }
      
      // Pattern 2: Switch Name (Manufacturer) - Description
      const manufacturerPattern = /([^(]+)\s*\(([^)]+)\)\s*[-–—]\s*(.+)/;
      const manufacturerMatch = cleanItem.match(manufacturerPattern);
      if (manufacturerMatch) {
        examples.push({
          name: manufacturerMatch[1].trim(),
          manufacturer: manufacturerMatch[2].trim(),
          description: manufacturerMatch[3].trim()
        });
        continue;
      }
      
      // Pattern 3: **Switch Name** - Description (extract manufacturer from database)
      const boldPattern = /\*\*([^*]+)\*\*\s*[-–—]\s*(.+)/;
      const boldMatch = cleanItem.match(boldPattern);
      if (boldMatch) {
        const switchName = boldMatch[1].trim();
        const manufacturer = await processor.identifyManufacturer(switchName);
        examples.push({
          name: switchName,
          manufacturer,
          description: boldMatch[2].trim()
        });
        continue;
      }
      
      // Pattern 4: Switch Name - Description (extract manufacturer from database)
      const dashSplit = cleanItem.split(/\s*[-–—]\s*/);
      if (dashSplit.length >= 2) {
        const switchName = dashSplit[0].replace(/^\*\*|\*\*$/g, '').trim(); 
        const manufacturer = await processor.identifyManufacturer(switchName);
        examples.push({
          name: switchName,
          manufacturer,
          description: dashSplit.slice(1).join(' - ').trim()
        });
        continue;
      }
      
      // Pattern 5: Switch Name: Description (extract manufacturer from database)
      const colonSplit = cleanItem.split(/\s*:\s*/);
      if (colonSplit.length >= 2) {
        const switchName = colonSplit[0].replace(/^\*\*|\*\*$/g, '').trim(); 
        const manufacturer = await processor.identifyManufacturer(switchName);
        examples.push({
          name: switchName,
          manufacturer,
          description: colonSplit.slice(1).join(': ').trim()
        });
        continue;
      }
      
      // Pattern 6: Just switch name (validate and extract all info from database)
      const switchName = cleanItem.replace(/^\*\*|\*\*$/g, '').trim(); 
      if (switchName.length > 3 && await processor.isLikelyValidSwitch(switchName)) {
        const manufacturer = await processor.identifyManufacturer(switchName);
        const description = await processor.generateSwitchDescription(switchName);
        examples.push({
          name: switchName,
          manufacturer,
          description
        });
      }
    }
    
    console.log(`✅ convertToExampleSwitches converted ${examples.length} examples`);
    return examples;
  }

  /**
   * Database-driven manufacturer extraction (DEPRECATED - use instance method identifyManufacturer)
   * Kept for backward compatibility but now redirects to database-driven approach
   */
  private static async extractManufacturerFromSwitchName(switchName: string): Promise<string> {
    const processor = new MarkdownProcessor();
    return await processor.identifyManufacturer(switchName);
  }
  
  /**
   * Database-driven switch validation (DEPRECATED - use instance method isLikelyValidSwitch)
   * Kept for backward compatibility but now redirects to database-driven approach
   */
  private static async isLikelyValidSwitch(text: string): Promise<boolean> {
    const processor = new MarkdownProcessor();
    return await processor.isLikelyValidSwitch(text);
  }
} 