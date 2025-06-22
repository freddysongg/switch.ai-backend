/**
 * LangChain Expression Language (LCEL) RAG Pipeline for SwitchAI
 *
 * This module defines the new RAG pipeline using LangChain Expression Language,
 * combining our custom SwitchAI retriever, prompt templates, and Google Gemini LLM
 * into a cohesive, traceable, and configurable chain.
 */

import { Document } from '@langchain/core/documents';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate, MessagesPlaceholder, PromptTemplate } from '@langchain/core/prompts';
import { RunnablePassthrough, RunnableSequence } from '@langchain/core/runnables';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { createHistoryAwareRetriever } from 'langchain/chains/history_aware_retriever';
import { traceable } from 'langsmith/traceable';

import { AI_CONFIG } from '../../config/ai.config.js';
import { secretsManager } from '../../config/secrets.js';
import { ChatMessage } from '../../types/chat.js';
import { DatabaseSanitizer } from '../../utils/databaseSanitizer.js';
import { PIIScrubber } from '../../utils/pii-scrubber.js';
import { SwitchAIRetriever, SwitchAIRetrieverConfig } from './wrappers.js';

/**
 * Custom implementation of Long Context Reorder functionality.
 * Reorders documents to mitigate the "lost in the middle" effect by placing
 * the most relevant documents at the beginning and end of the context.
 *
 * @param documents Array of documents in descending order of relevance
 * @returns Reordered documents with most relevant at extrema
 */
function longContextReorder(documents: Document[]): Document[] {
  if (documents.length <= 2) {
    return documents;
  }

  const reorderedDocs: Document[] = [];
  const docsCopy = [...documents];

  let placeAtStart = true;

  while (docsCopy.length > 0) {
    const doc = docsCopy.shift()!;

    if (placeAtStart) {
      reorderedDocs.unshift(doc);
    } else {
      reorderedDocs.push(doc);
    }

    placeAtStart = !placeAtStart;
  }

  return reorderedDocs;
}

/**
 * Configuration for the RAG Chain
 */
export interface SwitchAIChainConfig {
  /** Retriever configuration */
  retriever?: SwitchAIRetrieverConfig;
  /** LLM configuration */
  llm?: {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
  };
  /** Whether to include conversation history in prompts */
  includeHistory?: boolean;
  /** Maximum number of history turns to include */
  maxHistoryTurns?: number;
}

/**
 * Input interface for the RAG Chain
 */
export interface SwitchAIChainInput {
  /** The user's query */
  query: string;
  /** Optional conversation history */
  conversationHistory?: Pick<ChatMessage, 'role' | 'content'>[];
  /** Optional request ID for tracing */
  requestId?: string;
}

/**
 * Output interface for the RAG Chain
 */
export interface SwitchAIChainOutput {
  /** The generated response */
  response: string;
  /** Retrieved documents used for generation */
  retrievedDocuments: Document[];
  /** Metadata about the chain execution */
  metadata: {
    requestId?: string;
    retrievalCount: number;
    hasHistory: boolean;
    processingTimeMs: number;
  };
}

/**
 * Creates a prompt template for contextualizing queries based on chat history
 *
 * Generates a ChatPromptTemplate that reformulates user queries to be standalone
 * when they reference previous conversation context.
 *
 * @returns Configured ChatPromptTemplate for query contextualization
 */
function createQueryContextualizingPrompt(): ChatPromptTemplate {
  const systemMessage =
    'Given a chat history and the latest user question ' +
    'which might reference context in the chat history, ' +
    'formulate a standalone question which can be understood ' +
    'without the chat history. Do NOT answer the question, ' +
    'just reformulate it if needed and otherwise return it as is.';

  return ChatPromptTemplate.fromMessages([
    ['system', systemMessage],
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}']
  ]);
}

/**
 * Creates a comprehensive prompt template for RAG pipeline
 *
 * Builds the main prompt template using SwitchAI configuration components
 * for general knowledge queries about mechanical keyboard switches.
 *
 * @returns Configured PromptTemplate for general RAG queries
 */
