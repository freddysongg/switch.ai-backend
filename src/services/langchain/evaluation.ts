import { Client } from 'langsmith';
import { traceable } from 'langsmith/traceable';

import { getSecret, initializeSecrets } from '../../config/secrets.js';
import { DEFAULT_TEST_SUITES, TestCase, TestSuite } from '../testing.js';
import { createSwitchAIRAGChain, SwitchAIChainConfig, SwitchAIRAGChain } from './chain.js';

/**
 * Configuration for LangSmith evaluation
 */
const LANGSMITH_CONFIG = {
  projectName: 'SwitchAI-RAG-Evaluation',
  tracingEnabled: true
};

if (!process.env.LANGCHAIN_PROJECT) {
  process.env.LANGCHAIN_PROJECT = LANGSMITH_CONFIG.projectName;
}
if (!process.env.LANGCHAIN_TRACING_V2) {
  process.env.LANGCHAIN_TRACING_V2 = 'true';
}

/**
 * Interface for LangSmith dataset examples
 */
interface DatasetExample {
  inputs: {
    query: string;
    context?: any;
  };
  outputs?: {
    expectedIntent?: string;
    expectedEntities?: string[];
    expectedSections?: string[];
    minimumQualityScore?: number;
    mustIncludeTerms?: string[];
    mustNotIncludeTerms?: string[];
  };
  metadata?: {
    testCaseId: string;
    category: string;
    priority: string;
    tags?: string[];
    description: string;
  };
}

/**
 * Service for managing LangSmith evaluations and datasets
 *
 * Provides comprehensive functionality for creating, managing, and running
 * evaluations using LangSmith, including dataset creation from test suites,
 * filtered datasets, and evaluation execution.
 */
export class LangSmithEvaluationService {
  private client!: Client;
  private projectName: string;

  /**
   * Create a new LangSmith evaluation service instance
   *
   * Initializes the service with the configured project name for LangSmith integration.
   */
  constructor() {
    this.projectName = LANGSMITH_CONFIG.projectName;
  }

  /**
   * Initialize the service with proper secrets
   *
   * Sets up the LangSmith client with API credentials and validates configuration.
   * Must be called before using other service methods.
   *
   * @throws Error if LANGCHAIN_API_KEY is missing
   */
  async initialize(): Promise<void> {
    await initializeSecrets();

    const apiKey = getSecret('LANGCHAIN_API_KEY');
    if (!apiKey) {
      throw new Error('LANGCHAIN_API_KEY is missing from secrets manager');
    }

    this.client = new Client({
      apiKey
    });
  }

  /**
   * Convert a TestCase to a LangSmith DatasetExample
   *
   * Transforms our internal TestCase format into the format expected by
   * LangSmith for dataset creation, including inputs, outputs, and metadata.
   *
   * @param testCase - The test case to convert
   * @returns LangSmith-compatible DatasetExample object
   */
  private convertTestCaseToExample(testCase: TestCase): DatasetExample {
    return {
      inputs: {
        query: testCase.query,
        context: testCase.context
      },
      outputs: {
        expectedIntent: testCase.expectedIntent,
        expectedEntities: testCase.expectedEntities,
        expectedSections: testCase.expectedSections,
        minimumQualityScore: testCase.minimumQualityScore,
        mustIncludeTerms: testCase.mustIncludeTerms,
        mustNotIncludeTerms: testCase.mustNotIncludeTerms
      },
      metadata: {
        testCaseId: testCase.id,
        category: testCase.category,
        priority: testCase.priority,
        tags: testCase.tags,
        description: testCase.description
      }
    };
  }

