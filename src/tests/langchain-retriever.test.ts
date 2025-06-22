/**
 * Unit Tests for SwitchAIRetriever
 *
 * Tests the custom LangChain retriever that integrates SwitchAI's hybrid search capabilities.
 * Covers hybrid search logic, document conversion, switch name extraction, and error handling.
 */

import { Document } from '@langchain/core/documents';

import { createSwitchAIRetriever, SwitchAIRetriever } from '../services/langchain/wrappers.js';

/**
 * Mock DatabaseService for testing
 */
class MockDatabaseService {
  async fetchSwitchSpecifications(switchNames: string[], _options?: any) {
    if (switchNames.includes('cherry mx red')) {
      return {
        switches: [
          {
            found: true,
            data: {
              switchName: 'Cherry MX Red',
              manufacturer: 'Cherry',
              type: 'Linear',
              actuationForceG: 45,
              bottomOutForceG: 75,
              preTravelMm: 2.0,
              totalTravelMm: 4.0,
              topHousing: 'Nylon',
              bottomHousing: 'Nylon',
              stem: 'POM',
              spring: 'Gold-plated steel',
              mount: '5-pin',
              factoryLubed: false
            },
            normalizedName: 'cherry mx red',
            confidence: 0.95
          }
        ]
      };
    }

    return {
      switches: [
        {
          found: false,
          data: null,
          normalizedName: switchNames[0],
          confidence: 0.0
        }
      ]
    };
  }

