# Frontend Integration Brief: Enhanced Switch Comparisons

## Overview

This document provides the frontend team with comprehensive guidance for integrating and rendering the enhanced switch comparison feature from the SwitchAI backend. The backend now automatically detects comparison queries and returns structured Markdown responses with rich metadata.

## Key Changes to `/api/chat` Endpoint

### No API Changes Required
- The `/api/chat` endpoint maintains the same request/response structure
- Enhanced functionality is automatically triggered by comparison queries
- Full backward compatibility with existing chat implementation

### Enhanced Response Metadata

When a comparison is detected, the response includes additional metadata fields:

```typescript
interface ChatResponse {
  id: string;
  role: 'assistant';
  content: string; // Markdown formatted comparison content
  metadata: {
    model: string;
    // NEW: Comparison-specific metadata
    isComparison: boolean;
    comparisonValid: boolean;
    comparisonConfidence?: number; // 0-1 confidence score
    switchesCompared?: string[];
    switchesFoundInDB?: string[];
    missingSwitches?: string[];
    hasDataGaps?: boolean;
    promptLength?: number;
    retrievalNotes?: string[];
    error?: string; // For failed comparisons
  };
}
```

## Frontend Implementation Recommendations

### 1. Detection and UI Adaptation

```typescript
// Detect comparison responses
const isComparison = response.metadata?.isComparison || false;

if (isComparison && response.metadata?.comparisonValid) {
  // Render comparison UI
  renderComparisonResponse(response);
} else if (isComparison && !response.metadata?.comparisonValid) {
  // Handle comparison errors
  renderComparisonError(response);
} else {
  // Standard chat response
  renderStandardResponse(response);
}
```

### 2. Comparison-Specific UI Components

#### Enhanced Message Styling
```css
.comparison-message {
  border-left: 4px solid #3b82f6; /* Blue accent for comparisons */
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  padding: 20px;
  margin: 16px 0;
  border-radius: 12px;
}

.comparison-badge {
  display: inline-block;
  background: #3b82f6;
  color: white;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 12px;
}
```

#### Comparison Metadata Display
```tsx
interface ComparisonMetadata {
  confidence: number;
  switchesCompared: string[];
  hasDataGaps: boolean;
}

const ComparisonMetadataBar: React.FC<ComparisonMetadata> = ({
  confidence,
  switchesCompared,
  hasDataGaps
}) => (
  <div className="comparison-metadata">
    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
      <span className="flex items-center gap-1">
        <CheckCircleIcon className="w-4 h-4 text-green-500" />
        {switchesCompared.length} switches compared
      </span>
      <span className="flex items-center gap-1">
        <TargetIcon className="w-4 h-4 text-blue-500" />
        {Math.round(confidence * 100)}% confidence
      </span>
      {hasDataGaps && (
        <span className="flex items-center gap-1">
          <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />
          Some data from general knowledge
        </span>
      )}
    </div>
  </div>
);
```

### 3. Markdown Rendering Enhancements

#### Table Styling for Technical Specifications
```css
.comparison-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.comparison-content th {
  background: #f8fafc;
  font-weight: 600;
  text-align: left;
  padding: 12px 16px;
  border-bottom: 2px solid #e2e8f0;
}

.comparison-content td {
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
}

.comparison-content tr:last-child td {
  border-bottom: none;
}

/* Alternate row colors for better readability */
.comparison-content tbody tr:nth-child(even) {
  background: #fafbfc;
}
```

#### Section-Specific Styling
```css
/* Header styling */
.comparison-content h2 {
  color: #1e293b;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 3px solid #3b82f6;
}

.comparison-content h3 {
  color: #334155;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 24px 0 12px 0;
}

.comparison-content h4 {
  color: #475569;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 20px 0 8px 0;
}

/* Conclusion section highlight */
.comparison-content h3:contains("Conclusion") {
  color: #059669;
  border-left: 4px solid #10b981;
  padding-left: 12px;
}
```

## Expected Markdown Structure

### Document Structure Overview
```markdown
## Switch Comparison: [Switch Names]
### Overview
### Technical Specifications
### In-Depth Analysis
#### Housing Materials
#### Force & Weighting  
#### Travel & Actuation
#### Sound Profile
#### Feel & Tactility
#### Use Case Suitability
### Typing Experience Summary
### Conclusion
```

### Technical Specifications Table Format
```markdown
| Specification | Switch 1 | Switch 2 | Switch 3 |
|---------------|----------|----------|----------|
| Manufacturer  | Gateron  | Cherry   | Kailh    |
| Type          | Linear   | Linear   | Tactile  |
| Actuation Force (g) | 55g | 45g   | 60g      |
| Bottom-out Force (g) | 65g | 75g  | 70g      |
| Pre-travel (mm) | 2.0mm | 2.0mm | 1.9mm    |
| Total Travel (mm) | 4.0mm | 4.0mm | 3.8mm   |
```

## Error Handling