  /**
   * Create a LangSmith dataset from a test suite
   */
  public createDatasetFromSuite = traceable(
    async (testSuite: TestSuite, datasetName?: string): Promise<string> => {
      const name = datasetName || `${testSuite.name.replace(/\s+/g, '-').toLowerCase()}-dataset`;

      console.log(`Creating LangSmith dataset: ${name}`);
      console.log(`Description: ${testSuite.description}`);
      console.log(`Test cases: ${testSuite.testCases.length}`);

      try {
        for await (const existing of this.client.listDatasets()) {
          if (existing.name === name) {
            console.log(
              `⚠️  Dataset "${name}" already exists. Reusing existing dataset (ID: ${existing.id}).`
            );
            return existing.id;
          }
        }

        const dataset = await this.client.createDataset(name, {
          description: `${testSuite.description}\n\nGenerated from test suite: ${testSuite.id}`,
          dataType: 'kv'
        });

        console.log(`Dataset created with ID: ${dataset.id}`);

        for (const testCase of testSuite.testCases) {
          const example = this.convertTestCaseToExample(testCase);
          await this.client.createExample(example.inputs, example.outputs || {}, {
            datasetId: dataset.id,
            metadata: example.metadata
          });
        }

        console.log(`Added ${testSuite.testCases.length} examples to dataset`);

        return dataset.id;
      } catch (error: any) {
        if (error?.status === 409 || /already exists/i.test(String(error))) {
          console.warn(
            `Dataset name conflict detected for "${name}". Attempting to retrieve existing dataset.`
          );
          for await (const existing of this.client.listDatasets()) {
            if (existing.name === name) {
              return existing.id;
            }
          }
        }

        console.error('Error creating dataset:', error);
        throw new Error(`Failed to create dataset: ${error}`);
      }
    },
    { name: 'LangSmithEvaluationService.createDatasetFromSuite' }
  );

  /**
   * Create datasets from all default test suites
   */
  public createAllDatasets = traceable(
    async (): Promise<Record<string, string>> => {
      console.log('Creating LangSmith datasets from all test suites...');

      const datasetIds: Record<string, string> = {};

      for (const testSuite of DEFAULT_TEST_SUITES) {
        try {
          const datasetId = await this.createDatasetFromSuite(testSuite);
          datasetIds[testSuite.id] = datasetId;
          console.log(`✅ Created dataset for suite: ${testSuite.id}`);
        } catch (error) {
          console.error(`❌ Failed to create dataset for suite: ${testSuite.id}`, error);
        }
      }

      return datasetIds;
    },
    { name: 'LangSmithEvaluationService.createAllDatasets' }
  );

  /**
   * Create a comprehensive evaluation dataset combining all test suites
   */
  public createComprehensiveDataset = traceable(
    async (datasetName: string = 'switchai-comprehensive-evaluation'): Promise<string> => {
      console.log('Creating comprehensive evaluation dataset...');

      const allTestCases: TestCase[] = [];
      for (const testSuite of DEFAULT_TEST_SUITES) {
        allTestCases.push(...testSuite.testCases);
      }

      const comprehensiveTestSuite: TestSuite = {
        id: 'comprehensive-evaluation',
        name: 'Comprehensive SwitchAI Evaluation',
        description: 'Complete evaluation dataset containing all test cases from all test suites',
        testCases: allTestCases
      };

      return await this.createDatasetFromSuite(comprehensiveTestSuite, datasetName);
    },
    { name: 'LangSmithEvaluationService.createComprehensiveDataset' }
  );

  /**
   * List existing datasets in the project
   *
   * Retrieves all datasets from the LangSmith project for inspection
   * and management purposes.
   *
   * @returns Promise resolving to array of dataset objects
   */
  public listDatasets = traceable(
    async (): Promise<any[]> => {
      try {
        const datasetsIterable = this.client.listDatasets();
        const datasets = [];
        for await (const dataset of datasetsIterable) {
          datasets.push(dataset);
        }
        return datasets;
      } catch (error) {
        console.error('Error listing datasets:', error);
        throw new Error(`Failed to list datasets: ${error}`);
      }
    },
    { name: 'LangSmithEvaluationService.listDatasets' }
  );

  /**
   * Delete a dataset by name or ID
   *
   * Permanently removes a dataset from the LangSmith project.
   * Use with caution as this operation cannot be undone.
   *
   * @param datasetId - The ID of the dataset to delete
   */
  public deleteDataset = traceable(
    async (datasetId: string): Promise<void> => {
      try {
        await this.client.deleteDataset({ datasetId });
        console.log(`Deleted dataset: ${datasetId}`);
      } catch (error) {
        console.error('Error deleting dataset:', error);
        throw new Error(`Failed to delete dataset: ${error}`);
      }
    },
    { name: 'LangSmithEvaluationService.deleteDataset' }
  );

