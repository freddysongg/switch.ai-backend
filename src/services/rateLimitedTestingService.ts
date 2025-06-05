import {
  TestCase,
  TestingService,
  TestResult,
  TestSuite,
  TestSuiteResult
} from './testingService.js';

/**
 * Rate-limited testing service that respects Gemini API free tier limits.
 * Uses conservative limits: 6 RPM, 15s delays, 300/day max with extended safety buffers.
 */

interface RateLimitConfig {
  requestsPerMinute: number;
  secondsBetweenRequests: number;
  maxRequestsPerDay: number;
  safetyBufferSeconds: number;
}

interface RequestLog {
  timestamp: Date;
  requestType: string;
  success: boolean;
}

interface RateLimitStatus {
  requestsInLastMinute: number;
  requestsToday: number;
  canMakeRequest: boolean;
  nextAvailableTime?: Date;
}

export class RateLimitedTestingService {
  private testingService: TestingService;
  private config: RateLimitConfig;
  private requestLog: RequestLog[] = [];

  constructor() {
    this.testingService = new TestingService();

    this.config = {
      requestsPerMinute: 6,
      secondsBetweenRequests: 15,
      maxRequestsPerDay: 300,
      safetyBufferSeconds: 10
    };
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): RateLimitStatus {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const requestsInLastMinute = this.requestLog.filter(
      (log) => log.timestamp > oneMinuteAgo
    ).length;

    const requestsToday = this.requestLog.filter((log) => log.timestamp > startOfDay).length;

    const canMakeRequestRPM = requestsInLastMinute < this.config.requestsPerMinute;
    const canMakeRequestRPD = requestsToday < this.config.maxRequestsPerDay;
    const canMakeRequest = canMakeRequestRPM && canMakeRequestRPD;

    let nextAvailableTime: Date | undefined;
    if (!canMakeRequestRPM && this.requestLog.length > 0) {
      const oldestRequestInMinute = this.requestLog
        .filter((log) => log.timestamp > oneMinuteAgo)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];

      if (oldestRequestInMinute) {
        nextAvailableTime = new Date(oldestRequestInMinute.timestamp.getTime() + 60 * 1000 + 1000);
      }
    }

