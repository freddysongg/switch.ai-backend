/**
 * Text processing utilities
 * 
 * Provides text formatting, cleaning, and markdown processing utilities
 * for content manipulation and presentation.
 */

/**
 * Text formatting and cleaning utilities
 */
export class TextProcessor {
  /**
   * Preserves markdown formatting while cleaning text
   * 
   * @param text - Text to process
   * @returns Cleaned text with preserved formatting
   */
  static preserveMarkdownFormatting(text: string): string {
    if (!text) return '';
    
    // Clean up excessive whitespace while preserving markdown structure
    return text
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines to 2
      .replace(/\s{2,}/g, ' ') // Replace multiple spaces with single space
      .replace(/\t/g, '  ') // Replace tabs with 2 spaces
      .trim();
  }

  /**
   * Extracts formatted text from lines while preserving structure
   * 
   * @param lines - Array of text lines
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
    
    return this.preserveMarkdownFormatting(text);
  }

  /**
   * Detects markdown formatting in text
   * 
   * @param text - Text to analyze
   * @returns Object describing detected formatting
   */
  static detectMarkdownFormatting(text: string): {
    hasBold: boolean;
    hasItalic: boolean;
    hasLinks: boolean;
    hasCode: boolean;
    hasStrikethrough: boolean;
  } {
    return {
      hasBold: /\*\*.*?\*\*/.test(text) || /__.*?__/.test(text),
      hasItalic: /\*.*?\*/.test(text) || /_.*?_/.test(text),
      hasLinks: /\[.*?\]\(.*?\)/.test(text),
      hasCode: /`.*?`/.test(text) || /```[\s\S]*?```/.test(text),
      hasStrikethrough: /~~.*?~~/.test(text)
    };
  }

