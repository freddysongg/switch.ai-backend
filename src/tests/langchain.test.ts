/**
 * LangChain Integration Test Suite
 *
 * Master test runner for all LangChain-related tests including:
 * - SwitchAIRetriever tests
 * - SwitchAIRAGChain tests
 * - Integration tests
 */

import { runChainTests } from './langchain-chain.test.js';
import { runRetrieverTests } from './langchain-retriever.test.js';

/**
 * Test Suite Results
 */
interface TestSuiteResults {
  totalTests: number;
  passed: number;
  failed: number;
  tests: any[];
}

/**
 * Combined Test Results
 */
interface CombinedTestResults {
  suites: {
    retriever: TestSuiteResults;
    chain: TestSuiteResults;
  };
  overall: {
    totalTests: number;
    passed: number;
    failed: number;
    successRate: number;
  };
}

/**
 * Run integration tests between retriever and chain
 */
async function runIntegrationTests(): Promise<TestSuiteResults> {
  console.log('🔄 Running LangChain Integration Tests...\n');

  const results: any[] = [];
  let passed = 0;
  let failed = 0;

  // Test 1: Verify chain can use real retriever
  try {
    process.stdout.write('  Testing Chain + Retriever Integration... ');

    const { SwitchAIRAGChain } = await import('../services/langchain/chain.js');
    const chain = new SwitchAIRAGChain();

    const config = chain.getConfig();
    if (config.retriever && typeof config.retriever === 'object') {
      console.log('✅ PASSED');
      passed++;
      results.push({ name: 'Chain + Retriever Integration', passed: true });
    } else {
      throw new Error('Chain does not have proper retriever configuration');
    }
  } catch (error: any) {
    console.log('❌ FAILED');
    console.log(`     Error: ${error.message}`);
    failed++;
    results.push({
      name: 'Chain + Retriever Integration',
      passed: false,
      error: error.message
    });
  }

  // Test 2: Verify chain methods are available
  try {
    process.stdout.write('  Testing Chain API Completeness... ');

    const { SwitchAIRAGChain, createSwitchAIRAGChain, isComparisonQuery } = await import(
      '../services/langchain/chain.js'
    );

    if (
      typeof SwitchAIRAGChain === 'function' &&
      typeof createSwitchAIRAGChain === 'function' &&
      typeof isComparisonQuery === 'function'
    ) {
      console.log('✅ PASSED');
      passed++;
      results.push({ name: 'Chain API Completeness', passed: true });
    } else {
      throw new Error('Missing expected exports from chain module');
    }
  } catch (error: any) {
    console.log('❌ FAILED');
    console.log(`     Error: ${error.message}`);
    failed++;
    results.push({
      name: 'Chain API Completeness',
      passed: false,
      error: error.message
    });
  }

  // Test 3: Verify retriever exports
  try {
    process.stdout.write('  Testing Retriever API Completeness... ');

    const {
      SwitchAIRetriever,
      SwitchAIEmbeddings,
      createSwitchAIRetriever,
      createSwitchAIEmbeddings
    } = await import('../services/langchain/wrappers.js');

    if (
      typeof SwitchAIRetriever === 'function' &&
      typeof SwitchAIEmbeddings === 'function' &&
      typeof createSwitchAIRetriever === 'function' &&
      typeof createSwitchAIEmbeddings === 'function'
    ) {
      console.log('✅ PASSED');
      passed++;
      results.push({ name: 'Retriever API Completeness', passed: true });
    } else {
      throw new Error('Missing expected exports from wrappers module');
    }
  } catch (error: any) {
    console.log('❌ FAILED');
    console.log(`     Error: ${error.message}`);
    failed++;
    results.push({
      name: 'Retriever API Completeness',
      passed: false,
      error: error.message
    });
  }

  console.log(`\n📊 Integration Test Results:`);
  console.log(`   Total: ${results.length}`);
  console.log(`   Passed: ${passed} ✅`);
  console.log(`   Failed: ${failed} ${failed > 0 ? '❌' : ''}`);

  return {
    totalTests: results.length,
    passed,
    failed,
    tests: results
  };
}

/**
 * Main test runner
 */
export async function runLangChainTests(): Promise<CombinedTestResults> {
  console.log('🚀 Starting LangChain Test Suite\n');
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    // Run retriever tests
    const retrieverResults = await runRetrieverTests();
    console.log('');

    // Run chain tests
    const chainResults = await runChainTests();
    console.log('');

    // Run integration tests
    const integrationResults = await runIntegrationTests();
    console.log('');

    const totalTests =
      retrieverResults.totalTests + chainResults.totalTests + integrationResults.totalTests;
    const totalPassed = retrieverResults.passed + chainResults.passed + integrationResults.passed;
    const totalFailed = retrieverResults.failed + chainResults.failed + integrationResults.failed;
    const successRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('='.repeat(60));
    console.log('📈 FINAL TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(
      `🧪 Retriever Tests:   ${retrieverResults.passed}/${retrieverResults.totalTests} passed`
    );
    console.log(`🔗 Chain Tests:       ${chainResults.passed}/${chainResults.totalTests} passed`);
    console.log(
      `🔄 Integration Tests: ${integrationResults.passed}/${integrationResults.totalTests} passed`
    );
    console.log('─'.repeat(60));
    console.log(
      `📊 Overall:           ${totalPassed}/${totalTests} passed (${successRate.toFixed(1)}%)`
    );
    console.log(`⏱️  Duration:          ${duration}ms`);

    if (totalFailed > 0) {
      console.log(`\n❌ ${totalFailed} test(s) failed. Check output above for details.`);
    } else {
      console.log(`\n✅ All tests passed! LangChain integration is working correctly.`);
    }

    return {
      suites: {
        retriever: retrieverResults,
        chain: chainResults
      },
      overall: {
        totalTests,
        passed: totalPassed,
        failed: totalFailed,
        successRate
      }
    };
  } catch (error: any) {
    console.error('\n💥 Test suite failed to run:', error.message);
    console.error('Stack trace:', error.stack);

    return {
      suites: {
        retriever: { totalTests: 0, passed: 0, failed: 0, tests: [] },
        chain: { totalTests: 0, passed: 0, failed: 0, tests: [] }
      },
      overall: {
        totalTests: 0,
        passed: 0,
        failed: 1,
        successRate: 0
      }
    };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runLangChainTests()
    .then((results) => {
      if (results.overall.failed > 0) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}
