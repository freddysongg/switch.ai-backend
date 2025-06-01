# SwitchAI Enhanced Comparisons - Comprehensive Test Plan

## Overview

This document outlines the comprehensive test plan for validating the enhanced switch comparison functionality in SwitchAI. The test cases are designed to validate against PRD acceptance criteria (FR1-FR16) and ensure robust performance across various scenarios.

## Test Environment Setup

**Base URL**: `http://localhost:3000` (or your configured backend port)  
**Endpoint**: `POST /api/chat`  
**Authentication**: Bearer token required in Authorization header  

### Required Headers
```
Content-Type: application/json
Authorization: Bearer {your_jwt_token}
```

### Request Body Format
```json
{
  "message": "Your comparison query here",
  "conversationId": "optional-conversation-id"
}
```

## Test Categories

### Category 1: Basic Two-Switch Comparisons (FR1, FR2, FR4)

#### Test Case 1.1: Perfect Match - Popular Linear Switches
**Query**: `"Compare Gateron Oil King vs Cherry MX Red"`
**Expected Behavior**:
- Detects comparison intent (confidence ≥ 0.5)
- Extracts both switch names accurately
- Retrieves complete data for both switches from database
- Generates structured Markdown comparison with all required sections

**Expected Response Structure**:
```markdown
## Switch Comparison: Gateron Oil King vs Cherry MX Red

### Overview
[Brief comparison summary addressing primary differences]

### Technical Specifications
| Specification | Gateron Oil King | Cherry MX Red |
|---------------|------------------|---------------|
| Manufacturer  | Gateron         | Cherry        |
| Type          | Linear          | Linear        |
[Complete specifications table]

### In-Depth Analysis

#### Housing Materials
[Detailed analysis of housing differences]

#### Force & Weighting
[Force profile comparison with specific numbers]

#### Travel & Actuation
[Travel distance and actuation point analysis]

#### Sound Profile
[Sound characteristics comparison]

#### Feel & Tactility
[Tactile experience description]

#### Use Case Suitability
[Gaming vs typing recommendations]

### Typing Experience Summary
[Overall typing experience comparison]

### Conclusion
[Final recommendation with specific use case guidance]
```

**Validation Criteria**:
- Response contains all H2 sections per FR9
- Technical specifications table is complete (FR4)
- Markdown formatting follows FR11 standards
- Response length ≤ 1500 tokens (FR15)

#### Test Case 1.2: Popular Tactile vs Linear
**Query**: `"What's the difference between Holy Panda and Gateron Yellow?"`
**Expected Behavior**: Similar to 1.1 with cross-type comparison analysis

#### Test Case 1.3: Brand-Specific Comparison
**Query**: `"Akko CS Rose Red vs Akko CS Wine Red comparison"`
**Expected Behavior**: Same-brand comparison with subtle difference focus

### Category 2: Three-Switch Comparisons (FR3)

#### Test Case 2.1: Mixed Switch Types
**Query**: `"Compare Cherry MX Blue vs Brown vs Red"`
**Expected Behavior**:
- Processes 3-switch comparison optimally
- Generates comparison with clear three-way analysis
- Maintains structured format with expanded tables

#### Test Case 2.2: Linear Switch Trio
**Query**: `"Gateron Oil King vs Novelkeys Cream vs Kailh Red comparison"`
**Expected Behavior**: Detailed linear switch comparison with nuanced differences

### Category 3: Missing Data Handling (FR5, FR6)

#### Test Case 3.1: Partial Database Coverage
**Query**: `"Compare Gateron Oil King vs UnknownSwitch2024"`
**Expected Behavior**:
- Finds Gateron Oil King in database
- Cannot find UnknownSwitch2024
- Uses general knowledge for unknown switch with proper attribution
- Marks uncertain information clearly

**Expected Attribution Examples**:
- "Based on general community understanding..."
- "According to typical specifications for this switch type..."
- "N/A" for unavailable specific data

#### Test Case 3.2: Incomplete Database Records
**Query**: Use switches known to have missing fields in database
**Expected Behavior**:
- Shows "N/A" for missing database fields
- Notes missing data in analysis sections
- Maintains comparison quality with available data

### Category 4: Variable Switch Handling (FR2, Edge Cases)

#### Test Case 4.1: Single Switch (Invalid Comparison)
**Query**: `"Tell me about Cherry MX Blue vs"`
**Expected Response**: User feedback requesting additional switch for comparison

#### Test Case 4.2: Too Many Switches (4+ extraction)
**Query**: `"Compare Cherry MX Red vs Blue vs Brown vs Black vs Green vs White"`
**Expected Behavior**:
- Intelligent filtering to 3 optimal switches
- User notification about filtering
- Maintains high-quality comparison

#### Test Case 4.3: No Switches Detected
**Query**: `"What's better for gaming?"`
**Expected Response**: Not detected as comparison, uses standard RAG

### Category 5: Pattern Recognition & Intent Detection