  /**
   * Extracts markdown links from text
   * 
   * @param text - Text containing markdown links
   * @returns Object with extracted links and processed text
   */
  static extractMarkdownLinks(text: string): {
    links: { text: string; url: string; }[];
    textWithLinks: string;
  } {
    const links: { text: string; url: string; }[] = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = linkRegex.exec(text)) !== null) {
      links.push({
        text: match[1],
        url: match[2]
      });
    }
    
    // Replace markdown links with just the link text
    const textWithLinks = text.replace(linkRegex, '$1');
    
    return { links, textWithLinks };
  }

  /**
   * Cleans text content while optionally preserving formatting
   * 
   * @param text - Text to clean
   * @param preserveFormatting - Whether to preserve markdown formatting
   * @returns Cleaned text
   */
  static cleanTextContent(text: string, preserveFormatting: boolean = true): string {
    if (!text) return '';
    
    let cleaned = text;
    
    if (preserveFormatting) {
      // Clean while preserving markdown
      cleaned = this.preserveMarkdownFormatting(cleaned);
    } else {
      // Remove all markdown formatting
      cleaned = cleaned
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1') // Italic
        .replace(/__(.*?)__/g, '$1') // Bold alt
        .replace(/_(.*?)_/g, '$1') // Italic alt
        .replace(/~~(.*?)~~/g, '$1') // Strikethrough
        .replace(/`(.*?)`/g, '$1') // Inline code
        .replace(/```[\s\S]*?```/g, '') // Code blocks
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
        .replace(/#{1,6}\s+/g, '') // Headers
        .replace(/^\s*[-*+]\s+/gm, '') // List items
        .replace(/^\s*\d+\.\s+/gm, '') // Numbered lists
        .replace(/\n{3,}/g, '\n\n') // Multiple newlines
        .trim();
    }
    
    return cleaned;
  }

  /**
   * Extracts the first meaningful line from text
   * 
   * @param text - Text to process
   * @returns First non-empty line or null
   */
  static extractFirstLine(text: string): string | null {
    if (!text) return null;
    
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed.length > 5) {
        return trimmed;
      }
    }
    
    return null;
  }

  /**
   * Extracts basic key points from text
   * 
   * @param text - Text to analyze
   * @returns Array of key point strings
   */
  static extractBasicKeyPoints(text: string): string[] {
    if (!text) return [];
    
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 200);
    
    // Take first few substantial sentences as key points
    return sentences.slice(0, 5);
  }

  /**
   * Extracts content by keywords from parsed markdown
   * 
   * @param parsed - Parsed markdown structure
   * @param keywords - Keywords to search for
   * @returns Relevant content string
   */
  static extractContentByKeywords(parsed: any, keywords: string[]): string {
    const relevantContent: string[] = [];
    
    // Search through sections
    for (const section of parsed.sections || []) {
      const titleLower = section.title.toLowerCase();
      const contentLower = section.content.join(' ').toLowerCase();
      
      for (const keyword of keywords) {
        if (titleLower.includes(keyword.toLowerCase()) || contentLower.includes(keyword.toLowerCase())) {
          relevantContent.push(this.extractFormattedText(section.content));
          break; // Don't add the same section multiple times
        }
      }
    }
    
    // If no sections found, search in raw content
    if (relevantContent.length === 0 && parsed.raw) {
      const lines = parsed.raw.split('\n');
      const matchingLines: string[] = [];
      
      for (const line of lines) {
        for (const keyword of keywords) {
          if (line.toLowerCase().includes(keyword.toLowerCase())) {
            matchingLines.push(line);
            break;
          }
        }
      }
      
      if (matchingLines.length > 0) {
        relevantContent.push(matchingLines.join('\n'));
      }
    }
    
    return relevantContent.join('\n\n').trim() || 'No relevant content found';
  }

  /**
   * Extracts section content by keywords from raw markdown
   * 
   * @param markdown - Raw markdown string
   * @param keywords - Keywords to search for
   * @returns Relevant section content
   */
  static extractSectionContent(markdown: string, keywords: string[]): string {
    const lines = markdown.split('\n');
    const relevantLines: string[] = [];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      for (const keyword of keywords) {
        if (lowerLine.includes(keyword.toLowerCase())) {
          relevantLines.push(line);
          break;
        }
      }
    }
    
    return relevantLines.join('\n').trim() || 'No specific information available';
  }

  /**
   * Extracts key differences from markdown content
   * 
   * @param markdown - Raw markdown string
   * @returns Array of key difference strings
   */
  static extractKeyDifferences(markdown: string): string[] {
    const lines = markdown.split('\n');
    const differences: string[] = [];
    
    const differenceKeywords = [
      'difference', 'different', 'unlike', 'compared to', 'versus', 'vs',
      'while', 'whereas', 'however', 'but', 'although', 'though'
    ];
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      for (const keyword of differenceKeywords) {
        if (lowerLine.includes(keyword) && line.trim().length > 20) {
          differences.push(line.trim());
          break;
        }
      }
    }
    
    // Remove duplicates and limit to reasonable number
    return [...new Set(differences)].slice(0, 5);
  }

  /**
   * Extracts key sentences from content
   * 
   * @param parsed - Parsed markdown structure
   * @returns Array of key sentences
   */
  static extractKeysentencesFromContent(parsed: any): string[] {
    const sentences: string[] = [];
    
    // Extract from sections
    for (const section of parsed.sections || []) {
      const content = section.content.join(' ');
      const sectionSentences = content
        .split(/[.!?]+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 30 && s.length < 200);
      
      sentences.push(...sectionSentences.slice(0, 2)); // Max 2 sentences per section
    }
    
    // If no sections, extract from raw content
    if (sentences.length === 0 && parsed.raw) {
      const rawSentences = parsed.raw
        .split(/[.!?]+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 30 && s.length < 200);
      
      sentences.push(...rawSentences.slice(0, 5));
    }
    
    return sentences.slice(0, 8); // Limit total sentences
  }

  /**
   * Extracts related topics from parsed content
   * 
   * @param parsed - Parsed markdown structure
   * @returns Array of related topic strings
   */
  static extractRelatedTopics(parsed: any): string[] {
    const topics: Set<string> = new Set();
    
    // Extract from section titles
    for (const section of parsed.sections || []) {
      if (section.title && section.title.length > 3 && section.title.length < 50) {
        topics.add(section.title);
      }
    }
    
    // Extract key terms from content
    const keyTerms = this.extractKeyTermsFromContent(parsed);
    keyTerms.forEach((term: string) => topics.add(term));
    
    return Array.from(topics).slice(0, 10);
  }

  /**
   * Extracts key terms from content
   * 
   * @param parsed - Parsed markdown structure
   * @returns Array of key terms
   */
  static extractKeyTermsFromContent(parsed: any): string[] {
    const terms: Set<string> = new Set();
    const content = parsed.raw || '';
    
    // Look for technical terms (capitalized words, hyphenated terms, etc.)
    const technicalTerms = content.match(/\b[A-Z][a-z]+(?:-[A-Z][a-z]+)*\b/g) || [];
    technicalTerms.forEach((term: string) => {
      if (term.length > 3 && term.length < 25) {
        terms.add(term);
      }
    });
    
    // Look for quoted terms
    const quotedTerms = content.match(/"([^"]+)"/g) || [];
    quotedTerms.forEach((term: string) => {
      const cleaned = term.replace(/"/g, '');
      if (cleaned.length > 3 && cleaned.length < 25) {
        terms.add(cleaned);
      }
    });
    
    return Array.from(terms).slice(0, 15);
  }
}