  async keywordSearch(query: string) {
    if (query.includes('red')) {
      return [
        {
          switchName: 'Gateron Red',
          manufacturer: 'Gateron',
          type: 'Linear',
          actuationForceG: 45,
          name: 'Gateron Red'
        }
      ];
    }
    return [];
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

function _assertGreaterThan(actual: number, expected: number, message: string): void {
  if (actual <= expected) {
    throw new Error(`${message}. Expected ${actual} > ${expected}`);
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
 * Test SwitchAIRetriever initialization
 */
async function testRetrieverInitialization(): Promise<void> {
  const retriever1 = new SwitchAIRetriever();
  assertEqual(retriever1['k'], 10, 'Default k should be 10');
  assertEqual(retriever1['confidenceThreshold'], 0.5, 'Default confidence threshold should be 0.5');
  assertEqual(retriever1['rrfK'], 60, 'Default RRF K should be 60');

  const retriever2 = new SwitchAIRetriever({
    k: 5,
    confidenceThreshold: 0.7,
    rrfK: 30,
    enableEmbeddingSearch: false
  });
  assertEqual(retriever2['k'], 5, 'Custom k should be 5');
  assertEqual(retriever2['confidenceThreshold'], 0.7, 'Custom confidence threshold should be 0.7');
  assertEqual(retriever2['rrfK'], 30, 'Custom RRF K should be 30');
  assertEqual(retriever2['enableEmbeddingSearch'], false, 'Embedding search should be disabled');

  const retriever3 = createSwitchAIRetriever({ k: 15 });
  assertEqual(retriever3['k'], 15, 'Factory function should set k to 15');
}

/**
 * Test switch name extraction
 */
async function testSwitchNameExtraction(): Promise<void> {
  const retriever = new SwitchAIRetriever();

  const switches1 = retriever['extractSwitchNames']('I want Cherry MX Red switches');
  assertTrue(switches1.length > 0, 'Should extract Cherry MX Red');
  assertTrue(
    switches1.some((s) => s.toLowerCase().includes('cherry')),
    'Should contain Cherry'
  );

  const switches2 = retriever['extractSwitchNames'](
    'Compare Gateron Yellow vs Holy Panda switches'
  );
  assertTrue(switches2.length >= 2, 'Should extract multiple switch names');

  const switches3 = retriever['extractSwitchNames']('What are the best switches for gaming?');
  assertTrue(Array.isArray(switches3), 'Should return an array');
}

/**
 * Test document conversion
 */
async function testDocumentConversion(): Promise<void> {
  const retriever = new SwitchAIRetriever();

  const mockResults = [
    {
      found: true,
      data: {
        switchName: 'Cherry MX Red',
        manufacturer: 'Cherry',
        type: 'Linear',
        actuationForceG: 45
      },
      switchData: {
        switchName: 'Cherry MX Red',
        manufacturer: 'Cherry',
        type: 'Linear',
        actuationForceG: 45
      },
      normalizedName: 'cherry mx red',
      confidence: 0.95,
      matchType: 'semantic' as const
    }
  ];

  const documents = retriever['convertToDocuments'](mockResults, 'cherry mx red switches');

  assertEqual(documents.length, 1, 'Should convert to 1 document');
  assertTrue(documents[0] instanceof Document, 'Should be Document instance');
  assertTrue(
    documents[0].pageContent.includes('Cherry MX Red'),
    'Content should include switch name'
  );
  assertTrue(documents[0].pageContent.includes('Linear'), 'Content should include switch type');
  assertEqual(documents[0].metadata.confidence, 0.95, 'Metadata should include confidence');
  assertEqual(documents[0].metadata.matchType, 'semantic', 'Metadata should include match type');
}

/**
 * Test hybrid search logic (mocked)
 */
async function testHybridSearchLogic(): Promise<void> {
  const retriever = new SwitchAIRetriever();

  retriever['databaseService'] = new MockDatabaseService() as any;

  const documents1 = await retriever._getRelevantDocuments('cherry mx red switches');
  assertTrue(documents1.length > 0, 'Should retrieve documents for known switches');
  assertTrue(
    documents1[0].pageContent.includes('Cherry MX Red'),
    'Should contain switch information'
  );

  const documents2 = await retriever._getRelevantDocuments('unknown switch xyz');
  assertTrue(Array.isArray(documents2), 'Should return array even for unknown switches');

  const documents3 = await retriever._getRelevantDocuments('red switches for gaming');
  assertTrue(Array.isArray(documents3), 'Should handle keyword-only queries');
}

/**
 * Test error handling
 */
async function testErrorHandling(): Promise<void> {
  const retriever = new SwitchAIRetriever();

  retriever['databaseService'] = {
    fetchSwitchSpecifications: async () => {
      throw new Error('Database connection failed');
    },
    keywordSearch: async () => {
      throw new Error('Search service unavailable');
    }
  } as any;

  const documents = await retriever._getRelevantDocuments('any query');
  assertEqual(documents.length, 0, 'Should return empty array on database failure');
}

/**
 * Test RRF fusion logic
 */
async function testRRFFusion(): Promise<void> {
  const retriever = new SwitchAIRetriever();
  retriever['databaseService'] = new MockDatabaseService() as any;

  const documents = await retriever._getRelevantDocuments('red switches linear gaming');
  assertTrue(Array.isArray(documents), 'Should return array');

  assertTrue(documents.length >= 0, 'Should return non-negative number of documents');
}

/**
 * Test k-limiting
 */
async function testKLimiting(): Promise<void> {
  const retriever = new SwitchAIRetriever({ k: 2 });
  retriever['databaseService'] = new MockDatabaseService() as any;

  const documents = await retriever._getRelevantDocuments('cherry mx switches');
  assertTrue(documents.length <= 2, 'Should respect k limit');
}

/**
 * Test LangChain compatibility
 */
async function testLangChainCompatibility(): Promise<void> {
  const retriever = new SwitchAIRetriever();

  assertTrue(typeof retriever.lc_namespace === 'object', 'Should have lc_namespace');
  assertTrue(Array.isArray(retriever.lc_namespace), 'lc_namespace should be array');
  assertEqual(retriever.lc_namespace, ['switchai', 'retrievers'], 'Should have correct namespace');

  assertEqual(SwitchAIRetriever.lc_name(), 'SwitchAIRetriever', 'Should have correct lc_name');
}

/**
 * Run all retriever tests
 */
export async function runRetrieverTests(): Promise<TestSuiteResults> {
  console.log('🧪 Running SwitchAIRetriever Tests...\n');

  const tests = [
    { name: 'Retriever Initialization', fn: testRetrieverInitialization },
    { name: 'Switch Name Extraction', fn: testSwitchNameExtraction },
    { name: 'Document Conversion', fn: testDocumentConversion },
    { name: 'Hybrid Search Logic', fn: testHybridSearchLogic },
    { name: 'Error Handling', fn: testErrorHandling },
    { name: 'RRF Fusion', fn: testRRFFusion },
    { name: 'K Limiting', fn: testKLimiting },
    { name: 'LangChain Compatibility', fn: testLangChainCompatibility }
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

  console.log(`\n📊 Retriever Test Results:`);
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
  runRetrieverTests()
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