function createSwitchAIPromptTemplate(): PromptTemplate {
  const template = `${AI_CONFIG.PROMPT_COMPONENTS.ROLE_DEFINITION}

${AI_CONFIG.PROMPT_COMPONENTS.CORE_TASK_DESCRIPTION}

### CONVERSATION_HISTORY (Recent Turns):
{history}

### RELEVANT_INFORMATION_FROM_KNOWLEDGE_BASE:
{context}

### CURRENT_USER_QUERY:
<user_query>{query}</user_query>

### OUTPUT_INSTRUCTIONS (Follow these for your response):
${AI_CONFIG.PROMPT_COMPONENTS.OUTPUT_FORMAT_INSTRUCTIONS}

### RESPONSE_QUALITIES_AND_CONSTRAINTS (Adhere to these):
${AI_CONFIG.PROMPT_COMPONENTS.OUTPUT_QUALITIES_LIST.map((constraint) => `- ${constraint}`).join('\n')}

### BEHAVIORAL_GUIDELINE (Overall approach):
${AI_CONFIG.PROMPT_COMPONENTS.BEHAVIORAL_GUIDELINE_FACTUALNESS}

### KNOWLEDGE_SCOPING_INSTRUCTION (Foundation, Not a Fortress):
When answering, use the provided database context as your primary source of truth. If the context is insufficient, you may use your general knowledge to fill in gaps, but you **must** state when you are doing so. For example, you could say, 'Based on the database, the switch has X characteristic. While not in the database, my general knowledge suggests that switches with these materials often have Y sound profile.'

### SECURITY_DIRECTIVE (CRITICAL - NON-NEGOTIABLE):
${AI_CONFIG.PROMPT_COMPONENTS.FINAL_SECURITY_INSTRUCTION}

Assistant's Response:`;

  return PromptTemplate.fromTemplate(template);
}

/**
 * Creates a comparison prompt template for structured switch comparisons
 *
 * Builds a specialized prompt template that generates structured markdown
 * comparisons with tables, analysis, and recommendations.
 *
 * @returns Configured PromptTemplate for comparison queries
 */
function createComparisonPromptTemplate(): PromptTemplate {
  const template = `You are **switch.ai**, an expert mechanical-keyboard switch analyst. Use the data provided from our database (and your general knowledge when needed) to craft a clear markdown comparison.

### Requirements
1. Respond in **markdown** – no JSON blocks.
2. Use the exact section headers below (level-2 \`##\`).
3. Provide a specification table inside the *Technical Specifications* section.

### Sections to include (all required)
## Overview
Give a high-level summary (1-2 paragraphs) of the key differences among the switches.

## Technical Specifications
Provide a markdown table with columns:
| Switch Name | Manufacturer | Type | Actuation Force | Bottom-Out Force | Pre-Travel | Total Travel | Top Housing | Bottom Housing | Stem | Spring | Mount |
Include one row per switch; use \`N/A\` if a data point is missing.

## Comparative Analysis
Discuss feel, sound, materials, and any notable performance or modding considerations in 2-4 paragraphs.

## Conclusion
Give a concise recommendation on when to choose each switch and who each is best suited for.

### Context
USER_QUERY: <user_query>{query}</user_query>
IDENTIFIED_SWITCHES: {switchNames}

SWITCH_DATA_BLOCKS:
{context}

CONVERSATION_HISTORY:
{history}`;

  return PromptTemplate.fromTemplate(template);
}

/**
 * Format conversation history for prompt inclusion
 *
 * Converts chat message history into a formatted string for use in prompts,
 * applying PII scrubbing and limiting to recent turns.
 *
 * @param history - Array of chat messages with role and content
 * @param maxTurns - Maximum number of conversation turns to include
 * @returns Formatted conversation history string
 */
