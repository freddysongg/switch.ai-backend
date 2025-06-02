# Performance Monitoring System

## Overview

The Performance Monitoring System provides comprehensive tracking and analysis of the ResponseParserService operations. It collects metrics on parsing performance, memory usage, success rates, and helps identify bottlenecks and optimization opportunities.

## Features

- **Real-time Performance Tracking**: Monitor parsing operations as they happen
- **Memory Usage Analysis**: Track heap usage and memory consumption patterns
- **Error Classification**: Categorize and track different types of failures
- **Complexity Analysis**: Understand how content complexity affects performance
- **Historical Data**: Maintain performance history for trend analysis
- **Health Monitoring**: Automated health checks with configurable thresholds

## Architecture

### Core Components

1. **PerformanceMonitoringService** (`src/services/performanceMonitoring.ts`)
   - Central service for collecting and analyzing metrics
   - Provides APIs for starting/completing operations
   - Maintains in-memory metrics storage with configurable history limits

2. **Performance Routes** (`src/routes/performanceRoutes.ts`)
   - RESTful endpoints for accessing performance data
   - Health check endpoints for monitoring system status
   - Administrative functions for metrics management

3. **Performance Integration** (in `ResponseParserService`)
   - Automatic instrumentation of parsing operations
   - Error tracking and classification
   - Content complexity analysis

## Usage

### Starting the System

The performance monitoring system is automatically initialized when the application starts. No manual setup is required.

### Accessing Performance Data

The system provides several RESTful endpoints for accessing performance data:

#### 1. Health Check
```bash
GET /api/performance/health
```

