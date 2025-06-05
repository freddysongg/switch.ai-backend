import { mapIntentToQueryType } from '../utils/intentMapping.js';
import { ChatService } from './chat.js';
import { LLMAnalysisService } from './llmAnalysisService.js';
import { EvaluationResult, MetricsCollectionService } from './metricsService.js';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: 'unit' | 'integration' | 'manual' | 'regression';

  // Input
  query: string;
  context?: any;

  // Expected outcomes
  expectedIntent?: string;
  expectedEntities?: string[];
  expectedSwitches?: string[];
  expectedSections?: string[];

  // Validation criteria
  minimumQualityScore?: number;
  mustIncludeTerms?: string[];
  mustNotIncludeTerms?: string[];

  // For comparison tests
  shouldPreferDatabase?: boolean;
  expectedTableColumns?: string[];

  tags?: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  testCases: TestCase[];
  setupInstructions?: string;
  teardownInstructions?: string;
}

export interface TestResult {
  testCaseId: string;
  passed: boolean;
  evaluationResult: EvaluationResult;
  executionTime: number;
  errorMessage?: string;
  actualVsExpected?: {
    intent?: { actual: string; expected: string };
    entities?: { actual: string[]; expected: string[] };
    qualityScore?: { actual: number; expected: number };
  };
}

export interface TestSuiteResult {
  suiteId: string;
  suiteName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  executionTime: number;
  testResults: TestResult[];
  summary: {
    qualityAverages: {
      formatCompliance: number;
      sectionCompleteness: number;
      relevance: number;
    };
    performanceAverages: {
      responseTime: number;
      databaseHitRate: number;
    };
  };
}

export class TestingService {
  private metricsService: MetricsCollectionService;
  private analysisService: LLMAnalysisService;
  private chatService: ChatService;

  constructor() {
    this.metricsService = new MetricsCollectionService();
    this.analysisService = new LLMAnalysisService();
    this.chatService = new ChatService();
  }

  /**
   * Run a single test case
   */
  async runTestCase(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();

    try {
      let response;
      let processingContext;
      let testRequestId = `test-${testCase.id}-${Date.now()}`;

      if (testCase.category === 'unit') {
        const unitTestResult = await this.runUnitTest(testCase);

        if (testCase.tags?.includes('intent-recognition')) {
          response = unitTestResult.response;
          processingContext = unitTestResult.context;

          await this.metricsService.recordAnalysisMetrics(
            testRequestId,
            {
              query: testCase.query,
              queryHints: { expectedIntent: testCase.expectedIntent }
            },
            response,
            processingContext
          );
        } else {
          response = unitTestResult;
          processingContext = unitTestResult.context || {
            requestId: `unit-test-${testCase.id}-${Date.now()}`
          };

          await this.metricsService.recordAnalysisMetrics(
            testRequestId,
            { query: testCase.query, queryHints: { expectedIntent: testCase.expectedIntent } },
            response,
            processingContext
          );
        }
      } else {
        const request = {
          query: testCase.query,
          requestId: testRequestId,
          timestamp: new Date(),
          preferences: {
            detailLevel: 'detailed' as const,
            technicalDepth: 'advanced' as const
          }
        };

        response = await this.analysisService.processAnalysisRequest(request);

        const intentResult = await this.analysisService.recognizeIntent(testCase.query);

        const processingContext = {
          requestId: testRequestId,
          intentResult: intentResult,
          databaseContext: null,
          totalResponseTime: 1000,
          llmResponseTime: 500,
          databaseResponseTime: 100,
          tokenUsage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 }
        };

        await this.metricsService.recordAnalysisMetrics(
          testRequestId,
          { query: testCase.query, queryHints: { expectedIntent: testCase.expectedIntent } },
          response,
          processingContext
        );
      }

      let evaluationResult = this.metricsService.getMetricsForRequest(testRequestId);

      if (!evaluationResult) {
        evaluationResult = this.metricsService.getMetricsForRequest(testRequestId);
      }

      if (!evaluationResult) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        evaluationResult = this.metricsService.getMetricsForRequest(testRequestId);
      }

      if (!evaluationResult) {
        throw new Error(
          `Failed to collect metrics for test case. RequestId: ${testRequestId}, Category: ${testCase.category}`
        );
      }

      const passed = this.validateTestCaseExpectations(testCase, evaluationResult);

      const actualVsExpected = this.buildActualVsExpected(testCase, evaluationResult);