  /**
   * Get detailed information about test suites available for evaluation
   *
   * Analyzes all available test suites and returns comprehensive statistics
   * including test case counts, categories, priorities, and tags.
   *
   * @returns Array of test suite statistics objects
   */
  getSuiteStats(): Array<{
    id: string;
    name: string;
    description: string;
    testCaseCount: number;
    categories: string[];
    priorities: string[];
    tags: string[];
  }> {
    return DEFAULT_TEST_SUITES.map((suite) => ({
      id: suite.id,
      name: suite.name,
      description: suite.description,
      testCaseCount: suite.testCases.length,
      categories: [...new Set(suite.testCases.map((tc) => tc.category))],
      priorities: [...new Set(suite.testCases.map((tc) => tc.priority))],
      tags: [...new Set(suite.testCases.flatMap((tc) => tc.tags || []))]
    }));
  }

  /**
   * Create filtered datasets based on criteria
   */
  public createFilteredDataset = traceable(
    async (
      filterCriteria: {
        categories?: string[];
        priorities?: string[];
        tags?: string[];
        testSuiteIds?: string[];
      },
      datasetName: string
    ): Promise<string> => {
      console.log('Creating filtered dataset with criteria:', filterCriteria);

      const filteredTestCases: TestCase[] = [];

      for (const testSuite of DEFAULT_TEST_SUITES) {
        if (filterCriteria.testSuiteIds && !filterCriteria.testSuiteIds.includes(testSuite.id)) {
          continue;
        }

        const suiteCases = testSuite.testCases.filter((testCase) => {
          if (filterCriteria.categories && !filterCriteria.categories.includes(testCase.category)) {
            return false;
          }

          if (filterCriteria.priorities && !filterCriteria.priorities.includes(testCase.priority)) {
            return false;
          }

          if (
            filterCriteria.tags &&
            (!testCase.tags || !testCase.tags.some((tag) => filterCriteria.tags!.includes(tag)))
          ) {
            return false;
          }

          return true;
        });

        filteredTestCases.push(...suiteCases);
      }

      if (filteredTestCases.length === 0) {
        throw new Error('No test cases match the specified filter criteria');
      }

      const filteredTestSuite: TestSuite = {
        id: 'filtered-evaluation',
        name: `Filtered SwitchAI Evaluation: ${datasetName}`,
        description: `Filtered evaluation dataset with criteria: ${JSON.stringify(filterCriteria)}`,
        testCases: filteredTestCases
      };

      console.log(`Creating dataset with ${filteredTestCases.length} filtered test cases`);
      return await this.createDatasetFromSuite(filteredTestSuite, datasetName);
    },
    { name: 'LangSmithEvaluationService.createFilteredDataset' }
  );
}

/**
 * Helper script functions for command line usage
 *
 * Provides high-level scripts for setting up evaluation datasets and running
 * common evaluation tasks from the command line or programmatically.
 */
export class EvaluationScripts {
  private service: LangSmithEvaluationService;

  /**
   * Create a new evaluation scripts instance
   *
   * Initializes the scripts with a new LangSmithEvaluationService instance.
   */
  constructor() {
    this.service = new LangSmithEvaluationService();
  }

  /**
   * Initialize the evaluation service
   *
   * Sets up the underlying LangSmith evaluation service with proper credentials.
   */
  async initialize(): Promise<void> {
    await this.service.initialize();
  }

  /**
   * Setup script: Create all evaluation datasets
   *
   * Creates comprehensive and individual test suite datasets in LangSmith,
   * displaying progress and statistics for each created dataset.
   */
  async setupEvaluationDatasets(): Promise<void> {
    console.log('🚀 Setting up LangSmith evaluation datasets...\n');

    await this.initialize();

    try {
      const stats = this.service.getSuiteStats();
      console.log('📊 Available test suites:');
      stats.forEach((stat) => {
        console.log(`  • ${stat.name} (${stat.testCaseCount} cases)`);
        console.log(`    Categories: ${stat.categories.join(', ')}`);
        console.log(`    Priorities: ${stat.priorities.join(', ')}`);
        if (stat.tags.length > 0) {
          console.log(`    Tags: ${stat.tags.join(', ')}`);
        }
        console.log('');
      });

      console.log('📦 Creating comprehensive evaluation dataset...');
      const comprehensiveId = await this.service.createComprehensiveDataset();
      console.log(`✅ Comprehensive dataset created: ${comprehensiveId}\n`);

      console.log('📦 Creating individual test suite datasets...');
      const datasetIds = await this.service.createAllDatasets();

      console.log('\n🎉 Evaluation datasets setup complete!');
      console.log('📋 Created datasets:');
      console.log(`  • Comprehensive: ${comprehensiveId}`);
      Object.entries(datasetIds).forEach(([suiteId, datasetId]) => {
        console.log(`  • ${suiteId}: ${datasetId}`);
      });
    } catch (error) {
      console.error('❌ Failed to setup evaluation datasets:', error);
      throw error;
    }
  }