/**
 * Content analysis utilities
 */
export class ContentAnalyzer {
  /**
   * Determines response length classification
   * 
   * @param content - Content to analyze
   * @returns Length classification
   */
  static determineResponseLength(content: string): 'brief' | 'detailed' | 'comprehensive' {
    const length = content.length;
    
    if (length < 500) return 'brief';
    if (length < 1500) return 'detailed';
    return 'comprehensive';
  }

  /**
   * Determines technical level of content
   * 
   * @param parsed - Parsed content structure
   * @returns Technical level classification
   */
  static determineTechnicalLevel(parsed: any): 'beginner' | 'intermediate' | 'advanced' {
    const content = parsed.raw || '';
    const lowerContent = content.toLowerCase();
    
    // Advanced technical terms
    const advancedTerms = [
      'molecular', 'polymer', 'elasticity', 'hysteresis', 'frequency response',
      'damping', 'resonance', 'material science', 'engineering', 'thermodynamics'
    ];
    
    // Intermediate technical terms
    const intermediateTerms = [
      'specification', 'measurement', 'force curve', 'travel distance',
      'actuation point', 'bottom out', 'spring weight', 'housing material',
      'tactile bump', 'pre-travel', 'post-travel'
    ];
    
    const advancedCount = advancedTerms.filter(term => lowerContent.includes(term)).length;
    const intermediateCount = intermediateTerms.filter(term => lowerContent.includes(term)).length;
    
    if (advancedCount >= 2) return 'advanced';
    if (intermediateCount >= 3) return 'intermediate';
    return 'beginner';
  }

  /**
   * Determines query type based on content analysis
   * 
   * @param markdown - Raw markdown content
   * @param parsed - Parsed content structure
   * @returns Query type classification
   */
  static determineQueryType(
    markdown: string, 
    parsed: any
  ): 'general_knowledge' | 'product_info' | 'troubleshooting' | 'recommendation' | 'educational' | 'other' {
    const lowerContent = markdown.toLowerCase();
    
    // Product information indicators
    if (lowerContent.includes('spec') || lowerContent.includes('specification') || 
        lowerContent.includes('technical details') || lowerContent.includes('features')) {
      return 'product_info';
    }
    
    // Recommendation indicators
    if (lowerContent.includes('recommend') || lowerContent.includes('best') || 
        lowerContent.includes('choice') || lowerContent.includes('should i')) {
      return 'recommendation';
    }
    
    // Troubleshooting indicators
    if (lowerContent.includes('problem') || lowerContent.includes('issue') || 
        lowerContent.includes('fix') || lowerContent.includes('troubleshoot')) {
      return 'troubleshooting';
    }
    
    // Educational indicators
    if (lowerContent.includes('how') || lowerContent.includes('why') || 
        lowerContent.includes('explain') || lowerContent.includes('what is')) {
      return 'educational';
    }
    
    // Default to general knowledge
    return 'general_knowledge';
  }

  /**
   * Categorizes characteristic based on title/content
   * 
   * @param title - Characteristic title
   * @returns Category classification
   */
  static categorizeCharacteristic(title: string): 'feel' | 'sound' | 'technical' | 'build_quality' | 'other' {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('feel') || lowerTitle.includes('tactile') || lowerTitle.includes('feedback')) {
      return 'feel';
    }
    if (lowerTitle.includes('sound') || lowerTitle.includes('audio') || lowerTitle.includes('acoustic')) {
      return 'sound';
    }
    if (lowerTitle.includes('spec') || lowerTitle.includes('force') || lowerTitle.includes('travel')) {
      return 'technical';
    }
    if (lowerTitle.includes('build') || lowerTitle.includes('quality') || lowerTitle.includes('durability')) {
      return 'build_quality';
    }
    
    return 'other';
  }

  /**
   * Checks if content has basic markdown structure
   * 
   * @param markdown - Markdown content to check
   * @returns Structure analysis
   */
  static checkBasicMarkdownStructure(markdown: string): {
    hasHeaders: boolean;
    hasTables: boolean;
    hasLists: boolean;
    estimatedSections: number;
  } {
    const hasHeaders = /^#{1,6}\s+.+$/m.test(markdown);
    const hasTables = /\|.*\|/.test(markdown);
    const hasLists = /^[\s]*[-*+]\s+.+$/m.test(markdown) || /^[\s]*\d+\.\s+.+$/m.test(markdown);
    const estimatedSections = (markdown.match(/^#{1,6}\s+.+$/gm) || []).length;

    return {
      hasHeaders,
      hasTables,
      hasLists,
      estimatedSections
    };
  }
} 