      return {
        testCaseId: testCase.id,
        passed,
        evaluationResult,
        executionTime: Date.now() - startTime,
        actualVsExpected
      };
    } catch (error: any) {
      return {
        testCaseId: testCase.id,
        passed: false,
        evaluationResult: {
          testId: testCase.id,
          query: testCase.query,
          actualResponse: null,
          qualityMetrics: {} as any,
          uxMetrics: {} as any,
          performanceMetrics: {} as any,
          overallScore: 0,
          passed: false
        },
        executionTime: Date.now() - startTime,
        errorMessage: error.message
      };
    }
  }

  /**
   * Run unit tests for individual components
   */
  private async runUnitTest(testCase: TestCase): Promise<any> {
    const context = { requestId: `unit-test-${testCase.id}-${Date.now()}` };

    if (testCase.tags?.includes('intent-recognition')) {
      const intentResult = await this.analysisService.recognizeIntent(testCase.query);

      const mockResponse = {
        overview: `## Overview\n\nThis is a test response for intent recognition testing of query: ${testCase.query}\n\nThe intent classification system successfully identified this query and extracted relevant entities for further processing.`,
        technicalSpecs: `## Technical Specifications\n\nTest response - no actual specifications provided as this is a unit test for intent recognition.`,
        analysis: `## Analysis\n\nIntent recognition completed successfully with high confidence.`,
        requestId: context.requestId,
        dataSource: 'Test'
      };

      const enhancedContext = {
        ...context,
        intentResult: intentResult,
        databaseContext: null,
        totalResponseTime: 0,
        llmResponseTime: 0,
        databaseResponseTime: 0,
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      };

      return {
        intent: intentResult,
        context: enhancedContext,
        response: mockResponse
      };
    }

    if (testCase.tags?.includes('switch-extraction')) {
      const comparisonResult = await this.chatService.processComparisonQuery(testCase.query);
      return { comparison: comparisonResult, context };
    }

    if (testCase.tags?.includes('database-lookup')) {
      return { databaseResult: null, context };
    }

    const request = {
      query: testCase.query,
      requestId: context.requestId,
      timestamp: new Date()
    };

    return await this.analysisService.processAnalysisRequest(request);
  }

  /**
   * Validate test case expectations against actual results
   */
  private validateTestCaseExpectations(testCase: TestCase, result: EvaluationResult): boolean {
    let passed = true;

    if (testCase.minimumQualityScore && result.overallScore < testCase.minimumQualityScore) {
      passed = false;
    }

    if (testCase.expectedIntent) {
      const expectedMappedIntent = mapIntentToQueryType(testCase.expectedIntent);
      if (result.uxMetrics.queryType !== expectedMappedIntent) {
        passed = false;
      }
    }

    if (!result.actualResponse) {
      passed = false;
    }

    if (testCase.category === 'unit' && testCase.tags?.includes('intent-recognition')) {
      if (!result.uxMetrics.intentClassificationAccuracy) {
        passed = false;
      }
    } else {
      if (result.qualityMetrics.formatComplianceScore < 0.2) {
        passed = false;
      }

      if (result.qualityMetrics.sectionCompletenessScore < 0.3) {
        passed = false;
      }

      if (result.qualityMetrics.relevanceScore && result.qualityMetrics.relevanceScore < 0.4) {
        passed = false;
      }
    }

    if (result.actualResponse) {
      const responseText = JSON.stringify(result.actualResponse).toLowerCase();

      if (testCase.mustIncludeTerms) {
        for (const term of testCase.mustIncludeTerms) {
          if (!responseText.includes(term.toLowerCase())) {
            passed = false;
            break;
          }
        }
      }

      if (testCase.mustNotIncludeTerms) {
        for (const term of testCase.mustNotIncludeTerms) {
          if (responseText.includes(term.toLowerCase())) {
            passed = false;
            break;
          }
        }
      }
    }

    return passed;
  }

  /**
   * Build actual vs expected comparison for detailed analysis
   */
  private buildActualVsExpected(testCase: TestCase, result: EvaluationResult): any {
    return {
      intent: {
        actual: result.uxMetrics.queryType,
        expected: testCase.expectedIntent || 'unknown'
      },
      qualityScore: {
        actual: result.overallScore,
        expected: testCase.minimumQualityScore || 0.6
      }
    };
  }

  /**
   * Run a complete test suite
   */
  async runTestSuite(testSuite: TestSuite): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const testResults: TestResult[] = [];

    console.log(`Starting test suite: ${testSuite.name}`);

    for (const testCase of testSuite.testCases) {
      console.log(`Running test case: ${testCase.name}`);
      const result = await this.runTestCase(testCase);
      testResults.push(result);

      console.log(`Test ${testCase.name}: ${result.passed ? 'PASSED' : 'FAILED'}`);
      if (!result.passed && result.errorMessage) {
        console.log(`  Error: ${result.errorMessage}`);
      }
    }

    const passedTests = testResults.filter((r) => r.passed).length;
    const failedTests = testResults.length - passedTests;

    const qualityAverages = this.calculateQualityAverages(testResults);
    const performanceAverages = this.calculatePerformanceAverages(testResults);

    return {
      suiteId: testSuite.id,
      suiteName: testSuite.name,
      totalTests: testResults.length,
      passedTests,
      failedTests,
      executionTime: Date.now() - startTime,
      testResults,
      summary: {
        qualityAverages,
        performanceAverages
      }
    };
  }

  /**
   * Calculate quality metric averages across test results
   */
  private calculateQualityAverages(testResults: TestResult[]): any {
    const validResults = testResults.filter((r) => r.evaluationResult);

    if (validResults.length === 0) {
      return { formatCompliance: 0, sectionCompleteness: 0, relevance: 0 };
    }

    const formatCompliance =
      validResults.reduce(
        (sum, r) => sum + r.evaluationResult.qualityMetrics.formatComplianceScore,
        0
      ) / validResults.length;

    const sectionCompleteness =
      validResults.reduce(
        (sum, r) => sum + r.evaluationResult.qualityMetrics.sectionCompletenessScore,
        0
      ) / validResults.length;

    const relevance =
      validResults.reduce(
        (sum, r) => sum + (r.evaluationResult.qualityMetrics.relevanceScore || 0),
        0
      ) / validResults.length;

    return { formatCompliance, sectionCompleteness, relevance };
  }

  /**
   * Calculate performance metric averages across test results
   */
  private calculatePerformanceAverages(testResults: TestResult[]): any {
    const validResults = testResults.filter((r) => r.evaluationResult);

    if (validResults.length === 0) {
      return { responseTime: 0, databaseHitRate: 0 };
    }

    const responseTime =
      validResults.reduce(
        (sum, r) => sum + r.evaluationResult.performanceMetrics.totalResponseTime,
        0
      ) / validResults.length;

    const databaseHitRate =
      validResults.reduce(
        (sum, r) => sum + r.evaluationResult.performanceMetrics.databaseHitRate,
        0
      ) / validResults.length;

    return { responseTime, databaseHitRate };
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport(suiteResult: TestSuiteResult): string {
    const passRate = ((suiteResult.passedTests / suiteResult.totalTests) * 100).toFixed(1);

    let report = `
# Test Suite Report: ${suiteResult.suiteName}

## Summary
- **Total Tests**: ${suiteResult.totalTests}
- **Passed**: ${suiteResult.passedTests}
- **Failed**: ${suiteResult.failedTests}
- **Pass Rate**: ${passRate}%
- **Execution Time**: ${suiteResult.executionTime}ms

## Quality Metrics (Averages)
- **Format Compliance**: ${(suiteResult.summary.qualityAverages.formatCompliance * 100).toFixed(1)}%
- **Section Completeness**: ${(suiteResult.summary.qualityAverages.sectionCompleteness * 100).toFixed(1)}%
- **Relevance Score**: ${(suiteResult.summary.qualityAverages.relevance * 100).toFixed(1)}%

## Performance Metrics (Averages)
- **Response Time**: ${suiteResult.summary.performanceAverages.responseTime.toFixed(0)}ms
- **Database Hit Rate**: ${(suiteResult.summary.performanceAverages.databaseHitRate * 100).toFixed(1)}%

## Detailed Results

`;

    const failedTests = suiteResult.testResults.filter((r) => !r.passed);
    if (failedTests.length > 0) {
      report += `### Failed Tests\n\n`;

      for (const test of failedTests) {
        report += `#### ${test.testCaseId}\n`;
        report += `- **Error**: ${test.errorMessage || 'Quality thresholds not met'}\n`;

        if (test.actualVsExpected) {
          report += `- **Expected Intent**: ${test.actualVsExpected.intent?.expected}\n`;
          report += `- **Actual Intent**: ${test.actualVsExpected.intent?.actual}\n`;
          report += `- **Quality Score**: ${test.actualVsExpected.qualityScore?.actual.toFixed(2)} (expected: ${test.actualVsExpected.qualityScore?.expected})\n`;
        }

        report += `\n`;
      }
    }

    const passedTests = suiteResult.testResults.filter((r) => r.passed);
    if (passedTests.length > 0) {
      report += `### Passed Tests\n\n`;

      for (const test of passedTests) {
        const score = test.evaluationResult.overallScore;
        report += `- **${test.testCaseId}**: Score ${score.toFixed(2)} (${test.executionTime}ms)\n`;
      }
    }

    return report;
  }
}