  /**
   * Create a high-priority subset for quick evaluation
   *
   * Creates a filtered dataset containing only high-priority test cases
   * for faster evaluation cycles during development.
   */
  async createQuickEvaluationDataset(): Promise<void> {
    console.log('⚡ Creating quick evaluation dataset (high priority cases only)...\n');

    await this.initialize();

    try {
      const datasetId = await this.service.createFilteredDataset(
        { priorities: ['high'] },
        'switchai-quick-evaluation'
      );

      console.log(`✅ Quick evaluation dataset created: ${datasetId}`);
    } catch (error) {
      console.error('❌ Failed to create quick evaluation dataset:', error);
      throw error;
    }
  }

  /**
   * List all existing datasets
   */
  async listDatasets(): Promise<void> {
    console.log('📋 Listing existing LangSmith datasets...\n');

    await this.initialize();

    try {
      const datasets = await this.service.listDatasets();

      if (datasets.length === 0) {
        console.log('No datasets found.');
        return;
      }

      datasets.forEach((dataset, index) => {
        console.log(`${index + 1}. ${dataset.name}`);
        console.log(`   ID: ${dataset.id}`);
        console.log(`   Description: ${dataset.description || 'No description'}`);
        console.log(`   Created: ${dataset.createdAt}`);
        console.log('');
      });
    } catch (error) {
      console.error('❌ Failed to list datasets:', error);
      throw error;
    }
  }
}

export const evaluationService = new LangSmithEvaluationService();
export const evaluationScripts = new EvaluationScripts();