function formatConversationHistory(
  history: Pick<ChatMessage, 'role' | 'content'>[] = [],
  maxTurns: number = AI_CONFIG.CHAT_HISTORY_MAX_TURNS
): string {
  if (history.length === 0) {
    return 'No previous conversation history for this session.';
  }

  const recentHistory = history.slice(-maxTurns * 2);
  const scrubbedHistory = PIIScrubber.scrubConversationHistory(recentHistory, true);

  return scrubbedHistory
    .map((msg) => {
      const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
      if (msg.role === 'user') {
        return `${roleLabel}: <user_query>${msg.content}</user_query>`;
      } else {
        return `${roleLabel}: ${msg.content}`;
      }
    })
    .join('\n');
}

/**
 * Format retrieved documents into context string
 *
 * Converts LangChain Documents into a formatted context string for LLM prompts,
 * applying database sanitization, PII scrubbing, and relevance scoring.
 *
 * @param documents - Array of retrieved Document objects
 * @returns Formatted context string for prompt inclusion
 */
function formatDocumentsContext(documents: Document[]): string {
  if (documents.length === 0) {
    return `${AI_CONFIG.PROMPT_COMPONENTS.CONTEXT_NO_KB_INFO_FOUND_MESSAGE}\n${AI_CONFIG.PROMPT_COMPONENTS.CONTEXT_NO_KB_INSTRUCTION_TO_LLM}`;
  }

  return documents
    .map((doc, index) => {
      const sanitizedContent = DatabaseSanitizer.sanitizeString(doc.pageContent);
      const piiScrubbedContent = PIIScrubber.quickScrub(sanitizedContent.sanitizedContent);

      if (sanitizedContent.wasModified) {
        DatabaseSanitizer.logSanitization('LANGCHAIN_DOCUMENT_CONTEXT', [sanitizedContent]);
      }

      let contextItem = `Context Item ${index + 1}:\n`;
      contextItem += piiScrubbedContent;

      // Add relevance score if available
      if (doc.metadata.confidence) {
        contextItem += `\n(Relevance Score: ${doc.metadata.confidence.toFixed(2)})`;
      }

      return contextItem;
    })
    .join('\n\n');
}

/**
 * Extract switch names from documents for comparison prompts
 *
 * Extracts and formats switch names from document metadata for use in
 * comparison prompt templates.
 *
 * @param documents - Array of documents to extract switch names from
 * @returns Formatted string containing switch names or fallback message
 */
function extractSwitchNames(documents: Document[]): string {
  const switchNames = documents
    .map((doc) => doc.metadata.switchName)
    .filter((name) => name)
    .join(', ');

  return switchNames ? `[${switchNames}]` : '[No specific switches identified]';
}

/**
 * Main RAG Chain class using LangChain Expression Language
 *
 * Provides a complete RAG pipeline implementation using LCEL that combines:
 * - History-aware query contextualization
 * - Hybrid semantic and keyword retrieval
 * - Document reordering to mitigate "lost in the middle" effect
 * - LLM generation with comprehensive prompt templates
 * - Full LangSmith tracing integration
 */
export class SwitchAIRAGChain {
  private chain: RunnableSequence;
  private comparisonChain: RunnableSequence;
  private retriever: SwitchAIRetriever;
  private historyAwareRetriever: any;
  private llm: ChatGoogleGenerativeAI;
  private config: Required<SwitchAIChainConfig>;

