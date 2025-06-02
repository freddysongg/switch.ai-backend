/**
 * Markdown Utility Functions
 * 
 * Optional utility functions for parsing markdown elements like tables, lists, and headers.
 * These utilities complement the ResponseParserService and can be used independently.
 */

/**
 * Extract title from markdown content
 * Looks for the first H1 header as the main title
 */
export function extractTitle(markdown: string): string {
  const lines = markdown.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    const h1Match = trimmed.match(/^#\s+(.+)$/);
    if (h1Match) {
      return h1Match[1].trim();
    }
  }
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      return trimmed.substring(0, 100); 
    }
  }
  
  return 'Response';
}

/**
 * Count markdown elements in text
 */
export function countMarkdownElements(markdown: string): {
  headers: number;
  tables: number;
  lists: number;
  paragraphs: number;
  codeBlocks: number;
} {
  const lines = markdown.split('\n');
  let headers = 0;
  let tables = 0;
  let lists = 0;
  let paragraphs = 0;
  let codeBlocks = 0;
  let inCodeBlock = false;
  let inTable = false;
  let currentParagraph = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Code blocks
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (!inCodeBlock) codeBlocks++;
      continue;
    }
    
    if (inCodeBlock) continue;
    
    // Headers
    if (trimmed.match(/^#{1,6}\s/)) {
      headers++;
      if (currentParagraph.trim()) {
        paragraphs++;
        currentParagraph = '';
      }
      continue;
    }
    
    // Tables
    if (trimmed.includes('|') && !trimmed.match(/^[\s\|\-:]+$/)) {
      if (!inTable) {
        tables++;
        inTable = true;
      }
      continue;
    } else {
      inTable = false;
    }
    
    // Lists
    if (trimmed.match(/^[\*\-\+]\s/) || trimmed.match(/^\d+\.\s/)) {
      lists++;
      if (currentParagraph.trim()) {
        paragraphs++;
        currentParagraph = '';
      }
      continue;
    }
    
    // Regular content
    if (trimmed) {
      currentParagraph += trimmed + ' ';
    } else if (currentParagraph.trim()) {
      paragraphs++;
      currentParagraph = '';
    }
  }
  
  // Final paragraph
  if (currentParagraph.trim()) {
    paragraphs++;
  }
  
  return { headers, tables, lists, paragraphs, codeBlocks };
}

/**
 * Estimate reading time for markdown content
 */
export function estimateReadingTime(markdown: string): {
  minutes: number;
  seconds: number;
  totalSeconds: number;
} {
  const cleanText = markdown
    .replace(/#{1,6}\s+/g, '') 
    .replace(/\*\*([^*]+)\*\*/g, '$1') 
    .replace(/\*([^*]+)\*/g, '$1') 
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') 
    .replace(/`([^`]+)`/g, '$1') 
    .replace(/\|[^|\n]*\|/g, '') 
    .replace(/[\*\-\+]\s+/g, '') 
    .replace(/\d+\.\s+/g, ''); 
  
  const words = cleanText.split(/\s+/).filter(word => word.length > 0).length;
  const wordsPerMinute = 200; 
  
  const totalSeconds = Math.ceil((words / wordsPerMinute) * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return { minutes, seconds, totalSeconds };
}

/**
 * Normalize header levels (e.g., if document starts with H2, make it H1)
 */
export function normalizeHeaderLevels(markdown: string): string {
  const lines = markdown.split('\n');
  let minHeaderLevel = 7; 
  
  for (const line of lines) {
    const match = line.trim().match(/^(#{1,6})\s/);
    if (match) {
      minHeaderLevel = Math.min(minHeaderLevel, match[1].length);
    }
  }
  
  if (minHeaderLevel === 7 || minHeaderLevel === 1) {
    return markdown; 
  }
  
  const normalized = lines.map(line => {
    const match = line.trim().match(/^(#{1,6})(\s.+)$/);
    if (match) {
      const currentLevel = match[1].length;
      const newLevel = currentLevel - minHeaderLevel + 1;
      const newHeaders = '#'.repeat(Math.max(1, Math.min(6, newLevel)));
      return line.replace(match[1], newHeaders);
    }
    return line;
  });
  
  return normalized.join('\n');
}

/**
 * Extract summary/overview from markdown
 * Gets the first paragraph or section after the title
 */
export function extractSummary(markdown: string, maxLength: number = 500): string {
  const lines = markdown.split('\n');
  let foundFirstHeader = false;
  let summary = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed) continue;
    
    if (trimmed.match(/^#\s/) && !foundFirstHeader) {
      foundFirstHeader = true;
      continue;
    }
    
    if (trimmed.match(/^#{1,6}\s/) && foundFirstHeader) {
      break;
    }
    
    if (trimmed.includes('|') || trimmed.match(/^[\*\-\+]\s/) || trimmed.match(/^\d+\.\s/)) {
      continue;
    }
    
    if (foundFirstHeader) {
      summary += trimmed + ' ';
      
      if (summary.length >= maxLength) {
        break;
      }
    }
  }
  
  return summary.trim().substring(0, maxLength);
}

/**
 * Split markdown into logical chunks for processing
 */
export function chunkMarkdown(markdown: string, maxChunkSize: number = 2000): string[] {
  const lines = markdown.split('\n');
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (currentChunk.length + line.length > maxChunkSize && currentChunk.trim()) {
      if (trimmed.match(/^#{1,6}\s/)) {
        chunks.push(currentChunk.trim());
        currentChunk = line + '\n';
      } else {
        currentChunk += line + '\n';
      }
    } else {
      currentChunk += line + '\n';
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Validate markdown structure
 */
export function validateMarkdownStructure(markdown: string): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const lines = markdown.split('\n');
  
  let hasTitle = false;
  let hasContent = false;
  let tableCount = 0;
  let listCount = 0;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.match(/^#\s/)) {
      hasTitle = true;
    }
    
    if (trimmed && !trimmed.match(/^#{1,6}\s/) && !trimmed.includes('|') && !trimmed.match(/^[\*\-\+]\s/) && !trimmed.match(/^\d+\.\s/)) {
      hasContent = true;
    }
    
    if (trimmed.includes('|')) {
      tableCount++;
    }
    
    if (trimmed.match(/^[\*\-\+]\s/) || trimmed.match(/^\d+\.\s/)) {
      listCount++;
    }
  }
  
  if (!hasTitle) {
    issues.push('No main title (H1) found');
    suggestions.push('Add a main title using # Title');
  }
  
  if (!hasContent) {
    issues.push('No paragraph content found');
    suggestions.push('Add descriptive content between headers');
  }
  
  if (tableCount === 0 && listCount === 0) {
    suggestions.push('Consider adding tables or lists for better structure');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    suggestions
  };
} 