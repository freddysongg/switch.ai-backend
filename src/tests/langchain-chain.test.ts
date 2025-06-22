/**
 * Unit Tests for SwitchAIRAGChain
 *
 * Tests the LCEL-based RAG pipeline that combines SwitchAI retriever,
 * prompt templates, and Google Gemini LLM into configurable chains.
 */

import { Document } from '@langchain/core/documents';

import {
  createSwitchAIRAGChain,
  isComparisonQuery,
  SwitchAIRAGChain,
  type SwitchAIChainConfig,
  type SwitchAIChainInput
} from '../services/langchain/chain.js';

/**
 * Mock SwitchAIRetriever for testing
 */
class MockSwitchAIRetriever {
  async invoke(query: string): Promise<Document[]> {
    if (query.includes('cherry mx red')) {
      return [
        new Document({
          pageContent: `Switch Name: Cherry MX Red
            Manufacturer: Cherry
            Type: Linear
            Actuation Force: 45g
            Bottom-out Force: 75g
            Pre-travel: 2.0mm
            Total Travel: 4.0mm
            Top Housing: Nylon
            Bottom Housing: Nylon
            Stem: POM
            Spring: Gold-plated steel
            Mount: 5-pin
            Factory Lubed: No

            The Cherry MX Red is a popular linear switch known for its smooth keystroke and light actuation force, making it ideal for gaming applications.`,
          metadata: {
            confidence: 0.95,
            matchType: 'semantic',
            switchName: 'Cherry MX Red'
          }
        })
      ];
    }

    if (query.includes('comparison') || query.includes('vs')) {
      return [
        new Document({
          pageContent: `Switch Name: Cherry MX Red
            Type: Linear
            Actuation Force: 45g`,
          metadata: { confidence: 0.9, switchName: 'Cherry MX Red' }
        }),
        new Document({
          pageContent: `Switch Name: Gateron Yellow
            Type: Linear  
            Actuation Force: 50g`,
          metadata: { confidence: 0.85, switchName: 'Gateron Yellow' }
        })
      ];
    }

    return [];
  }
}

/**
 * Mock ChatGoogleGenerativeAI for testing
 */
class MockChatGoogleGenerativeAI {
  private temperature: number;

  constructor(config: any) {
    this.temperature = config.temperature || 0.3;
  }

  async invoke(input: any): Promise<{ content: string }> {
    const prompt = input.messages?.[0]?.content || input;

    if (prompt.includes('JSON') && prompt.includes('comparison')) {
      return {
        content: JSON.stringify({
          comparisonTable: {
            headers: ['Switch Name', 'Type', 'Actuation Force'],
            rows: [
              {
                'Switch Name': 'Cherry MX Red',
                Type: 'Linear',
                'Actuation Force': '45g'
              },
              {
                'Switch Name': 'Gateron Yellow',
                Type: 'Linear',
                'Actuation Force': '50g'
              }
            ]
          },
          summary:
            'Both switches are linear but differ in actuation force. Cherry MX Red is lighter at 45g while Gateron Yellow requires 50g.',
          recommendations: [
            {
              text: 'Cherry MX Red for lighter touch gaming',
              reasoning: 'Lower actuation force reduces finger fatigue'
            }
          ]
        })
      };
    }

    return {
      content: `## Switch Analysis

        ### Overview
        Based on the provided information, I can analyze the Cherry MX Red switch characteristics.

        ### Technical Specifications
        - **Type**: Linear
        - **Actuation Force**: 45g
        - **Bottom-out Force**: 75g
        - **Travel Distance**: 4.0mm total, 2.0mm pre-travel

        ### Analysis
        The Cherry MX Red is a smooth linear switch that's particularly well-suited for gaming applications. The light 45g actuation force allows for quick, repeated key presses without significant finger fatigue.

        ### Recommendations
        - Excellent for gaming, especially FPS and competitive games
        - Good for users who prefer light key presses
        - May not be ideal for heavy typists who prefer tactile feedback`
    };
  }
}

/**
 * Test Results Interface
 */
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

/**
 * Test Suite Results
 */
interface TestSuiteResults {
  totalTests: number;
  passed: number;
  failed: number;
  tests: TestResult[];
}

/**
 * Test helper functions
 */
function assertEqual(actual: any, expected: any, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}. Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertContains(text: string, substring: string, message: string): void {
  if (!text.includes(substring)) {
    throw new Error(`${message}. Expected "${text}" to contain "${substring}"`);
  }
}

/**
 * Run a single test and capture results
 */
async function runTest(testName: string, testFn: () => Promise<void>): Promise<TestResult> {
  try {
    await testFn();
    return { name: testName, passed: true };
  } catch (error: any) {
    return {
      name: testName,
      passed: false,
      error: error.message,
      details: error.stack
    };
  }
}