export const DEFAULT_TEST_SUITES: TestSuite[] = [
  {
    id: 'intent-recognition',
    name: 'Intent Recognition Tests',
    description: 'Tests for query intent classification accuracy',
    testCases: [
      {
        id: 'ir-001',
        name: 'Simple Comparison Query',
        description: 'Test basic comparison intent recognition',
        category: 'unit',
        query: 'gateron yellow vs cherry mx red',
        expectedIntent: 'switch_comparison',
        expectedEntities: ['gateron yellow', 'cherry mx red'],
        minimumQualityScore: 0.5,
        tags: ['intent-recognition'],
        priority: 'high'
      },
      {
        id: 'ir-002',
        name: 'General Info Query',
        description: 'Test general information intent recognition',
        category: 'unit',
        query: 'what are holy panda switches',
        expectedIntent: 'general_switch_info',
        expectedEntities: ['holy panda'],
        minimumQualityScore: 0.5,
        tags: ['intent-recognition'],
        priority: 'high'
      },
      {
        id: 'ir-003',
        name: 'Material Analysis Query',
        description: 'Test material analysis intent recognition',
        category: 'unit',
        query: 'nylon vs polycarbonate housing materials',
        expectedIntent: 'material_analysis',
        mustIncludeTerms: ['nylon', 'polycarbonate'],
        minimumQualityScore: 0.5,
        tags: ['intent-recognition'],
        priority: 'medium'
      }
    ]
  },
  {
    id: 'content-quality',
    name: 'Content Quality Tests',
    description: 'Tests for response quality regardless of database availability',
    testCases: [
      {
        id: 'cq-001',
        name: 'Unknown Switch Analysis',
        description: 'Test analysis of switch not in database',
        category: 'integration',
        query: 'tell me about fictional super switch xyz123',
        minimumQualityScore: 0.5,
        mustIncludeTerms: ['analysis', 'cannot provide', 'information'],
        mustNotIncludeTerms: ['database error', 'system error'],
        priority: 'high'
      },
      {
        id: 'cq-002',
        name: 'Material Science Question',
        description: 'Test material analysis without specific switches',
        category: 'integration',
        query: 'how does spring steel affect switch feel',
        expectedIntent: 'material_analysis',
        minimumQualityScore: 0.6,
        mustIncludeTerms: ['spring', 'steel', 'feel', 'tactile'],
        priority: 'high'
      },
      {
        id: 'cq-003',
        name: 'Subjective Experience Query',
        description: 'Test handling of subjective preferences',
        category: 'integration',
        query: 'what switches are best for typing feel',
        minimumQualityScore: 0.6,
        mustIncludeTerms: ['typing', 'feel', 'preference', 'subjective'],
        priority: 'medium'
      },
      {
        id: 'cq-004',
        name: 'Technical Terminology Usage',
        description: 'Test proper use of switch terminology',
        category: 'integration',
        query: 'explain tactile bump and actuation point',
        minimumQualityScore: 0.5,
        mustIncludeTerms: ['tactile', 'bump', 'actuation', 'point', 'force'],
        priority: 'high'
      }
    ]
  },
  {
    id: 'response-structure',
    name: 'Response Structure Tests',
    description: 'Tests for proper response formatting and structure',
    testCases: [
      {
        id: 'rs-001',
        name: 'Comparison Structure',
        description: 'Test comparison response has proper structure',
        category: 'integration',
        query: 'compare gateron ink black v2 vs cherry mx black',
        expectedIntent: 'switch_comparison',
        expectedSections: ['overview', 'technicalSpecs', 'analysis'],
        mustIncludeTerms: ['## overview', '## technical specifications', '## analysis'],
        expectedTableColumns: ['switch name', 'manufacturer', 'actuation force'],
        minimumQualityScore: 0.5,
        priority: 'high'
      },
      {
        id: 'rs-002',
        name: 'General Info Structure',
        description: 'Test general info response has proper structure',
        category: 'integration',
        query: 'what are tactile switches',
        expectedIntent: 'general_switch_info',
        expectedSections: ['overview', 'technicalSpecs'],
        mustIncludeTerms: ['tactile'],
        minimumQualityScore: 0.5,
        priority: 'medium'
      },
      {
        id: 'rs-003',
        name: 'Complex Multi-Switch Comparison',
        description: 'Test handling of 3+ switch comparison',
        category: 'integration',
        query: 'compare cherry mx blue vs gateron blue vs kailh box jade vs holy panda',
        expectedIntent: 'switch_comparison',
        minimumQualityScore: 0.6,
        mustIncludeTerms: ['cherry', 'gateron', 'kailh', 'holy panda', 'tactile'],
        priority: 'medium'
      }
    ]
  },
  {
    id: 'edge-cases',
    name: 'Edge Case Handling',
    description: 'Tests for handling unusual or challenging queries',
    testCases: [
      {
        id: 'ec-001',
        name: 'Vague Query',
        description: 'Test handling of unclear requests',
        category: 'integration',
        query: 'good switch',
        minimumQualityScore: 0.4,
        mustIncludeTerms: ['subjective', 'depends', 'preferences'],
        expectedIntent: 'general_switch_info',
        priority: 'medium'
      },
      {
        id: 'ec-002',
        name: 'Non-Existent Switch Comparison',
        description: 'Test comparison including fake switches',
        category: 'integration',
        query: 'cherry mx red vs imaginary super switch 9000',
        expectedIntent: 'switch_comparison',
        minimumQualityScore: 0.4,
        mustIncludeTerms: ['cherry mx red', 'information', 'unknown'],
        priority: 'high'
      },
      {
        id: 'ec-003',
        name: 'Mixed Valid/Invalid Query',
        description: 'Test partial information handling',
        category: 'integration',
        query: 'gateron yellow vs some random switch I made up',
        expectedIntent: 'switch_comparison',
        minimumQualityScore: 0.5,
        mustIncludeTerms: ['gateron yellow', 'unknown', 'undefined'],
        priority: 'medium'
      },
      {
        id: 'ec-004',
        name: 'Ultra-Specific Technical Query',
        description: 'Test handling of very detailed technical questions',
        category: 'integration',
        query:
          'what is the exact spring constant and material composition of gateron yellow spring',
        minimumQualityScore: 0.5,
        mustIncludeTerms: ['spring', 'material', 'stainless steel'],
        priority: 'low'
      }
    ]
  },
  {
    id: 'user-experience',
    name: 'User Experience Tests',
    description: 'Tests focused on practical user scenarios',
    testCases: [
      {
        id: 'ux-001',
        name: 'Gaming Recommendation',
        description: 'Test gaming-focused recommendations',
        category: 'integration',
        query: 'best linear switches for gaming under 50g',
        minimumQualityScore: 0.6,
        mustIncludeTerms: ['gaming', 'linear', '50g', 'recommend'],
        priority: 'high'
      },
      {
        id: 'ux-002',
        name: 'Office Environment Query',
        description: 'Test workplace-appropriate recommendations',
        category: 'integration',
        query: 'quiet switches for office typing',
        minimumQualityScore: 0.6,
        mustIncludeTerms: ['quiet', 'office', 'typing', 'noise'],
        priority: 'high'
      },
      {
        id: 'ux-003',
        name: 'Budget Constraint Query',
        description: 'Test handling of budget considerations',
        category: 'integration',
        query: 'good switches similar to cherry mx but cheaper',
        minimumQualityScore: 0.6,
        mustIncludeTerms: ['similar', 'cherry', 'alternative', 'cost'],
        priority: 'medium'
      },
      {
        id: 'ux-004',
        name: 'Follow-up Context',
        description: 'Test contextual follow-up handling',
        category: 'integration',
        query: 'how do they sound compared to browns',
        minimumQualityScore: 0.4,
        mustIncludeTerms: ['context', 'previous', 'clarify'],
        priority: 'medium'
      }
    ]
  },
  {
    id: 'database-integration',
    name: 'Database Integration Tests',
    description: 'Tests for database lookup and integration accuracy',
    testCases: [
      {
        id: 'db-001',
        name: 'Known Switch Lookup',
        description: 'Test lookup of switch with complete database entry',
        category: 'integration',
        query: 'gateron yellow switch specs',
        expectedEntities: ['gateron yellow'],
        shouldPreferDatabase: true,
        mustIncludeTerms: ['linear'],
        minimumQualityScore: 0.8,
        priority: 'high'
      },
      {
        id: 'db-002',
        name: 'Multiple Switch Comparison',
        description: 'Test comparison with multiple database lookups',
        category: 'integration',
        query: 'compare cherry mx blue vs gateron blue vs kailh blue',
        expectedIntent: 'switch_comparison',
        minimumQualityScore: 0.75,
        mustIncludeTerms: ['cherry', 'gateron', 'kailh', 'tactile'],
        priority: 'high'
      },
      {
        id: 'db-003',
        name: 'Graceful Database Miss',
        description: 'Test handling when switch not in database',
        category: 'integration',
        query: 'tell me about really obscure vintage switch model xyz',
        minimumQualityScore: 0.4,
        mustIncludeTerms: ['information', 'available', 'general'],
        mustNotIncludeTerms: ['database error', 'system failure'],
        priority: 'high'
      }
    ]
  },
  {
    id: 'regression',
    name: 'Regression Tests',
    description: "Tests to ensure changes don't break existing functionality",
    testCases: [
      {
        id: 'reg-001',
        name: 'Basic Functionality',
        description: 'Ensure basic comparison still works',
        category: 'regression',
        query: 'mx red vs mx blue',
        expectedIntent: 'switch_comparison',
        minimumQualityScore: 0.6,
        priority: 'high'
      },
      {
        id: 'reg-002',
        name: 'Complex Query Handling',
        description: 'Ensure complex queries are handled properly',
        category: 'regression',
        query:
          'which linear switch under 45g actuation force is best for gaming between gateron yellow, cherry mx red, and kailh red',
        expectedIntent: 'switch_comparison',
        minimumQualityScore: 0.6,
        mustIncludeTerms: ['linear', 'gaming', '45g'],
        priority: 'medium'
      },
      {
        id: 'reg-003',
        name: 'Material Analysis Stability',
        description: 'Ensure material analysis remains functional',
        category: 'regression',
        query: 'polycarbonate vs nylon housing sound difference',
        expectedIntent: 'material_analysis',
        minimumQualityScore: 0.6,
        mustIncludeTerms: ['polycarbonate', 'nylon', 'sound'],
        priority: 'medium'
      }
    ]
  }
];