Returns current system health with performance indicators:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "performance": {
    "recentOperations": 45,
    "successRate": "96.7%",
    "averageResponseTime": "245.30ms",
    "memoryUsage": "128.5 MB",
    "uptime": "2.3h"
  },
  "warnings": []
}
```

#### 2. Performance Statistics
```bash
GET /api/performance/stats?timeWindowHours=1&format=summary
```

Comprehensive performance statistics:
```json
{
  "overview": {
    "totalOperations": 150,
    "successRate": "94.7%",
    "averageDuration": "312.45ms",
    "medianDuration": "278.12ms",
    "maxDuration": "1245.67ms"
  },
  "performance": {
    "averageInputSize": "15.3 KB",
    "averageOutputSize": "8.7 KB",
    "compressionRatio": "0.57x",
    "averageMemory": "132.4 MB",
    "maxMemory": "156.8 MB"
  },
  "operations": {
    "parseMarkdown": 150,
    "transformToSwitchComparison": 45,
    "transformToMaterialAnalysis": 38,
    "transformToCharacteristicsExplanation": 35,
    "transformToStandardRAG": 32
  },
  "errors": {
    "ParseError": 5,
    "ValidationError": 3
  },
  "complexity": {
    "low": {
      "count": 89,
      "averageDuration": 178.23,
      "averageMemoryUsage": 124567890
    },
    "medium": {
      "count": 45,
      "averageDuration": 356.78,
      "averageMemoryUsage": 134567890
    },
    "high": {
      "count": 16,
      "averageDuration": 789.45,
      "averageMemoryUsage": 156789012
    }
  }
}
```

#### 3. Recent Metrics
```bash
GET /api/performance/metrics/recent?limit=5
```

Get the most recent parsing operations:
```json
{
  "count": 5,
  "metrics": [
    {
      "operationId": "parseMarkdown_123_1642234567890",
      "operation": "parseMarkdown",
      "responseType": "switch_comparison",
      "duration": 234.56,
      "durationFormatted": "234.56ms",
      "inputSize": 15674,
      "inputSizeFormatted": "15.3 KB",
      "outputSize": 8945,
      "outputSizeFormatted": "8.7 KB",
      "memoryUsageFormatted": "128.5 MB",
      "success": true,
      "parsingComplexity": "medium",
      "sections": 5,
      "tables": 2,
      "lists": 8,
      "timestamp": "2024-01-15T10:28:45.123Z"
    }
  ]
}
```

#### 4. Slow Operations
```bash
GET /api/performance/slow-operations?threshold=1000
```

Identify operations that exceeded performance thresholds:
```json
{
  "threshold": "1000ms",
  "count": 3,
  "operations": [
    {
      "operationId": "parseMarkdown_118_1642234500000",
      "operation": "parseMarkdown",
      "responseType": "material_analysis",
      "duration": "1245.67ms",
      "inputSize": "45.2 KB",
      "outputSize": "23.1 KB",
      "parsingComplexity": "high",
      "timestamp": "2024-01-15T10:25:00.000Z",
      "sections": 12,
      "tables": 5,
      "lists": 18
    }
  ]
}
```

#### 5. Failed Operations
```bash
GET /api/performance/failed-operations
```

Analyze operations that failed:
```json
{
  "count": 8,
  "operations": [
    {
      "operationId": "parseMarkdown_115_1642234400000",
      "operation": "parseMarkdown",
      "responseType": "switch_comparison",
      "errorType": "ParseError",
      "duration": "156.78ms",
      "inputSize": "3.2 KB",
      "parsingComplexity": "low",
      "timestamp": "2024-01-15T10:23:20.000Z",
      "warnings": 2
    }
  ]
}
```

### Administrative Functions

#### Clear Metrics History
```bash
POST /api/performance/clear
```

Clear all stored performance metrics (admin function):
```json
{
  "message": "Performance metrics cleared successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Export Metrics
```bash
GET /api/performance/export
```

Export all metrics for external analysis. Downloads a JSON file with complete metrics history.

## Performance Thresholds

The system automatically monitors for performance issues using these thresholds:

### Response Time Thresholds
- **Normal**: < 500ms
- **Warning**: 500ms - 2000ms  
- **Critical**: > 2000ms

### Success Rate Thresholds
- **Healthy**: > 95%
- **Warning**: 90% - 95%
- **Critical**: < 90%

### Memory Usage Thresholds
- **Normal**: < 200MB
- **Warning**: 200MB - 500MB
- **Critical**: > 500MB

### Parsing Complexity Classification
- **Low**: < 5 structural elements (sections + tables + lists)
- **Medium**: 5 - 20 structural elements
- **High**: > 20 structural elements

## Testing the Performance Monitoring

### 1. Basic Health Check
```bash
curl http://localhost:3000/api/performance/health
```

### 2. Generate Some Test Data
Send a few chat requests to generate parsing operations:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "message": "Compare Cherry MX Red vs Blue switches",
    "conversationId": "test-conversation"
  }'
```

### 3. Check Performance Stats
```bash
curl "http://localhost:3000/api/performance/stats?timeWindowHours=1&format=summary"
```

### 4. Monitor Recent Operations
```bash
curl "http://localhost:3000/api/performance/metrics/recent?limit=10"
```

## Development and Debugging

### Enable Detailed Logging
The performance monitoring system respects the `NODE_ENV` environment variable:

```bash
# Enable detailed logging in development
NODE_ENV=development npm run dev

# Disable detailed logging in production
NODE_ENV=production npm start
```

### Custom Performance Tracking
You can also track custom operations using the performance monitor directly:

```typescript
import { performanceMonitor } from '../services/performanceMonitoring.js';

// Start tracking an operation
const operationId = performanceMonitor.startOperation(
  'parseMarkdown',
  'switch_comparison',
  inputSize
);

try {
  // Your operation logic here
  const result = await someOperation();
  
  // Complete successful operation
  performanceMonitor.completeOperation(operationId, {
    outputSize: JSON.stringify(result).length,
    success: true,
    warnings: 0,
    sections: 5,
    tables: 2,
    lists: 8
  });
  
  return result;
} catch (error) {
  // Complete failed operation
  performanceMonitor.completeOperation(operationId, {
    outputSize: 0,
    success: false,
    errorType: error.constructor.name,
    warnings: 1
  });
  
  throw error;
}
```

### Performance Decorator
Use the provided decorator for automatic instrumentation:

```typescript
import { monitorPerformance } from '../services/performanceMonitoring.js';

