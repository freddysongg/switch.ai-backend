# Frontend Migration Guide: Structured JSON Responses

## Overview

The SwitchAI backend has been upgraded to return structured JSON responses instead of raw markdown strings. This guide will help you migrate your frontend code to consume the new response format.

## Key Changes Summary

### Before (Legacy)
```typescript
interface ChatMessage {
  id: string;
  content: string; // Raw markdown string
  timestamp: Date;
  role: 'user' | 'assistant';
}
```

### After (New Structure)
```typescript
interface ChatMessage {
  id: string;
  content: StructuredContent; // Rich structured object
  timestamp: Date;
  role: 'user' | 'assistant';
}

interface StructuredContent {
  responseType: 'switch_comparison' | 'characteristics_explanation' | 'material_analysis' | 'standard_rag';
  data: ResponseData; // Varies by response type
  version: string;
  generatedAt: Date;
  metadata?: Record<string, any>;
  error?: ErrorInfo;
  isFallback?: boolean;
}
```

## Migration Strategies

### Strategy 1: Gradual Migration (Recommended)

This approach allows you to migrate components incrementally while maintaining backward compatibility.

#### Step 1: Update Type Definitions

```typescript
// types/chat.ts
export interface LegacyContent {
  type: 'string';
  value: string;
}

export interface StructuredContent {
  type: 'structured';
  responseType: 'switch_comparison' | 'characteristics_explanation' | 'material_analysis' | 'standard_rag';
  data: any; // Import proper types from API documentation
  version: string;
  generatedAt: Date;
  metadata?: Record<string, any>;
  error?: ErrorInfo;
  isFallback?: boolean;
}

export interface ChatMessage {
  id: string;
  content: LegacyContent | StructuredContent;
  timestamp: Date;
  role: 'user' | 'assistant';
}
```

#### Step 2: Create Content Detection Utility

```typescript
// utils/contentDetection.ts
export function isStructuredContent(content: any): content is StructuredContent {
  return (
    content &&
    typeof content === 'object' &&
    content.type === 'structured' &&
    typeof content.responseType === 'string' &&
    content.data &&
    typeof content.version === 'string'
  );
}

export function isLegacyContent(content: any): content is LegacyContent {
  return (
    content &&
    typeof content === 'object' &&
    content.type === 'string' &&
    typeof content.value === 'string'
  );
}

// For backward compatibility with old string-only content
export function isStringContent(content: any): boolean {
  return typeof content === 'string';
}
```

#### Step 3: Create Content Renderer Component

```typescript
// components/ContentRenderer.tsx
import React from 'react';
import { StructuredContentRenderer } from './StructuredContentRenderer';
import { MarkdownRenderer } from './MarkdownRenderer';
import { isStructuredContent, isLegacyContent, isStringContent } from '../utils/contentDetection';

interface ContentRendererProps {
  content: any;
  className?: string;
}

export const ContentRenderer: React.FC<ContentRendererProps> = ({ content, className }) => {
  // Handle structured content
  if (isStructuredContent(content)) {
    return (
      <div className={className}>
        <StructuredContentRenderer content={content} />
        {content.error && (
          <div className="error-banner">
            ⚠️ Content may be incomplete due to parsing error
          </div>
        )}
      </div>
    );
  }

  // Handle legacy wrapped content
  if (isLegacyContent(content)) {
    return (
      <div className={className}>
        <MarkdownRenderer content={content.value} />
      </div>
    );
  }

  // Handle old string content (backward compatibility)
  if (isStringContent(content)) {
    return (
      <div className={className}>
        <MarkdownRenderer content={content} />
      </div>
    );
  }

  // Fallback for unknown content types
  return (
    <div className={`${className} error-content`}>
      <p>Unable to render content</p>
      <details>
        <summary>Debug Info</summary>
        <pre>{JSON.stringify(content, null, 2)}</pre>
      </details>
    </div>
  );
};
```

### Strategy 2: Complete Migration

If you prefer to migrate everything at once, follow this approach.

#### Step 1: Update All Type Definitions

```typescript
// types/responses.ts
export interface SwitchComparisonResponse {
  title: string;
  switchNames: string[];
  overview: string;
  technicalSpecs: {
    switches: TechnicalSpecSwitch[];
  };
  analysis: {
    feelComparison: AnalysisSection;
    soundComparison: AnalysisSection;
    buildQualityComparison: AnalysisSection;
    performanceComparison: AnalysisSection;
  };
  conclusion: {
    summary: string;
    recommendations: Record<string, string>;
    keyDifferences: string[];
  };
  metadata: {
    switchesCompared: number;
    allSwitchesFoundInDatabase: boolean;
    sectionsFound?: number;
    tablesFound?: number;
    hasDetailedSpecs?: boolean;
  };
}

// Import other response types from API documentation...
```