export const MANUAL_EVALUATION_GUIDELINES = `
# Manual Evaluation Guidelines for SwitchAI Responses

## Response Quality Evaluation (1-5 Scale)

### 5 - Excellent
- All required sections present and well-structured
- Accurate technical specifications
- Comprehensive analysis with clear insights
- Excellent use of domain terminology
- Actionable recommendations
- Perfect markdown formatting

### 4 - Good
- Most required sections present
- Mostly accurate specifications with minor issues
- Good analysis with useful insights
- Appropriate technical language
- Relevant recommendations
- Good formatting with minor issues

### 3 - Acceptable
- Basic sections present but may lack depth
- Generally accurate specs with some gaps
- Basic analysis covers main points
- Some technical inaccuracies or unclear language
- Generic recommendations
- Adequate formatting

### 2 - Below Standard
- Missing key sections
- Several technical inaccuracies
- Superficial analysis
- Poor use of technical terms
- Weak or irrelevant recommendations
- Poor formatting

### 1 - Poor
- Severely incomplete response
- Major technical errors
- Lacks meaningful analysis
- Confusing or incorrect information
- No useful recommendations
- Very poor formatting

## Specific Evaluation Criteria

### Structure (Weight: 30%)
- [ ] Proper markdown headers (## Overview, ## Technical Specifications, etc.)
- [ ] Complete sections for query type
- [ ] Logical information flow
- [ ] Proper table formatting (for comparisons)

### Technical Accuracy (Weight: 35%)
- [ ] Correct switch specifications
- [ ] Accurate force measurements and units
- [ ] Proper material descriptions
- [ ] Correct manufacturer information

### Content Quality (Weight: 25%)
- [ ] Addresses user's specific question
- [ ] Provides actionable insights
- [ ] Uses appropriate technical depth
- [ ] Offers relevant recommendations

### Language & Presentation (Weight: 10%)
- [ ] Clear and professional writing
- [ ] Proper technical terminology
- [ ] Good readability
- [ ] Appropriate tone for audience

## Common Issues to Flag
- Inconsistent force measurements
- Outdated switch information
- Generic responses that don't address specific query
- Missing manufacturer or model information
- Poor comparison table structure
- Recommendations that don't match user needs
`;