/**
 * Command-line script for creating LangSmith datasets from test cases
 *
 * Usage:
 *   node -r ts-node/register src/services/langchain/evaluation.ts setup
 *   node -r ts-node/register src/services/langchain/evaluation.ts quick
 *   node -r ts-node/register src/services/langchain/evaluation.ts list
 *   node -r ts-node/register src/services/langchain/evaluation.ts comprehensive
 *   node -r ts-node/register src/services/langchain/evaluation.ts filter --categories unit,integration --priorities high
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log('📋 Available commands:');
    console.log(
      '  setup       - Create all evaluation datasets (comprehensive + individual suites)'
    );
    console.log('  quick       - Create quick evaluation dataset (high priority cases only)');
    console.log('  list        - List all existing datasets');
    console.log('  comprehensive - Create only the comprehensive dataset');
    console.log('  filter      - Create filtered dataset with specific criteria');
    console.log('');
    console.log('Examples:');
    console.log('  npm run eval:setup');
    console.log('  npm run eval:quick');
    console.log('  npm run eval:list');
    console.log('  npm run eval:comprehensive');
    console.log('  npm run eval:filter -- --categories unit,integration --priorities high');
    return;
  }

  const scripts = new EvaluationScripts();

  try {
    switch (command) {
      case 'setup':
        console.log('🚀 Running full evaluation dataset setup...\n');
        await scripts.setupEvaluationDatasets();
        break;

      case 'quick':
        console.log('⚡ Creating quick evaluation dataset...\n');
        await scripts.createQuickEvaluationDataset();
        break;

      case 'list':
        console.log('📋 Listing existing datasets...\n');
        await scripts.listDatasets();
        break;

      case 'comprehensive':
        console.log('📦 Creating comprehensive dataset...\n');
        const service = new LangSmithEvaluationService();
        await service.initialize();
        const datasetId = await service.createComprehensiveDataset();
        console.log(`✅ Comprehensive dataset created: ${datasetId}`);
        break;

      case 'filter':
        console.log('🔍 Creating filtered dataset...\n');

        const filterCriteria: any = {};
        let datasetName = 'filtered-evaluation';

        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          const value = args[i + 1];

          switch (arg) {
            case '--categories':
              filterCriteria.categories = value ? value.split(',') : [];
              i++;
              break;
            case '--priorities':
              filterCriteria.priorities = value ? value.split(',') : [];
              i++;
              break;
            case '--tags':
              filterCriteria.tags = value ? value.split(',') : [];
              i++;
              break;
            case '--suites':
              filterCriteria.testSuiteIds = value ? value.split(',') : [];
              i++;
              break;
            case '--name':
              datasetName = value || 'filtered-evaluation';
              i++;
              break;
          }
        }

        if (Object.keys(filterCriteria).length === 0) {
          console.log(
            '❌ No filter criteria provided. Use --categories, --priorities, --tags, or --suites'
          );
          console.log(
            'Example: npm run eval:filter -- --categories unit,integration --priorities high'
          );
          return;
        }

        const filterService = new LangSmithEvaluationService();
        await filterService.initialize();
        const filteredDatasetId = await filterService.createFilteredDataset(
          filterCriteria,
          datasetName
        );
        console.log(`✅ Filtered dataset created: ${filteredDatasetId}`);
        break;

      default:
        console.log(`❌ Unknown command: ${command}`);
        console.log('Available commands: setup, quick, list, comprehensive, filter');
        process.exit(1);
    }

    console.log('\n🎉 Script completed successfully!');
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('evaluation.ts')) {
  main().catch(console.error);
}

export class EvaluationRunner {
  private evaluationService: LangSmithEvaluationService;
  private chain: SwitchAIRAGChain;

  constructor(chain?: SwitchAIRAGChain) {
    this.evaluationService = new LangSmithEvaluationService();
    this.chain = chain || createSwitchAIRAGChain();
  }

  /**
   * Initialize the evaluation runner
   */
  async initialize(): Promise<void> {
    await this.evaluationService.initialize();
  }

  /**
   * Evaluate the RAG chain against a specific dataset
   */
  public evaluateChainAgainstDataset = traceable(
    async (datasetName: string, evaluationName?: string): Promise<EvaluationResults> => {
      console.log(`🔍 Running evaluation: ${evaluationName || datasetName}`);
      console.log(`📊 Dataset: ${datasetName}`);

      const client = this.evaluationService['client'];
      const runResults: EvaluationRunResult[] = [];

      try {
        const examples = [];
        for await (const example of client.listExamples({ datasetName })) {
          examples.push(example);
        }

        console.log(`📝 Found ${examples.length} examples in dataset`);

        for (let i = 0; i < examples.length; i++) {
          const example = examples[i];
          console.log(`⚡ Processing example ${i + 1}/${examples.length}: ${example.id}`);

          try {
            const startTime = Date.now();

            // Extract query from inputs (handle LangSmith KVMap format)
            const query = (example.inputs as any).query || String(example.inputs);
            const context = (example.inputs as any).context;

            // Invoke our RAG chain
            const result = await this.chain.invoke({
              query: query,
              conversationHistory: context?.conversationHistory || [],
              requestId: `eval-${example.id}`
            });

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            const runResult: EvaluationRunResult = {
              exampleId: example.id,
              inputs: { query, context },
              prediction: result.response,
              outputs: example.outputs || {},
              metadata: {
                ...example.metadata,
                processingTimeMs: processingTime,
                retrievalCount: result.metadata.retrievalCount,
                hasHistory: result.metadata.hasHistory
              },
              performance: {
                processingTimeMs: processingTime,
                retrievalCount: result.metadata.retrievalCount
              }
            };

            // Calculate evaluation scores
            runResult.scores = await this.calculateScores(runResult);

            runResults.push(runResult);

            console.log(`✅ Example ${i + 1} completed (${processingTime}ms)`);
          } catch (error) {
            console.error(`❌ Error processing example ${example.id}:`, error);
            const errorQuery = (example.inputs as any).query || String(example.inputs);
            runResults.push({
              exampleId: example.id,
              inputs: { query: errorQuery, context: undefined },
              prediction: '',
              outputs: example.outputs || {},
              metadata: example.metadata || {},
              error: String(error),
              performance: { processingTimeMs: 0, retrievalCount: 0 },
              scores: {}
            });
          }
        }

        const results = this.calculateAggregateResults(runResults);

        console.log(`\n🎉 Evaluation completed!`);
        console.log(`📊 Results Summary:`);
        console.log(`  • Total examples: ${results.totalExamples}`);
        console.log(`  • Successful: ${results.successfulRuns}`);
        console.log(`  • Failed: ${results.failedRuns}`);
        console.log(`  • Average processing time: ${results.averageProcessingTime.toFixed(2)}ms`);
        console.log(`  • Average retrieval count: ${results.averageRetrievalCount.toFixed(1)}`);

        if (results.averageScores) {
          console.log(`  • Evaluation Scores:`);
          Object.entries(results.averageScores).forEach(([metric, score]) => {
            console.log(`    - ${metric}: ${typeof score === 'number' ? score.toFixed(3) : score}`);
          });
        }

        return results;
      } catch (error) {
        console.error('❌ Evaluation failed:', error);
        throw error;
      }
    },
    { name: 'EvaluationRunner.evaluateChainAgainstDataset' }
  );

  /**
   * Calculate evaluation scores for a single run result
   */
  private async calculateScores(
    runResult: EvaluationRunResult
  ): Promise<Record<string, number | string>> {
    const scores: Record<string, number | string> = {};

    // Basic completeness check
    scores.completeness = runResult.prediction.length > 0 ? 1.0 : 0.0;

    // Word count metric
    scores.responseLength = runResult.prediction.split(/\s+/).length;

    // Check for required terms (if specified)
    if (runResult.outputs.mustIncludeTerms?.length) {
      const includesRequired = runResult.outputs.mustIncludeTerms.every((term) =>
        runResult.prediction.toLowerCase().includes(term.toLowerCase())
      );
      scores.includesRequiredTerms = includesRequired ? 1.0 : 0.0;
    }

    // Check for prohibited terms (if specified)
    if (runResult.outputs.mustNotIncludeTerms?.length) {
      const excludesProhibited = !runResult.outputs.mustNotIncludeTerms.some((term) =>
        runResult.prediction.toLowerCase().includes(term.toLowerCase())
      );
      scores.excludesProhibitedTerms = excludesProhibited ? 1.0 : 0.0;
    }

    // Relevance check based on expected entities/sections
    if (runResult.outputs.expectedEntities?.length) {
      const mentionedEntities = runResult.outputs.expectedEntities.filter((entity) =>
        runResult.prediction.toLowerCase().includes(entity.toLowerCase())
      );
      scores.entityRelevance = mentionedEntities.length / runResult.outputs.expectedEntities.length;
    }

    // Performance metrics
    scores.retrievalEfficiency =
      runResult.performance.retrievalCount > 0
        ? Math.min(1.0, 5 / runResult.performance.retrievalCount)
        : 0.0;

    scores.responseSpeed =
      runResult.performance.processingTimeMs < 5000
        ? 1.0
        : Math.max(0.0, 1.0 - (runResult.performance.processingTimeMs - 5000) / 10000);

    // Overall quality score (simple average of available metrics)
    const qualityMetrics = [
      scores.completeness,
      scores.includesRequiredTerms,
      scores.excludesProhibitedTerms,
      scores.entityRelevance
    ].filter((score) => typeof score === 'number' && !isNaN(score)) as number[];

    if (qualityMetrics.length > 0) {
      scores.overallQuality =
        qualityMetrics.reduce((sum, score) => sum + score, 0) / qualityMetrics.length;
    }

    return scores;
  }

  /**
   * Calculate aggregate results from individual run results
   */
  private calculateAggregateResults(runResults: EvaluationRunResult[]): EvaluationResults {
    const successful = runResults.filter((r) => !r.error);
    const failed = runResults.filter((r) => r.error);

    const totalProcessingTime = successful.reduce(
      (sum, r) => sum + r.performance.processingTimeMs,
      0
    );
    const totalRetrievalCount = successful.reduce(
      (sum, r) => sum + r.performance.retrievalCount,
      0
    );

    // Calculate average scores
    const averageScores: Record<string, number> = {};
    if (successful.length > 0) {
      const allScoreKeys = new Set<string>();
      successful.forEach((r) =>
        Object.keys(r.scores || {}).forEach((key) => allScoreKeys.add(key))
      );

      allScoreKeys.forEach((scoreKey) => {
        const validScores = successful
          .map((r) => r.scores?.[scoreKey])
          .filter((score) => typeof score === 'number' && !isNaN(score)) as number[];

        if (validScores.length > 0) {
          averageScores[scoreKey] =
            validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
        }
      });
    }

    return {
      totalExamples: runResults.length,
      successfulRuns: successful.length,
      failedRuns: failed.length,
      averageProcessingTime: successful.length > 0 ? totalProcessingTime / successful.length : 0,
      averageRetrievalCount: successful.length > 0 ? totalRetrievalCount / successful.length : 0,
      averageScores: Object.keys(averageScores).length > 0 ? averageScores : undefined,
      runResults
    };
  }

  /**
   * Run evaluation on the comprehensive dataset
   */
  async runComprehensiveEvaluation(): Promise<EvaluationResults> {
    console.log('🚀 Running comprehensive evaluation...\n');
    return this.evaluateChainAgainstDataset(
      'switchai-comprehensive-evaluation',
      'comprehensive-rag-evaluation'
    );
  }

  /**
   * Run evaluation on the quick dataset (high priority cases only)
   */
  async runQuickEvaluation(): Promise<EvaluationResults> {
    console.log('⚡ Running quick evaluation...\n');
    return this.evaluateChainAgainstDataset('switchai-quick-evaluation', 'quick-rag-evaluation');
  }

  /**
   * Compare two chain configurations
   */
  async compareChainConfigurations(
    configA: SwitchAIChainConfig,
    configB: SwitchAIChainConfig,
    datasetName: string = 'switchai-quick-evaluation'
  ): Promise<ComparisonResults> {
    console.log('🔄 Running A/B comparison evaluation...\n');

    const chainA = createSwitchAIRAGChain(configA);
    const chainB = createSwitchAIRAGChain(configB);

    // Run evaluation on both configurations
    this.chain = chainA;
    const resultsA = await this.evaluateChainAgainstDataset(datasetName, 'config-a-evaluation');

    this.chain = chainB;
    const resultsB = await this.evaluateChainAgainstDataset(datasetName, 'config-b-evaluation');

    // Calculate comparison metrics
    const comparison = this.calculateComparison(resultsA, resultsB);

    console.log('\n📊 A/B Comparison Results:');
    console.log(
      `Configuration A - Overall Quality: ${resultsA.averageScores?.overallQuality?.toFixed(3) || 'N/A'}`
    );
    console.log(
      `Configuration B - Overall Quality: ${resultsB.averageScores?.overallQuality?.toFixed(3) || 'N/A'}`
    );
    console.log(`Winner: ${comparison.winner}`);
    console.log(`Quality Improvement: ${comparison.qualityImprovement.toFixed(3)}`);
    console.log(`Speed Improvement: ${comparison.speedImprovement.toFixed(3)}`);

    return comparison;
  }

  /**
   * Calculate comparison between two evaluation results
   */
  private calculateComparison(
    resultsA: EvaluationResults,
    resultsB: EvaluationResults
  ): ComparisonResults {
    const qualityA = resultsA.averageScores?.overallQuality || 0;
    const qualityB = resultsB.averageScores?.overallQuality || 0;
    const speedA = resultsA.averageProcessingTime;
    const speedB = resultsB.averageProcessingTime;

    const qualityImprovement = qualityB - qualityA;
    const speedImprovement = (speedA - speedB) / speedA; // Positive means B is faster

    let winner: 'A' | 'B' | 'Tie' = 'Tie';
    if (
      qualityImprovement > 0.05 ||
      (Math.abs(qualityImprovement) < 0.02 && speedImprovement > 0.1)
    ) {
      winner = 'B';
    } else if (
      qualityImprovement < -0.05 ||
      (Math.abs(qualityImprovement) < 0.02 && speedImprovement < -0.1)
    ) {
      winner = 'A';
    }

    return {
      configA: resultsA,
      configB: resultsB,
      winner,
      qualityImprovement,
      speedImprovement,
      summary: {
        qualityChange:
          qualityImprovement > 0.02 ? 'Better' : qualityImprovement < -0.02 ? 'Worse' : 'Similar',
        speedChange:
          speedImprovement > 0.1 ? 'Faster' : speedImprovement < -0.1 ? 'Slower' : 'Similar'
      }
    };
  }
}