#### Step 2: Create Specialized Renderers

```typescript
// components/renderers/SwitchComparisonRenderer.tsx
import React from 'react';
import { SwitchComparisonResponse } from '../../types/responses';

interface Props {
  data: SwitchComparisonResponse;
}

export const SwitchComparisonRenderer: React.FC<Props> = ({ data }) => {
  return (
    <div className="switch-comparison">
      <header className="comparison-header">
        <h2>{data.title}</h2>
        <div className="switch-badges">
          {data.switchNames.map(name => (
            <span key={name} className="switch-badge">{name}</span>
          ))}
        </div>
      </header>

      <section className="overview">
        <h3>Overview</h3>
        <p>{data.overview}</p>
      </section>

      <section className="technical-specs">
        <h3>Technical Specifications</h3>
        <div className="specs-table">
          <table>
            <thead>
              <tr>
                <th>Switch</th>
                <th>Manufacturer</th>
                <th>Type</th>
                <th>Actuation Force</th>
                <th>Travel Distance</th>
              </tr>
            </thead>
            <tbody>
              {data.technicalSpecs.switches.map((switch_, index) => (
                <tr key={index}>
                  <td>{switch_.name}</td>
                  <td>{switch_.manufacturer}</td>
                  <td>{switch_.type || 'N/A'}</td>
                  <td>{switch_.actuationForce || 'N/A'}</td>
                  <td>{switch_.totalTravel || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="analysis">
        <h3>Analysis</h3>
        <div className="analysis-grid">
          <AnalysisCard section={data.analysis.feelComparison} />
          <AnalysisCard section={data.analysis.soundComparison} />
          <AnalysisCard section={data.analysis.buildQualityComparison} />
          <AnalysisCard section={data.analysis.performanceComparison} />
        </div>
      </section>

      <section className="conclusion">
        <h3>Conclusion</h3>
        <p>{data.conclusion.summary}</p>
        
        <div className="recommendations">
          <h4>Recommendations</h4>
          <ul>
            {Object.entries(data.conclusion.recommendations).map(([useCase, recommendation]) => (
              <li key={useCase}>
                <strong>{useCase}:</strong> {recommendation}
              </li>
            ))}
          </ul>
        </div>

        <div className="key-differences">
          <h4>Key Differences</h4>
          <ul>
            {data.conclusion.keyDifferences.map((difference, index) => (
              <li key={index}>{difference}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
};

const AnalysisCard: React.FC<{ section: AnalysisSection }> = ({ section }) => (
  <div className="analysis-card">
    <h4>{section.title}</h4>
    <p>{section.content}</p>
    {section.keyPoints && (
      <ul className="key-points">
        {section.keyPoints.map((point, index) => (
          <li key={index}>{point}</li>
        ))}
      </ul>
    )}
  </div>
);
```

## Response Type Handling

### Switch Comparison Responses

```typescript
// components/renderers/SwitchComparisonRenderer.tsx
export const SwitchComparisonRenderer: React.FC<{ data: SwitchComparisonResponse }> = ({ data }) => {
  return (
    <div className="switch-comparison">
      {/* Header with switch names */}
      <header>
        <h2>{data.title}</h2>
        <div className="switches">
          {data.switchNames.map(name => (
            <span key={name} className="switch-name">{name}</span>
          ))}
        </div>
      </header>

      {/* Overview section */}
      <section className="overview">
        <p>{data.overview}</p>
      </section>

      {/* Technical specifications table */}
      <TechnicalSpecsTable switches={data.technicalSpecs.switches} />

      {/* Analysis sections */}
      <AnalysisGrid analysis={data.analysis} />

      {/* Conclusion */}
      <ConclusionSection conclusion={data.conclusion} />

      {/* Metadata footer */}
      <MetadataFooter metadata={data.metadata} />
    </div>
  );
};
```

### Characteristics Explanation Responses