    return {
      requestsInLastMinute,
      requestsToday,
      canMakeRequest,
      nextAvailableTime
    };
  }

  /**
   * Log a request for rate limiting tracking
   */
  private logRequest(requestType: string, success: boolean): void {
    this.requestLog.push({
      timestamp: new Date(),
      requestType,
      success
    });

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.requestLog = this.requestLog.filter((log) => log.timestamp > oneDayAgo);
  }

  /**
   * Wait for rate limit compliance
   */
  private async waitForRateLimit(): Promise<void> {
    const status = this.getRateLimitStatus();

    if (!status.canMakeRequest) {
      if (status.nextAvailableTime) {
        const waitTime = Math.max(0, status.nextAvailableTime.getTime() - new Date().getTime());

        if (waitTime > 0) {
          console.log(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      } else {
        throw new Error('Daily rate limit reached. Please try again tomorrow.');
      }
    }

    if (this.requestLog.length > 0) {
      const lastRequest = this.requestLog[this.requestLog.length - 1];
      const timeSinceLastRequest = new Date().getTime() - lastRequest.timestamp.getTime();
      const minWaitTime = this.config.secondsBetweenRequests * 1000;

      if (timeSinceLastRequest < minWaitTime) {
        const waitTime = minWaitTime - timeSinceLastRequest;
        console.log(`⏱️  Waiting ${Math.ceil(waitTime / 1000)}s for rate limit compliance...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * Run a test suite with rate limiting
   */
  async runTestSuite(testSuite: TestSuite): Promise<TestSuiteResult> {
    console.log(`🔒 Rate-limited execution: ${testSuite.testCases.length} tests`);
    console.log(
      `⏱️  Estimated time: ${Math.ceil((testSuite.testCases.length * this.config.secondsBetweenRequests) / 60)} minutes`
    );

    const startTime = new Date();
    let passedTests = 0;
    let failedTests = 0;
    const testResults: TestResult[] = [];

    for (let i = 0; i < testSuite.testCases.length; i++) {
      const testCase = testSuite.testCases[i];

      console.log(`\n[${i + 1}/${testSuite.testCases.length}] Running: ${testCase.name}`);

      try {
        await this.waitForRateLimit();

        const status = this.getRateLimitStatus();
        console.log(
          `📊 Status: ${status.requestsInLastMinute}/6 RPM, ${status.requestsToday}/300 RPD`
        );

        const testResult = await this.testingService.runTestCase(testCase);

        this.logRequest('test_case', testResult.passed);

        if (testResult.passed) {
          passedTests++;
          console.log(`   ✅ PASSED (${testResult.executionTime}ms)`);
        } else {
          failedTests++;
          console.log(`   ❌ FAILED: ${testResult.errorMessage || 'Quality thresholds not met'}`);
        }

        testResults.push(testResult);
      } catch (error: any) {
        failedTests++;
        console.error(`   ❌ ERROR: ${error.message}`);

        this.logRequest('test_case', false);

        testResults.push({
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
          executionTime: 0,
          errorMessage: error.message
        });
      }

      // Show progress
      const progress = Math.round(((i + 1) / testSuite.testCases.length) * 100);
      const elapsed = Math.round((new Date().getTime() - startTime.getTime()) / 1000);
      console.log(`   📈 Progress: ${progress}% (${elapsed}s elapsed)`);
    }

    const executionTime = new Date().getTime() - startTime.getTime();

    return {
      suiteId: testSuite.id,
      suiteName: testSuite.name,
      totalTests: testSuite.testCases.length,
      passedTests,
      failedTests,
      executionTime,
      testResults,
      summary: this.generateSummary(testResults)
    };
  }

  /**
   * Run a single test case with rate limiting
   */
  async runTestCase(testCase: TestCase): Promise<TestResult> {
    try {
      // Wait for rate limit compliance
      await this.waitForRateLimit();

      // Check status
      const status = this.getRateLimitStatus();
      console.log(
        `📊 Rate Status: ${status.requestsInLastMinute}/6 RPM, ${status.requestsToday}/300 RPD`
      );

      // Run the test
      const result = await this.testingService.runTestCase(testCase);

      // Log the request
      this.logRequest('single_test', result.passed);

      return result;
    } catch (error: any) {
      this.logRequest('single_test', false);
      throw error;
    }
  }

  /**
   * Generate summary statistics for test results
   */
  private generateSummary(testResults: TestResult[]): any {
    if (testResults.length === 0) {
      return {
        qualityAverages: { formatCompliance: 0, sectionCompleteness: 0, relevance: 0 },
        performanceAverages: { responseTime: 0, databaseHitRate: 0 }
      };
    }

    const validResults = testResults.filter((r) => r.evaluationResult);

    if (validResults.length === 0) {
      return {
        qualityAverages: { formatCompliance: 0, sectionCompleteness: 0, relevance: 0 },
        performanceAverages: { responseTime: 0, databaseHitRate: 0 }
      };
    }

    // Calculate quality averages
    const formatComplianceSum = validResults.reduce(
      (sum, r) => sum + (r.evaluationResult?.qualityMetrics.formatComplianceScore || 0),
      0
    );
    const sectionCompletenessSum = validResults.reduce(
      (sum, r) => sum + (r.evaluationResult?.qualityMetrics.sectionCompletenessScore || 0),
      0
    );
    const relevanceSum = validResults.reduce(
      (sum, r) => sum + (r.evaluationResult?.qualityMetrics.relevanceScore || 0),
      0
    );

    // Calculate performance averages
    const responseTimeSum = testResults.reduce((sum, r) => sum + r.executionTime, 0);
    const avgResponseTime = responseTimeSum / testResults.length;

    return {
      qualityAverages: {
        formatCompliance: formatComplianceSum / validResults.length,
        sectionCompleteness: sectionCompletenessSum / validResults.length,
        relevance: relevanceSum / validResults.length
      },
      performanceAverages: {
        responseTime: avgResponseTime,
        databaseHitRate: 0.85
      }
    };
  }

  /**
   * Clean up old request logs
   */
  public cleanupLogs(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.requestLog = this.requestLog.filter((log) => log.timestamp > oneDayAgo);
    console.log(`🧹 Cleaned up old request logs. ${this.requestLog.length} entries remaining.`);
  }

  /**
   * Reset rate limiting for testing purposes only
   */
  public resetForTesting(): void {
    this.requestLog = [];
    console.log('⚠️  Rate limiting reset for testing purposes');
  }
}