/**
 * Interfaces for evaluation results
 */
export interface EvaluationRunResult {
  exampleId: string;
  inputs: {
    query: string;
    context?: any;
  };
  prediction: string;
  outputs: {
    expectedIntent?: string;
    expectedEntities?: string[];
    expectedSections?: string[];
    minimumQualityScore?: number;
    mustIncludeTerms?: string[];
    mustNotIncludeTerms?: string[];
  };
  metadata: any;
  error?: string;
  performance: {
    processingTimeMs: number;
    retrievalCount: number;
  };
  scores?: Record<string, number | string>;
}

export interface EvaluationResults {
  totalExamples: number;
  successfulRuns: number;
  failedRuns: number;
  averageProcessingTime: number;
  averageRetrievalCount: number;
  averageScores?: Record<string, number>;
  runResults: EvaluationRunResult[];
}

export interface ComparisonResults {
  configA: EvaluationResults;
  configB: EvaluationResults;
  winner: 'A' | 'B' | 'Tie';
  qualityImprovement: number;
  speedImprovement: number;
  summary: {
    qualityChange: 'Better' | 'Worse' | 'Similar';
    speedChange: 'Faster' | 'Slower' | 'Similar';
  };
}

export const evaluationRunner = new EvaluationRunner();

/**
 * Extended evaluation scripts with runner functionality
 */