### Comparison Errors
```typescript
interface ComparisonError {
  type: 'insufficient_switches' | 'no_switches_found' | 'low_confidence_match' | 'service_error';
  message: string;
  suggestions?: string[];
}

const handleComparisonError = (response: ChatResponse): ComparisonError => {
  const errorType = response.metadata?.error;
  
  switch (errorType) {
    case 'insufficient_switches':
      return {
        type: 'insufficient_switches',
        message: 'I need at least two switches to make a comparison.',
        suggestions: ['Try: "Compare Cherry MX Red vs Blue"', 'Or: "Gateron Oil King versus Holy Panda"']
      };
    
    case 'no_switches_found':
      return {
        type: 'no_switches_found', 
        message: 'I couldn\'t find the switches you mentioned in our database.',
        suggestions: ['Check spelling of switch names', 'Try popular switches like "Cherry MX Red" or "Gateron Yellow"']
      };
    
    case 'low_confidence_match':
      return {
        type: 'low_confidence_match',
        message: 'I found some potential matches but with low confidence.',
        suggestions: ['Be more specific with switch names', 'Include manufacturer names (e.g., "Cherry MX" or "Gateron")']
      };
    
    default:
      return {
        type: 'service_error',
        message: 'Unable to generate comparison at this time.',
        suggestions: ['Try again in a moment', 'Contact support if the issue persists']
      };
  }
};
```

### Error UI Components
```tsx
const ComparisonError: React.FC<{ error: ComparisonError }> = ({ error }) => (
  <div className="comparison-error">
    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
      <ExclamationCircleIcon className="w-5 h-5 text-red-500 mt-0.5" />
      <div>
        <h4 className="text-red-800 font-medium">Comparison Not Available</h4>
        <p className="text-red-700 text-sm mt-1">{error.message}</p>
        {error.suggestions && (
          <div className="mt-3">
            <p className="text-red-700 text-sm font-medium">Try these examples:</p>
            <ul className="list-disc list-inside text-red-600 text-sm mt-1">
              {error.suggestions.map((suggestion, i) => (
                <li key={i}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  </div>
);
```

## Performance Considerations

### Markdown Rendering Optimization
```typescript
// Memoize markdown rendering for large comparison responses
const MemoizedMarkdown = React.memo(({ content }: { content: string }) => {
  return <ReactMarkdown className="comparison-content">{content}</ReactMarkdown>;
});

// Lazy load comparison-specific styles
const useComparisonStyles = () => {
  React.useEffect(() => {
    import('./styles/comparison.css');
  }, []);
};
```

### Response Caching
```typescript
// Cache comparison responses for better UX
const comparisonCache = new Map<string, ChatResponse>();

const getCachedComparison = (query: string): ChatResponse | null => {
  const normalizedQuery = query.toLowerCase().trim();
  return comparisonCache.get(normalizedQuery) || null;
};

const cacheComparison = (query: string, response: ChatResponse) => {
  if (response.metadata?.isComparison && response.metadata?.comparisonValid) {
    const normalizedQuery = query.toLowerCase().trim();
    comparisonCache.set(normalizedQuery, response);
  }
};
```

## Analytics and Tracking

### Comparison Event Tracking
```typescript
// Track comparison usage for analytics
const trackComparisonEvent = (eventType: string, metadata: any) => {
  analytics.track('Comparison Event', {
    type: eventType,
    switchesCompared: metadata.switchesCompared?.length || 0,
    confidence: metadata.comparisonConfidence,
    hasDataGaps: metadata.hasDataGaps,
    timestamp: new Date().toISOString()
  });
};

// Usage examples:
trackComparisonEvent('comparison_generated', response.metadata);
trackComparisonEvent('comparison_error', { error: errorType });
trackComparisonEvent('comparison_viewed', { switchesCompared: switches });
```

## Testing Recommendations

### Component Testing
```typescript
// Test comparison detection
test('detects comparison responses correctly', () => {
  const comparisonResponse = {
    metadata: { isComparison: true, comparisonValid: true }
  };
  
  render(<ChatMessage response={comparisonResponse} />);
  expect(screen.getByText('Comparison')).toBeInTheDocument();
});

// Test error handling  
test('handles comparison errors gracefully', () => {
  const errorResponse = {
    metadata: { 
      isComparison: true, 
      comparisonValid: false,
      error: 'insufficient_switches'
    }
  };
  
  render(<ChatMessage response={errorResponse} />);
  expect(screen.getByText(/need at least two switches/i)).toBeInTheDocument();
});
```

### Visual Testing
```typescript
// Storybook stories for comparison components
export const DefaultComparison = () => (
  <ChatMessage response={mockComparisonResponse} />
);

export const ComparisonWithDataGaps = () => (
  <ChatMessage response={mockComparisonWithGaps} />
);

export const ComparisonError = () => (
  <ChatMessage response={mockComparisonError} />
);
```

## Migration Guidelines

### Backward Compatibility
- All existing chat functionality remains unchanged
- No breaking changes to API contracts
- Gradual UI enhancement rollout recommended

### Deployment Strategy
1. **Phase 1**: Deploy backend changes with feature flag
2. **Phase 2**: Update frontend to detect comparison responses  
3. **Phase 3**: Enhance UI styling and error handling
4. **Phase 4**: Add analytics and performance optimizations

## Support and Troubleshooting

### Common Issues
- **Markdown not rendering**: Ensure ReactMarkdown supports table syntax
- **Styling inconsistencies**: Import comparison-specific CSS
- **Performance issues**: Implement response caching and component memoization

### Debug Information
```typescript
// Debug comparison responses in development
if (process.env.NODE_ENV === 'development' && response.metadata?.isComparison) {
  console.group('Comparison Debug Info');
  console.log('Confidence:', response.metadata.comparisonConfidence);
  console.log('Switches compared:', response.metadata.switchesCompared);
  console.log('Data gaps:', response.metadata.hasDataGaps);
  console.log('Retrieval notes:', response.metadata.retrievalNotes);
  console.groupEnd();
}
```

---

**Questions or Issues?** Contact the backend team for clarification on comparison response structure or metadata fields. All comparison functionality is thoroughly tested and documented in the Postman collection at `/tasks/postman_collections/`. 