class MyService {
  @monitorPerformance('transformToSwitchComparison', 'switch_comparison')
  async transformData(data: any): Promise<any> {
    // Method logic here
    return transformedData;
  }
}
```

## Monitoring in Production

### Automated Alerts
Set up automated monitoring by regularly checking the health endpoint:

```bash
#!/bin/bash
# health-check.sh - Add to cron for regular monitoring

HEALTH_URL="http://localhost:3000/api/performance/health"
RESPONSE=$(curl -s $HEALTH_URL)
STATUS=$(echo $RESPONSE | jq -r '.status')

if [ "$STATUS" != "healthy" ]; then
  echo "Performance issue detected: $RESPONSE"
  # Send alert to monitoring system
fi
```

### Performance Dashboard
The exported metrics can be imported into monitoring dashboards like Grafana:

1. Export metrics: `GET /api/performance/export`
2. Import JSON data into your monitoring system
3. Create visualizations for:
   - Response time trends
   - Success rate over time
   - Memory usage patterns
   - Error rate by operation type

### Log Integration
Performance metrics are logged to the console and can be collected by log aggregation systems:

```bash
# Example log entries
🚀 Started parseMarkdown operation [parseMarkdown_123_1642234567890] - Input: 15.3 KB, Memory: 128.5 MB
✅ Completed parseMarkdown [parseMarkdown_123_1642234567890] - Duration: 234.56ms, Output: 8.7 KB, Memory Δ: 2.1 MB, Complexity: medium
```

## Troubleshooting

### High Memory Usage
If memory usage is consistently high:

1. Check the metrics history limit: `maxMetricsHistory` in `PerformanceMonitoringService`
2. Monitor for memory leaks in parsing operations
3. Consider implementing metric storage persistence instead of in-memory storage

### High Response Times
If parsing operations are slow:

1. Check slow operations endpoint: `/api/performance/slow-operations`
2. Analyze input complexity vs. performance
3. Review parsing algorithms for optimization opportunities
4. Consider implementing caching for common operations

### High Error Rates
If error rates are elevated:

1. Check failed operations: `/api/performance/failed-operations`
2. Review error types and patterns
3. Examine input validation and fallback mechanisms
4. Monitor content quality and structure

## Configuration Options

The performance monitoring system can be configured in the `PerformanceMonitoringService` constructor:

```typescript
const performanceMonitor = new PerformanceMonitoringService({
  maxMetricsHistory: 1000,        // Maximum metrics to store in memory
  enableDetailedLogging: true,    // Enable console logging
  enableMemoryTracking: true      // Enable memory usage tracking
});
```

For production environments, consider:
- Reducing `maxMetricsHistory` to save memory
- Disabling `enableDetailedLogging` to reduce log volume
- Implementing persistent storage for metrics

## Best Practices

1. **Regular Monitoring**: Check performance health at least daily
2. **Trend Analysis**: Export metrics weekly for trend analysis
3. **Threshold Tuning**: Adjust performance thresholds based on your requirements
4. **Error Investigation**: Investigate failed operations promptly
5. **Capacity Planning**: Use performance data for infrastructure planning
6. **Performance Budgets**: Set and monitor performance budgets for different operation types

## Future Enhancements

Potential improvements to the performance monitoring system:

1. **Persistent Storage**: Store metrics in database for long-term analysis
2. **Real-time Alerts**: Webhook integration for immediate notifications
3. **Performance Budgets**: Configurable performance budgets with enforcement
4. **Distributed Tracing**: Integration with distributed tracing systems
5. **Custom Metrics**: Support for application-specific metrics
6. **Performance Regression Detection**: Automated detection of performance regressions 