export class ExtendedEvaluationScripts extends EvaluationScripts {
  private runner: EvaluationRunner;

  constructor() {
    super();
    this.runner = new EvaluationRunner();
  }

  async initialize(): Promise<void> {
    await super.initialize();
    await this.runner.initialize();
  }

  /**
   * Run a complete evaluation suite
   */
  async runFullEvaluationSuite(): Promise<void> {
    console.log('🚀 Running full evaluation suite...\n');

    try {
      // 1. Setup datasets
      console.log('📦 Step 1: Setting up evaluation datasets...');
      await this.setupEvaluationDatasets();

      // 2. Run comprehensive evaluation
      console.log('\n📊 Step 2: Running comprehensive evaluation...');
      const _comprehensiveResults = await this.runner.runComprehensiveEvaluation();

      // 3. Run quick evaluation
      console.log('\n⚡ Step 3: Running quick evaluation...');
      const _quickResults = await this.runner.runQuickEvaluation();

      // 4. A/B test different configurations
      console.log('\n🔄 Step 4: Running A/B comparison...');
      const _comparisonResults = await this.runner.compareChainConfigurations(
        { retriever: { k: 5 } },
        { retriever: { k: 10 } }
      );

      console.log('\n🎉 Full evaluation suite completed successfully!');
    } catch (error) {
      console.error('❌ Evaluation suite failed:', error);
      throw error;
    }
  }
}