/**
 * Test chain initialization and configuration
 */
async function testChainInitialization(): Promise<void> {
  const chain1 = new SwitchAIRAGChain();
  const config1 = chain1.getConfig();
  assertEqual(config1.retriever.k, 10, 'Default k should be 10');
  assertEqual(config1.llm.temperature, 0.3, 'Default temperature should be 0.3');
  assertEqual(config1.includeHistory, true, 'Should include history by default');

  const customConfig: SwitchAIChainConfig = {
    retriever: { k: 5, rrfK: 30 },
    llm: { temperature: 0.5, maxOutputTokens: 2000 },
    includeHistory: false,
    maxHistoryTurns: 2
  };

  const chain2 = new SwitchAIRAGChain(customConfig);
  const config2 = chain2.getConfig();
  assertEqual(config2.retriever.k, 5, 'Custom k should be 5');
  assertEqual(config2.llm.temperature, 0.5, 'Custom temperature should be 0.5');
  assertEqual(config2.includeHistory, false, 'Should respect custom history setting');

  const chain3 = createSwitchAIRAGChain({ retriever: { k: 15 } });
  assertEqual(chain3.getConfig().retriever.k, 15, 'Factory function should set k to 15');
}

/**
 * Test comparison query detection
 */
async function testComparisonQueryDetection(): Promise<void> {
  assertTrue(
    isComparisonQuery('compare cherry mx red vs gateron yellow'),
    'Should detect "compare X vs Y"'
  );
  assertTrue(isComparisonQuery('cherry mx red vs gateron yellow'), 'Should detect "X vs Y"');
  assertTrue(
    isComparisonQuery('difference between cherry mx and gateron'),
    'Should detect "difference between"'
  );
  assertTrue(
    isComparisonQuery('cherry mx red compared to gateron yellow'),
    'Should detect "compared to"'
  );
  assertTrue(
    isComparisonQuery('what is better: cherry mx or gateron?'),
    'Should detect comparison with "better"'
  );

  assertTrue(
    !isComparisonQuery('what are cherry mx red switches like?'),
    'Should not detect single switch query'
  );
  assertTrue(
    !isComparisonQuery('tell me about linear switches'),
    'Should not detect general query'
  );
  assertTrue(
    !isComparisonQuery('best switches for gaming'),
    'Should not detect recommendation query'
  );
}

/**
 * Test main chain invocation
 */
async function testMainChainInvocation(): Promise<void> {
  const chain = new SwitchAIRAGChain();

  chain['retriever'] = new MockSwitchAIRetriever() as any;
  chain['llm'] = new MockChatGoogleGenerativeAI({}) as any;

  const input: SwitchAIChainInput = {
    query: 'tell me about cherry mx red switches',
    requestId: 'test-123'
  };

  const output = await chain.invoke(input);

  assertTrue(typeof output === 'object', 'Should return an object');
  assertTrue(typeof output.response === 'string', 'Should have response string');
  assertTrue(Array.isArray(output.retrievedDocuments), 'Should have retrieved documents array');
  assertTrue(typeof output.metadata === 'object', 'Should have metadata object');

  assertEqual(output.metadata.requestId, 'test-123', 'Should preserve request ID');
  assertTrue(output.metadata.retrievalCount >= 0, 'Should have non-negative retrieval count');
  assertTrue(typeof output.metadata.processingTimeMs === 'number', 'Should have processing time');

  assertContains(output.response, 'Cherry MX Red', 'Response should mention the switch');
  assertContains(output.response, 'Linear', 'Response should mention switch type');
}

/**
 * Run all chain tests
 */
export async function runChainTests(): Promise<TestSuiteResults> {
  console.log('🔗 Running SwitchAIRAGChain Tests...\n');

  const tests = [
    { name: 'Chain Initialization', fn: testChainInitialization },
    { name: 'Comparison Query Detection', fn: testComparisonQueryDetection },
    { name: 'Main Chain Invocation', fn: testMainChainInvocation }
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    process.stdout.write(`  Testing ${test.name}... `);
    const result = await runTest(test.name, test.fn);
    results.push(result);

    if (result.passed) {
      console.log('✅ PASSED');
    } else {
      console.log('❌ FAILED');
      console.log(`     Error: ${result.error}`);
      if (process.argv.includes('--verbose') && result.details) {
        console.log(`     Details: ${result.details}`);
      }
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n📊 Chain Test Results:`);
  console.log(`   Total: ${results.length}`);
  console.log(`   Passed: ${passed} ✅`);
  console.log(`   Failed: ${failed} ${failed > 0 ? '❌' : ''}`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`   - ${r.name}: ${r.error}`);
      });
  }

  return {
    totalTests: results.length,
    passed,
    failed,
    tests: results
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runChainTests()
    .then((results) => {
      if (results.failed > 0) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}