  /**
   * Create a new SwitchAI RAG Chain instance
   *
   * Initializes the complete RAG pipeline with configurable retriever settings,
   * LLM configuration, and conversation history options.
   *
   * @param config - Configuration options for the chain components
   */
  constructor(config: SwitchAIChainConfig = {}) {
    this.config = {
      retriever: {
        k: AI_CONFIG.RE_RANK_TOP_N,
        confidenceThreshold: AI_CONFIG.SIMILARITY_THRESHOLD,
        enableEmbeddingSearch: true,
        enableFuzzyMatching: true,
        enableLLMNormalization: true,
        rrfK: 60,
        ...config.retriever
      },
      llm: {
        model: AI_CONFIG.GEMINI_MODEL,
        temperature: 0.3,
        maxOutputTokens: AI_CONFIG.MAX_OUTPUT_TOKENS,
        ...config.llm
      },
      includeHistory: config.includeHistory ?? true,
      maxHistoryTurns: config.maxHistoryTurns ?? AI_CONFIG.CHAT_HISTORY_MAX_TURNS
    };

    this.retriever = new SwitchAIRetriever(this.config.retriever);
    const geminiApiKey = secretsManager.initialized
      ? secretsManager.getSecret('GEMINI_API_KEY')
      : process.env.GEMINI_API_KEY || '';
    this.llm = new ChatGoogleGenerativeAI({
      model: this.config.llm.model!,
      temperature: this.config.llm.temperature,
      maxOutputTokens: this.config.llm.maxOutputTokens,
      apiKey: geminiApiKey
    });

    // Initialize chains - history-aware retriever will be created lazily
    this.chain = this.createMainChain();
    this.comparisonChain = this.createComparisonChain();
  }

  /**
   * Create a history-aware retriever that can contextualize queries based on chat history
   *
   * Lazily creates a LangChain history-aware retriever that uses the LLM to
   * reformulate queries based on conversation context for better retrieval.
   *
   * @returns Promise resolving to configured history-aware retriever
   */
  private async getHistoryAwareRetriever() {
    if (!this.historyAwareRetriever) {
      const contextualizeQPrompt = createQueryContextualizingPrompt();

      this.historyAwareRetriever = await createHistoryAwareRetriever({
        llm: this.llm,
        retriever: this.retriever,
        rephrasePrompt: contextualizeQPrompt
      });
    }
    return this.historyAwareRetriever;
  }

  /**
   * Create the main RAG chain using LCEL with history-aware retrieval and document reordering
   *
   * Constructs the primary LCEL chain that handles general queries with:
   * - Conditional history-aware or standard retrieval
   * - Document reordering using long context optimization
   * - Comprehensive prompt formatting with context and history
   *
   * @returns Configured LCEL chain for general queries
   */
  private createMainChain(): RunnableSequence {
    const promptTemplate = createSwitchAIPromptTemplate();
    const outputParser = new StringOutputParser();

    return RunnableSequence.from([
      // First, use history-aware retrieval to get relevant documents
      {
        context: async (input: SwitchAIChainInput) => {
          if (!input.conversationHistory || input.conversationHistory.length === 0) {
            // No history – use regular retriever for simplicity (helps unit tests)
            const cleanedQuery = PIIScrubber.quickScrub(input.query);
            if (typeof (this.retriever as any).getRelevantDocuments === 'function') {
              return await (this.retriever as any).getRelevantDocuments(cleanedQuery);
            }
            return await (this.retriever as any).invoke(cleanedQuery);
          }

          const historyAwareRetriever = await this.getHistoryAwareRetriever();

          const chatHistory = input.conversationHistory.map((msg) => ({
            role: msg.role === 'user' ? 'human' : 'ai',
            content: msg.content
          }));

          return await historyAwareRetriever.invoke({
            input: PIIScrubber.quickScrub(input.query),
            chat_history: chatHistory
          });
        },
        query: (input: SwitchAIChainInput) => PIIScrubber.quickScrub(input.query),
        history: (input: SwitchAIChainInput) =>
          this.config.includeHistory && input.conversationHistory
            ? formatConversationHistory(input.conversationHistory, this.config.maxHistoryTurns)
            : 'No previous conversation history for this session.',
        originalInput: new RunnablePassthrough()
      },
      // Then, reorder documents to mitigate "lost in the middle" effect and format the context
      {
        context: (input: any) => {
          const reorderedDocs = longContextReorder(input.context);
          return formatDocumentsContext(reorderedDocs);
        },
        query: (input: any) => input.query,
        history: (input: any) => input.history,
        retrievedDocs: (input: any) => {
          const reorderedDocs = longContextReorder(input.context);
          return reorderedDocs;
        },
        originalInput: (input: any) => input.originalInput
      },
      // Generate the response
      {
        response: promptTemplate.pipe(this.llm).pipe(outputParser),
        retrievedDocs: (input: any) => input.retrievedDocs,
        originalInput: (input: any) => input.originalInput
      }
    ]);
  }