```typescript
// components/renderers/CharacteristicsRenderer.tsx
export const CharacteristicsRenderer: React.FC<{ data: CharacteristicsExplanationResponse }> = ({ data }) => {
  return (
    <div className="characteristics-explanation">
      <header>
        <h2>{data.title}</h2>
        <div className="characteristics-list">
          {data.characteristicsExplained.map(char => (
            <span key={char} className="characteristic-tag">{char}</span>
          ))}
        </div>
      </header>

      <section className="overview">
        <p>{data.overview}</p>
      </section>

      <section className="characteristic-details">
        {data.characteristicDetails.map((detail, index) => (
          <CharacteristicCard key={index} detail={detail} />
        ))}
      </section>

      {data.materialScience && (
        <MaterialScienceSection materialScience={data.materialScience} />
      )}

      <ExamplesSection examples={data.examples} />
      <PracticalImplicationsSection implications={data.practicalImplications} />
    </div>
  );
};
```

### Material Analysis Responses

```typescript
// components/renderers/MaterialAnalysisRenderer.tsx
export const MaterialAnalysisRenderer: React.FC<{ data: MaterialAnalysisResponse }> = ({ data }) => {
  return (
    <div className="material-analysis">
      <header>
        <h2>{data.title}</h2>
        <div className="materials-analyzed">
          {data.materialsAnalyzed.map(material => (
            <span key={material} className="material-tag">{material}</span>
          ))}
        </div>
      </header>

      <section className="overview">
        <p>{data.overview}</p>
      </section>

      <section className="material-details">
        {data.materialDetails.map((detail, index) => (
          <MaterialDetailCard key={index} detail={detail} />
        ))}
      </section>

      <MaterialScienceSection materialScience={data.materialScience} />
      
      {data.comparisons && (
        <ComparisonSection comparisons={data.comparisons} />
      )}

      <ExamplesSection examples={data.examples} />
      <PracticalGuidanceSection guidance={data.practicalGuidance} />
    </div>
  );
};
```

### Standard RAG Responses

```typescript
// components/renderers/StandardRAGRenderer.tsx
export const StandardRAGRenderer: React.FC<{ data: StandardRAGResponse }> = ({ data }) => {
  return (
    <div className="standard-rag">
      <header>
        <h2>{data.title}</h2>
        <span className="query-type-badge">{data.queryType}</span>
      </header>

      <section className="main-content">
        <p className="main-answer">{data.content.mainAnswer}</p>
        
        {data.content.additionalContext && (
          <div className="additional-context">
            <h4>Additional Context</h4>
            <p>{data.content.additionalContext}</p>
          </div>
        )}

        {data.content.relatedInformation && (
          <div className="related-information">
            <h4>Related Information</h4>
            <p>{data.content.relatedInformation}</p>
          </div>
        )}
      </section>

      {data.sections && data.sections.length > 0 && (
        <section className="additional-sections">
          {data.sections.map((section, index) => (
            <div key={index} className="section">
              <h4>{section.title}</h4>
              <p>{section.content}</p>
              {section.keyPoints && (
                <ul>
                  {section.keyPoints.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {data.keyPoints.length > 0 && (
        <section className="key-points">
          <h4>Key Points</h4>
          <ul>
            {data.keyPoints.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
        </section>
      )}

      {data.relatedSwitches && data.relatedSwitches.length > 0 && (
        <section className="related-switches">
          <h4>Related Switches</h4>
          <div className="switch-list">
            {data.relatedSwitches.map((switch_, index) => (
              <div key={index} className="switch-item">
                <strong>{switch_.name}</strong> by {switch_.manufacturer}
                <p>{switch_.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.followUp && (
        <FollowUpSection followUp={data.followUp} />
      )}

      <SourceInformationSection sourceInfo={data.sourceInformation} />
    </div>
  );
};
```

## Error Handling

### Detecting and Handling Errors

```typescript
// utils/errorHandling.ts
export function hasParsingError(content: StructuredContent): boolean {
  return !!content.error || !!content.isFallback;
}

export function getErrorMessage(content: StructuredContent): string {
  if (content.error) {
    return content.error.errorMessage;
  }
  if (content.isFallback) {
    return 'Content may be incomplete due to parsing limitations';
  }
  return '';
}

export function shouldShowErrorWarning(content: StructuredContent): boolean {
  return hasParsingError(content) || (content.metadata?.warnings && content.metadata.warnings.length > 0);
}
```

### Error Banner Component