#### Test Case 5.1: Various Comparison Patterns
**Queries to test**:
- `"Gateron Oil King versus Cherry MX Red"`
- `"difference between Kailh Brown and Cherry Brown"`
- `"which is better: Gateron Yellow or Red?"`
- `"Holy Panda or Glorious Panda for typing?"`

#### Test Case 5.2: Complex Query Patterns
**Query**: `"I'm deciding between the Gateron Oil King, which I hear is smooth, and the Cherry MX Red for my new gaming setup"`
**Expected Behavior**: Extracts both switches despite complex sentence structure

### Category 6: Embedding-Based Matching & Confidence

#### Test Case 6.1: Fuzzy Name Matching
**Query**: `"gateron oil kings vs cherry red mx"`
**Expected Behavior**:
- Embedding service matches to correct switch names
- High confidence matches (≥ 0.5)
- Proper attribution of matched names in metadata

#### Test Case 6.2: Low Confidence Handling
**Query**: Use deliberately ambiguous switch names
**Expected Behavior**: 
- Low confidence detection (< 0.5)
- User feedback for clarification
- No invalid comparison generation

### Category 7: Error Handling & Fallbacks (FR14)

#### Test Case 7.1: Database Connectivity Issues
**Simulation**: Temporarily disable database connection
**Expected Response**: Graceful degradation with user-friendly error message

#### Test Case 7.2: Embedding Service Failure
**Simulation**: Mock embedding service failure
**Expected Behavior**: Fallback to direct name matching with reduced confidence

#### Test Case 7.3: LLM Generation Failure
**Simulation**: Mock Gemini API failure
**Expected Response**: Fallback error message per AI_CONFIG

### Category 8: Response Quality & Structure (FR9, FR11, FR15)

#### Test Case 8.1: Markdown Formatting Validation
**Validation Points**:
- Proper H2/H3 header hierarchy
- Correctly formatted tables with alignment
- Bold/italic text usage
- List formatting consistency
- No broken Markdown syntax

#### Test Case 8.2: Content Quality Assessment
**Manual Validation Criteria**:
- Technical accuracy of specifications
- Logical flow between sections
- Actionable recommendations in conclusion
- Appropriate use of technical terminology
- Balanced analysis without bias

#### Test Case 8.3: Token Limit Compliance
**Validation**: All responses must be ≤ 1500 tokens (FR15)

### Category 9: Conversation Context & History

#### Test Case 9.1: Multi-Turn Comparison Discussion
**Sequence**:
1. Initial comparison request
2. Follow-up questions about specific aspects
3. Request for additional switch to compare

**Expected Behavior**: Maintains context and builds on previous comparisons

### Category 10: Edge Cases & Boundary Testing

#### Test Case 10.1: Special Characters in Switch Names
**Query**: Include switches with special characters/Unicode

#### Test Case 10.2: Very Long Query
**Query**: Test with queries approaching token limits

#### Test Case 10.3: Multiple Languages
**Query**: Test with non-English switch names where applicable

## Success Criteria

### Functional Requirements Validation
- **FR1**: ✅ Automated comparison intent detection
- **FR2**: ✅ Variable switch handling (1-3+ switches)
- **FR3**: ✅ Three-switch comparison support
- **FR4**: ✅ Complete technical specifications
- **FR5**: ✅ Missing data handling with N/A
- **FR6**: ✅ General knowledge attribution
- **FR9**: ✅ All required sections present
- **FR11**: ✅ Proper Markdown formatting
- **FR14**: ✅ Error handling and fallbacks
- **FR15**: ✅ Token limit compliance (≤1500)

### Performance Metrics
- Response time: < 10 seconds for typical comparisons
- Accuracy rate: > 95% for switch name extraction
- Confidence threshold: ≥ 0.5 for valid comparisons
- Embedding match quality: > 85% success rate

### Quality Metrics
- Markdown syntax validity: 100%
- Required sections presence: 100%
- Technical accuracy: Manual assessment required
- User experience: Qualitative assessment

## Test Execution Plan

### Phase 1: Automated Structure Validation
- Run all test cases through Postman collection
- Validate JSON response structure
- Check HTTP status codes
- Verify response times

### Phase 2: Content Quality Assessment
- Manual review of generated comparisons
- Technical accuracy verification
- Markdown rendering validation
- User experience evaluation

### Phase 3: Edge Case & Error Testing
- Simulate failure conditions
- Test boundary cases
- Validate fallback mechanisms
- Assess error message quality

### Phase 4: Integration & Regression Testing
- Test in context of full application
- Validate conversation history handling
- Check for any regressions in standard RAG functionality

## Documentation & Reporting

### Test Results Documentation
- Pass/fail status for each test case
- Response time measurements
- Content quality assessments
- Identified issues and resolutions

### Recommendations for Improvement
Based on test results, document:
- Prompt refinements needed
- Logic adjustments required
- Performance optimizations
- User experience enhancements

---

*This test plan ensures comprehensive validation of the enhanced comparison functionality against all PRD requirements and real-world usage scenarios.* 