  /**
   * Create the comparison chain for structured switch comparisons with history-aware retrieval and document reordering
   *
   * Constructs a specialized LCEL chain for switch comparison queries that:
   * - Uses history-aware retrieval for contextual comparisons
   * - Applies document reordering for optimal context placement
   * - Formats output using structured comparison prompt templates
   *
   * @returns Configured LCEL chain for comparison queries
   */
  private createComparisonChain(): RunnableSequence {
    const comparisonTemplate = createComparisonPromptTemplate();
    const outputParser = new StringOutputParser();

    return RunnableSequence.from([
      // Use history-aware retrieval for comparison queries
      {
        context: async (input: SwitchAIChainInput) => {
          if (!input.conversationHistory || input.conversationHistory.length === 0) {
            const cleanedQuery = PIIScrubber.quickScrub(input.query);
            if (typeof (this.retriever as any).getRelevantDocuments === 'function') {
              return await (this.retriever as any).getRelevantDocuments(cleanedQuery);
            }
            return await (this.retriever as any).invoke(cleanedQuery);
          }

          const historyAwareRetriever = await this.getHistoryAwareRetriever();

          const chatHistory = input.conversationHistory.map((msg) => ({
            role: msg.role === 'user' ? 'human' : 'ai',
            content: msg.content
          }));

          return await historyAwareRetriever.invoke({
            input: PIIScrubber.quickScrub(input.query),
            chat_history: chatHistory
          });
        },
        query: (input: SwitchAIChainInput) => PIIScrubber.quickScrub(input.query),
        history: (input: SwitchAIChainInput) =>
          this.config.includeHistory && input.conversationHistory
            ? formatConversationHistory(input.conversationHistory, this.config.maxHistoryTurns)
            : 'No previous conversation history.',
        originalInput: new RunnablePassthrough()
      },
      // Reorder documents and format for comparison prompt
      {
        context: (input: any) => {
          const reorderedDocs = longContextReorder(input.context);
          return formatDocumentsContext(reorderedDocs);
        },
        query: (input: any) => input.query,
        history: (input: any) => input.history,
        switchNames: (input: any) => {
          const reorderedDocs = longContextReorder(input.context);
          return extractSwitchNames(reorderedDocs);
        },
        retrievedDocs: (input: any) => {
          const reorderedDocs = longContextReorder(input.context);
          return reorderedDocs;
        },
        originalInput: (input: any) => input.originalInput
      },
      // Generate structured comparison
      {
        response: comparisonTemplate.pipe(this.llm).pipe(outputParser),
        retrievedDocs: (input: any) => input.retrievedDocs,
        originalInput: (input: any) => input.originalInput
      }
    ]);
  }

  /**
   * Invoke the main RAG chain
   *
   * Executes the primary RAG pipeline for general queries, handling retrieval,
   * context formatting, and response generation with full error handling.
   *
   * @param input - Chain input containing query, optional history, and request ID
   * @returns Promise resolving to complete chain output with response and metadata
   */
  public invoke = traceable(
    async (input: SwitchAIChainInput): Promise<SwitchAIChainOutput> => {
      const startTime = Date.now();

      try {
        const result = await this.chain.invoke(input);

        const processingTimeMs = Date.now() - startTime;

        return {
          response: result.response,
          retrievedDocuments: result.retrievedDocs,
          metadata: {
            requestId: input.requestId,
            retrievalCount: result.retrievedDocs.length,
            hasHistory: Boolean(input.conversationHistory?.length),
            processingTimeMs
          }
        };
      } catch (error) {
        console.error('Error in SwitchAI RAG chain execution:', error);

        return {
          response: AI_CONFIG.FALLBACK_ERROR_MESSAGE_LLM,
          retrievedDocuments: [],
          metadata: {
            requestId: input.requestId,
            retrievalCount: 0,
            hasHistory: Boolean(input.conversationHistory?.length),
            processingTimeMs: Date.now() - startTime
          }
        };
      }
    },
    { name: 'SwitchAIRAGChain.invoke' }
  );