```typescript
// components/ErrorBanner.tsx
import React from 'react';
import { StructuredContent } from '../types/responses';

interface Props {
  content: StructuredContent;
  onRetry?: () => void;
}

export const ErrorBanner: React.FC<Props> = ({ content, onRetry }) => {
  if (!hasParsingError(content)) return null;

  const errorMessage = getErrorMessage(content);
  const isMinorError = content.isFallback && !content.error;

  return (
    <div className={`error-banner ${isMinorError ? 'warning' : 'error'}`}>
      <div className="error-content">
        <span className="error-icon">
          {isMinorError ? '⚠️' : '❌'}
        </span>
        <span className="error-message">{errorMessage}</span>
      </div>
      
      {onRetry && (
        <button onClick={onRetry} className="retry-button">
          Retry
        </button>
      )}
      
      {content.error && (
        <details className="error-details">
          <summary>Technical Details</summary>
          <pre>{JSON.stringify(content.error, null, 2)}</pre>
        </details>
      )}
    </div>
  );
};
```

## Performance Optimization

### Lazy Loading Components

```typescript
// Use React.lazy for heavy renderers
const SwitchComparisonRenderer = React.lazy(() => 
  import('./renderers/SwitchComparisonRenderer').then(module => ({
    default: module.SwitchComparisonRenderer
  }))
);

const CharacteristicsRenderer = React.lazy(() =>
  import('./renderers/CharacteristicsRenderer').then(module => ({
    default: module.CharacteristicsRenderer
  }))
);

// In your main component
export const StructuredContentRenderer: React.FC<{ content: StructuredContent }> = ({ content }) => {
  return (
    <div className="structured-content">
      <ErrorBanner content={content} />
      
      <React.Suspense fallback={<ContentSkeleton />}>
        {content.responseType === 'switch_comparison' && (
          <SwitchComparisonRenderer data={content.data} />
        )}
        {content.responseType === 'characteristics_explanation' && (
          <CharacteristicsRenderer data={content.data} />
        )}
        {/* ... other renderers */}
      </React.Suspense>
      
      <MetadataFooter metadata={content.metadata} version={content.version} />
    </div>
  );
};
```

### Memoization

```typescript
// Use React.memo for expensive components
export const SwitchComparisonRenderer = React.memo<{ data: SwitchComparisonResponse }>(({ data }) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison for performance
  return JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data);
});
```

## Styling Guidelines

### CSS Structure

```css
/* Base structured content styles */
.structured-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 100%;
}

/* Response type specific styles */
.switch-comparison {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
}

.switch-comparison .comparison-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.switch-badges {
  display: flex;
  gap: 0.5rem;
}

.switch-badge {
  background: #3b82f6;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

/* Technical specs table */
.specs-table {
  overflow-x: auto;
}

.specs-table table {
  width: 100%;
  border-collapse: collapse;
}

.specs-table th,
.specs-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.specs-table th {
  background: #f8fafc;
  font-weight: 600;
}

/* Analysis grid */
.analysis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.analysis-card {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 1rem;
}

.analysis-card h4 {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
}

/* Error handling styles */
.error-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.error-banner.warning {
  background: #fef3c7;
  border: 1px solid #f59e0b;
  color: #92400e;
}

.error-banner.error {
  background: #fee2e2;
  border: 1px solid #ef4444;
  color: #dc2626;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.retry-button {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.retry-button:hover {
  background: #2563eb;
}

/* Responsive design */
@media (max-width: 768px) {
  .analysis-grid {
    grid-template-columns: 1fr;
  }
  
  .comparison-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .specs-table {
    font-size: 0.875rem;
  }
}
```

### Dark Mode Support

```css
/* Dark mode variables */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --border-color: #e2e8f0;
  --accent-color: #3b82f6;
}

[data-theme="dark"] {
  --bg-primary: #1f2937;
  --bg-secondary: #111827;
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --border-color: #374151;
  --accent-color: #60a5fa;
}

/* Apply variables */
.structured-content {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.switch-comparison {
  border-color: var(--border-color);
  background: var(--bg-primary);
}

.specs-table th {
  background: var(--bg-secondary);
}

.specs-table th,
.specs-table td {
  border-color: var(--border-color);
}
```

## Testing Guidelines

### Unit Testing Structured Content