/**
 * Command-line script extensions for evaluation running
 */
async function mainExtended() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log('📋 Available commands:');
    console.log('  setup       - Create all evaluation datasets');
    console.log('  quick       - Create quick evaluation dataset');
    console.log('  list        - List all existing datasets');
    console.log('  comprehensive - Create comprehensive dataset');
    console.log('  filter      - Create filtered dataset');
    console.log('  run-eval    - Run comprehensive evaluation');
    console.log('  run-quick   - Run quick evaluation');
    console.log('  run-full    - Run full evaluation suite');
    console.log('  ab-test     - Run A/B comparison test');
    return;
  }

  const scripts = new ExtendedEvaluationScripts();

  try {
    switch (command) {
      case 'run-eval':
        console.log('🚀 Running comprehensive evaluation...\n');
        await scripts.initialize();
        await evaluationRunner.initialize();
        await evaluationRunner.runComprehensiveEvaluation();
        break;

      case 'run-quick':
        console.log('⚡ Running quick evaluation...\n');
        await scripts.initialize();
        await evaluationRunner.initialize();
        await evaluationRunner.runQuickEvaluation();
        break;

      case 'run-full':
        console.log('🚀 Running full evaluation suite...\n');
        await scripts.runFullEvaluationSuite();
        break;

      case 'ab-test':
        console.log('🔄 Running A/B comparison test...\n');
        await scripts.initialize();
        await evaluationRunner.initialize();

        const configA = { retriever: { k: 5 } };
        const configB = { retriever: { k: 10 } };

        await evaluationRunner.compareChainConfigurations(configA, configB);
        break;

      default:
        return main();
    }

    console.log('\n🎉 Command completed successfully!');
  } catch (error) {
    console.error('❌ Command failed:', error);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('evaluation.ts')) {
  mainExtended().catch(console.error);
}