  /**
   * Invoke the comparison chain for structured switch comparisons
   *
   * Executes the specialized comparison pipeline for switch comparison queries,
   * using structured prompt templates and comparison-specific formatting.
   *
   * @param input - Chain input containing comparison query and optional history
   * @returns Promise resolving to comparison output with structured response
   */
  public invokeComparison = traceable(
    async (input: SwitchAIChainInput): Promise<SwitchAIChainOutput> => {
      const startTime = Date.now();

      try {
        const result = await this.comparisonChain.invoke(input);

        const processingTimeMs = Date.now() - startTime;

        return {
          response: result.response,
          retrievedDocuments: result.retrievedDocs,
          metadata: {
            requestId: input.requestId,
            retrievalCount: result.retrievedDocs.length,
            hasHistory: Boolean(input.conversationHistory?.length),
            processingTimeMs
          }
        };
      } catch (error) {
        console.error('Error in SwitchAI comparison chain execution:', error);

        return {
          response: JSON.stringify({
            comparisonTable: { headers: [], rows: [] },
            summary:
              'I apologize, but I encountered an error while generating the comparison. Please try again.',
            recommendations: []
          }),
          retrievedDocuments: [],
          metadata: {
            requestId: input.requestId,
            retrievalCount: 0,
            hasHistory: Boolean(input.conversationHistory?.length),
            processingTimeMs: Date.now() - startTime
          }
        };
      }
    },
    { name: 'SwitchAIRAGChain.invokeComparison' }
  );

  /**
   * Get the current configuration
   *
   * Returns a copy of the current chain configuration including retriever,
   * LLM, and history settings.
   *
   * @returns Complete chain configuration object
   */
  getConfig(): Required<SwitchAIChainConfig> {
    return { ...this.config };
  }

  /**
   * Update retriever configuration
   *
   * Updates the retriever configuration and rebuilds the chains to use the
   * new settings. Useful for runtime optimization and A/B testing.
   *
   * @param config - Partial retriever configuration to merge with current settings
   */
  updateRetrieverConfig(config: Partial<SwitchAIRetrieverConfig>): void {
    this.config.retriever = { ...this.config.retriever, ...config };
    this.retriever = new SwitchAIRetriever(this.config.retriever);

    // Rebuild chains with new retriever
    this.chain = this.createMainChain();
    this.comparisonChain = this.createComparisonChain();
  }
}

/**
 * Factory function to create a configured SwitchAI RAG chain
 *
 * Convenience function for creating a new SwitchAIRAGChain instance with
 * the specified configuration options.
 *
 * @param config - Configuration options for the chain
 * @returns A new SwitchAIRAGChain instance
 */
export function createSwitchAIRAGChain(config: SwitchAIChainConfig = {}): SwitchAIRAGChain {
  return new SwitchAIRAGChain(config);
}

/**
 * Utility function to determine if a query is requesting a comparison
 *
 * Analyzes the query text to determine if it contains comparison keywords
 * and patterns that indicate the user wants a structured comparison.
 *
 * @param query - The user's query text to analyze
 * @returns True if the query appears to be requesting a comparison
 */
export function isComparisonQuery(query: string): boolean {
  const comparisonKeywords = [
    'compare',
    'comparison',
    'versus',
    'vs',
    'difference',
    'differences',
    'better',
    'which',
    'between',
    'against',
    'table'
  ];

  const lowerQuery = query.toLowerCase();
  return comparisonKeywords.some((keyword) => {
    if (keyword === 'which') {
      return (
        lowerQuery.includes(' which ') &&
        (lowerQuery.includes(' vs ') ||
          lowerQuery.includes(' versus ') ||
          lowerQuery.includes('Difference between'.toLowerCase()))
      );
    }
    return lowerQuery.includes(keyword);
  });
}