```typescript
// __tests__/ContentRenderer.test.tsx
import { render, screen } from '@testing-library/react';
import { ContentRenderer } from '../components/ContentRenderer';
import { mockSwitchComparisonResponse } from './mocks/responses';

describe('ContentRenderer', () => {
  it('renders switch comparison content correctly', () => {
    const structuredContent = {
      responseType: 'switch_comparison' as const,
      data: mockSwitchComparisonResponse,
      version: '1.0.0',
      generatedAt: new Date(),
    };

    render(<ContentRenderer content={structuredContent} />);

    expect(screen.getByText(mockSwitchComparisonResponse.title)).toBeInTheDocument();
    expect(screen.getByText('Technical Specifications')).toBeInTheDocument();
  });

  it('handles error content gracefully', () => {
    const errorContent = {
      responseType: 'standard_rag' as const,
      data: { /* minimal data */ },
      version: '1.0.0',
      generatedAt: new Date(),
      error: {
        errorType: 'PARSING_FAILED',
        errorMessage: 'Failed to parse content',
        timestamp: new Date().toISOString(),
        markdownLength: 100
      },
      isFallback: true
    };

    render(<ContentRenderer content={errorContent} />);

    expect(screen.getByText(/Content may be incomplete/)).toBeInTheDocument();
  });

  it('falls back to markdown for legacy content', () => {
    const legacyContent = {
      type: 'string',
      value: '# Test Markdown\n\nThis is **bold** text.'
    };

    render(<ContentRenderer content={legacyContent} />);

    expect(screen.getByText('Test Markdown')).toBeInTheDocument();
  });
});
```

### Integration Testing

```typescript
// __tests__/integration/ChatFlow.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInterface } from '../components/ChatInterface';
import { mockApiResponse } from './mocks/api';

// Mock API calls
jest.mock('../services/api', () => ({
  sendMessage: jest.fn().mockResolvedValue(mockApiResponse)
}));

describe('Chat Flow Integration', () => {
  it('handles structured response end-to-end', async () => {
    const user = userEvent.setup();
    
    render(<ChatInterface />);

    // Send a message
    const input = screen.getByPlaceholderText('Ask about switches...');
    await user.type(input, 'Compare Cherry MX Red vs Blue');
    await user.click(screen.getByText('Send'));

    // Wait for structured response to render
    await waitFor(() => {
      expect(screen.getByText('Cherry MX Red vs Blue Comparison')).toBeInTheDocument();
    });

    // Verify technical specs table is rendered
    expect(screen.getByText('Technical Specifications')).toBeInTheDocument();
    expect(screen.getByText('Cherry MX Red')).toBeInTheDocument();
    expect(screen.getByText('Cherry MX Blue')).toBeInTheDocument();
  });
});
```

## Performance Monitoring

### Frontend Performance Tracking

```typescript
// utils/performanceTracking.ts
export class FrontendPerformanceTracker {
  private static instance: FrontendPerformanceTracker;
  
  public static getInstance(): FrontendPerformanceTracker {
    if (!this.instance) {
      this.instance = new FrontendPerformanceTracker();
    }
    return this.instance;
  }

  public trackRenderTime(responseType: string, startTime: number): void {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`🎨 Rendered ${responseType} in ${duration.toFixed(2)}ms`);
    
    // Send to analytics if configured
    if (window.analytics) {
      window.analytics.track('Content Rendered', {
        responseType,
        renderTime: duration,
        timestamp: new Date().toISOString()
      });
    }
  }

  public trackInteraction(action: string, responseType: string): void {
    console.log(`👆 User interaction: ${action} on ${responseType}`);
    
    if (window.analytics) {
      window.analytics.track('Content Interaction', {
        action,
        responseType,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Usage in components
export const SwitchComparisonRenderer: React.FC<Props> = ({ data }) => {
  const performanceTracker = FrontendPerformanceTracker.getInstance();
  
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      performanceTracker.trackRenderTime('switch_comparison', startTime);
    };
  }, []);

  const handleInteraction = (action: string) => {
    performanceTracker.trackInteraction(action, 'switch_comparison');
  };

  // Component implementation...
};
```

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: Content Not Rendering

**Problem**: Content appears blank or shows fallback message.

**Solution**:
```typescript
// Check content structure
console.log('Content received:', JSON.stringify(content, null, 2));

// Verify content type detection
console.log('Is structured:', isStructuredContent(content));
console.log('Response type:', content.responseType);

// Check for errors
if (content.error) {
  console.error('Content error:', content.error);
}
```

#### Issue 2: Performance Issues

**Problem**: Slow rendering of complex structured content.

**Solutions**:
1. Implement virtualization for large lists
2. Use React.memo for expensive components
3. Lazy load heavy components
4. Optimize re-renders with useMemo and useCallback

```typescript
// Example optimization
const TechnicalSpecsTable = React.memo(({ switches }) => {
  const memoizedSpecs = useMemo(() => {
    return switches.map(switch_ => ({
      ...switch_,
      formattedForce: `${switch_.actuationForce || 'N/A'}`
    }));
  }, [switches]);

  return (
    <table>
      {/* Render memoized specs */}
    </table>
  );
});
```

#### Issue 3: Type Errors

**Problem**: TypeScript errors when accessing response data.

**Solution**:
```typescript
// Use type guards
function isSwitchComparison(data: any): data is SwitchComparisonResponse {
  return data && typeof data.title === 'string' && Array.isArray(data.switchNames);
}

// Safe data access
if (content.responseType === 'switch_comparison' && isSwitchComparison(content.data)) {
  // TypeScript now knows content.data is SwitchComparisonResponse
  const switchNames = content.data.switchNames;
}
```

## Best Practices

### 1. Always Check Response Type

```typescript
// ✅ Good
switch (content.responseType) {
  case 'switch_comparison':
    return <SwitchComparisonRenderer data={content.data} />;
  case 'characteristics_explanation':
    return <CharacteristicsRenderer data={content.data} />;
  default:
    return <StandardRAGRenderer data={content.data} />;
}

// ❌ Bad
return <SwitchComparisonRenderer data={content.data} />; // Assumes type
```

### 2. Handle Errors Gracefully

```typescript
// ✅ Good
const ContentRenderer = ({ content }) => {
  if (content.error) {
    return <ErrorBanner content={content} onRetry={handleRetry} />;
  }
  
  return <StructuredContentRenderer content={content} />;
};

// ❌ Bad
const ContentRenderer = ({ content }) => {
  return <StructuredContentRenderer content={content} />; // No error handling
};
```

### 3. Use Semantic HTML

```typescript
// ✅ Good
<article className="switch-comparison">
  <header>
    <h2>{data.title}</h2>
  </header>
  <section aria-label="Technical Specifications">
    <table role="table">
      {/* ... */}
    </table>
  </section>
</article>

// ❌ Bad
<div className="switch-comparison">
  <div>{data.title}</div>
  <div>
    {/* No semantic structure */}
  </div>
</div>
```

### 4. Implement Proper Loading States

```typescript
// ✅ Good
const ChatMessage = ({ message, isLoading }) => {
  if (isLoading) {
    return <MessageSkeleton />;
  }
  
  return <ContentRenderer content={message.content} />;
};

// ❌ Bad
const ChatMessage = ({ message }) => {
  return message ? <ContentRenderer content={message.content} /> : null;
};
```

## Migration Checklist

### Phase 1: Preparation
- [ ] Update TypeScript definitions
- [ ] Create content detection utilities
- [ ] Implement basic ContentRenderer component
- [ ] Set up error handling components
- [ ] Create testing infrastructure

### Phase 2: Component Development
- [ ] Build SwitchComparisonRenderer
- [ ] Build CharacteristicsRenderer  
- [ ] Build MaterialAnalysisRenderer
- [ ] Build StandardRAGRenderer
- [ ] Implement StructuredContentRenderer

### Phase 3: Integration
- [ ] Update ChatMessage component
- [ ] Integrate with existing chat system
- [ ] Add performance monitoring
- [ ] Implement error recovery mechanisms
- [ ] Update styling and themes

### Phase 4: Testing
- [ ] Unit test all renderers
- [ ] Integration test chat flow
- [ ] Performance test with large responses
- [ ] Accessibility audit
- [ ] Cross-browser testing

### Phase 5: Deployment
- [ ] Feature flag implementation
- [ ] Gradual rollout strategy
- [ ] Monitor error rates
- [ ] Collect user feedback
- [ ] Performance monitoring

## Support and Resources

### Documentation
- [API Documentation](./api-structured-responses.md)
- [TypeScript Interfaces](../src/config/responseStructures.ts)
- [Backend Implementation](../src/services/responseParser.ts)

### Examples
- [Complete React Example](./examples/react-structured-content/)
- [Vue.js Example](./examples/vue-structured-content/)
- [Angular Example](./examples/angular-structured-content/)

### Support Channels
- **Technical Issues**: Create issue in repository
- **Questions**: Join development Discord channel
- **Feature Requests**: Use GitHub discussions

---

This migration guide should help you successfully transition from markdown strings to structured JSON responses. Remember to test thoroughly and implement changes incrementally to minimize disruption to your users. 