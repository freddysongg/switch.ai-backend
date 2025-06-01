# PRD: Enhanced Switch Comparison System

## Introduction/Overview

The current SwitchAI comparison feature relies heavily on embedding-based matching, resulting in poor switch identification accuracy and bland, generic responses. This enhancement will transform the system into an intelligent mechanical keyboard advisor that leverages AI's natural language understanding capabilities combined with rich material and sound context to provide expert-level switch comparisons.

**Problem Statement**: Users receive incorrect switch matches (e.g., "Cherry MX Red" → "Cherry MX Low Profile Red") and generic responses lacking the descriptive richness expected by keyboard enthusiasts. The system treats embedding similarity as authoritative rather than using AI's contextual understanding.

**Solution Goal**: Create a multi-stage switch resolution system with rich material context that provides accurate, enthusiast-oriented responses rivaling commercial comparison tools like Milktooth.

## Goals

1. **Improve Switch Identification Accuracy**: Achieve reliable switch resolution for common queries through multi-stage matching
2. **Enhanced Response Quality**: Generate descriptive, enthusiast-oriented content using "keeb nerd" terminology (thocky, clacky, buttery smooth)
3. **Leverage AI Capabilities**: Use Gemini's natural language understanding for contextual switch resolution and general knowledge inference
4. **Rich Material Context**: Provide detailed analysis of how housing materials, stems, and springs affect sound and feel
5. **Flexible Fallback System**: Handle missing database entries gracefully using AI's general knowledge
6. **Professional Yet Enthusiastic Tone**: Maintain technical accuracy while using community-accepted terminology

## User Stories

**As a keyboard beginner**, I want to understand the differences between Cherry MX Red, Brown, and Blue switches so that I can choose the right switch type for my first mechanical keyboard.

**As an experienced enthusiast**, I want detailed analysis of housing materials and their impact on sound profile so that I can make informed decisions for my custom builds.

**As a content creator**, I want comprehensive, quotable comparisons with rich descriptive language so that I can create engaging reviews and recommendations.

**As a casual user exploring options**, I want the system to understand my query even when I use informal language ("red vs brown") so that I get relevant comparisons without perfect switch name formatting.

**As any user**, I want the system to provide useful information even for switches not in the database, using general AI knowledge when needed.

## Functional Requirements

### FR1: Multi-Stage Switch Resolution System
1.1. **Intent-Aware Parsing**: Use Gemini 2.0 Flash to parse user queries and extract intended switches before database lookup
1.2. **Contextual Brand Completion**: Handle implicit brand references (e.g., "red vs brown vs blue" → "Cherry MX Red vs Cherry MX Brown vs Cherry MX Blue")
1.3. **Tiered Matching Strategy**: Implement four-stage matching:
   - Primary: Exact name matching (confidence 0.95+)
   - Secondary: Fuzzy matching with brand/type context (confidence 0.80+)
   - Tertiary: Embedding similarity with reduced importance (confidence 0.65+)
   - Quaternary: AI-assisted disambiguation and general knowledge fallback
1.4. **Confidence Validation**: Cross-validate all matches against original user intent

### FR2: Material-Sound Context System
2.1. **Housing Material Context**: Provide predefined characteristics for common materials:
   - **Nylon**: Deeper, fuller sound; dampened resonance; "thocky" characteristics; muted housing collisions
   - **Polycarbonate**: Sharper, crisper sound; higher pitch; "clacky" characteristics; thinner, sharper housing collisions
   - **POM**: Lowest sound profile; smooth characteristics; self-lubricating properties
2.2. **Stem Material Context**: Define characteristics for stem materials:
   - **POM**: Smooth feel, reduced scratch, low coefficient of friction, consistent sound
   - **POK**: Enhanced smoothness, premium feel characteristics
   - **UHMWPE**: Ultra-smooth, enhanced acoustics
2.3. **Spring Weight Context**: Provide typing implications:
   - **Light (35-50g)**: Fast, effortless keystrokes; suitable for gaming; potential fatigue reduction; risk of accidental presses
   - **Medium (50-65g)**: Balanced feel; good for mixed use; moderate fatigue
   - **Heavy (65g+)**: Deliberate typing; reduced typos; potential increased fatigue; preferred by some typists

### FR3: Dynamic Prompt Context Injection
3.1. **Material Context Injection**: Automatically inject relevant material characteristics based on switches being compared
3.2. **Use Case Context**: Add context based on query implications (gaming, typing, office use)
3.3. **Sound Descriptor Database**: Include community-accepted terminology (clacky, thocky, poppy, scratchy, buttery smooth, crisp)

### FR4: Enhanced Response Generation
4.1. **Enthusiast Language**: Use community terminology while remaining accessible to beginners
4.2. **Descriptive Sensory Language**: Replace generic terms with vivid descriptions:
   - "linear switch" → "buttery smooth keystroke with no tactile interruption"
   - "45g actuation" → "light 45g actuation force suitable for fast typing and reduced finger fatigue"
4.3. **Purchase Guidance**: Provide contextual recommendations based on user's stated preferences or implied use case
4.4. **Structured Analysis**: Maintain existing section structure (Overview, Technical Specs, In-Depth Analysis, Conclusion)

### FR5: Graceful Fallback System
5.1. **Missing Switch Handling**: Use AI general knowledge for switches not in database with clear attribution
5.2. **Attribution Templates**: Use consistent phrases for general knowledge:
   - "Based on general community understanding..."
   - "Typically, switches with these characteristics..."
   - "For [Switch Name], general information suggests..."
5.3. **Transparent Source Indication**: Clearly distinguish between database facts and general knowledge

### FR6: Integration with Existing System
6.1. **Preserve Existing Prompt Structure**: Maintain compatibility with current identity.txt and prompt building approach
6.2. **Enhance PromptBuilder**: Extend buildComparisonPrompt() with new context injection capabilities
6.3. **Backward Compatibility**: Ensure existing functionality remains intact during transition

## Non-Goals (Out of Scope)

- Complete rewrite of the existing database schema or chat service architecture
- Real-time web scraping for switch information
- User authentication or personalization features
- Integration with e-commerce platforms for purchasing
- Advanced analytics or usage tracking beyond basic success measurement
- Support for non-switch keyboard components (keycaps, stabilizers, plates)
- Multi-language support beyond English

## Technical Considerations

### Architecture Changes
- **New Service**: `SwitchResolutionService` for multi-stage matching logic
- **Enhanced Service**: `MaterialContextService` for material property management
- **Modified Service**: Enhanced `PromptBuilder.buildComparisonPrompt()` with context injection
- **Configuration**: New `COMPARISON_CONFIG` object in ai.config.ts for thresholds and strategies

### Material Context Implementation
Material properties will be hardcoded in a structured format within the application for easy modification:

```typescript
const MATERIAL_PROPERTIES = {
  housing: {
    nylon: {
      sound: ["deeper", "fuller", "thocky", "muted", "dampened resonance"],
      feel: ["firm", "stable"],
      frequency: "lower"
    },
    polycarbonate: {
      sound: ["sharper", "crisper", "clacky", "higher pitch", "thinner"],
      feel: ["resonant", "bright"],
      frequency: "higher"
    },
    // ... additional materials
  },
  stem: {
    pom: {
      feel: ["smooth", "consistent", "low friction"],
      sound: ["quiet", "stable"],
      characteristics: ["self-lubricating", "durable"]
    }
    // ... additional stem materials
  }
}
```

### Integration Points
- Maintain compatibility with existing ChatService.processMessage() flow
- Preserve current conversation history and metadata structures
- Enhance existing prompt building without breaking current functionality

## Success Metrics

### Qualitative Metrics (Developer/Owner Testing)
1. **Switch Resolution Accuracy**: Developer assessment of correct switch identification for test queries
2. **Response Quality**: Comparison against Milktooth/competitor examples for descriptive richness
3. **Terminology Usage**: Appropriate use of enthusiast terminology (thocky, clacky, buttery smooth)
4. **Contextual Understanding**: System's ability to handle implicit brand references and casual language

### Quantitative Metrics
1. **Confidence Score Distribution**: Track confidence scores across different matching strategies
2. **Fallback Usage**: Monitor frequency of AI general knowledge usage vs database lookups
3. **Response Completeness**: Ensure all required sections are generated consistently
4. **Error Rate**: Track system errors and fallback message frequency

### User Experience Indicators
1. **Response Comprehensiveness**: All comparison sections populated with meaningful content
2. **Technical Accuracy**: Specifications correctly sourced from database with clear attribution
3. **Beginner Accessibility**: Technical terms explained appropriately for new users
4. **Expert Depth**: Sufficient detail and nuance for experienced enthusiasts

## Implementation Phases

### Phase 1: Material Context Foundation (Priority 1)
- Implement MATERIAL_PROPERTIES data structure
- Create MaterialContextService for context injection
- Enhance PromptBuilder with material context capabilities
- Test with existing switch comparisons to validate improved descriptive language

### Phase 2: Switch Resolution Enhancement (Priority 1)
- Implement SwitchResolutionService with multi-stage matching
- Add AI-powered query parsing for intent extraction
- Implement tiered confidence scoring system
- Test switch identification accuracy with problematic queries

### Phase 3: Integration and Refinement
- Integrate both services into main ChatService flow
- Implement graceful fallback with general knowledge attribution
- Add configuration management for thresholds and strategies
- Conduct comprehensive testing across query types

### Phase 4: Quality Assurance and Optimization
- Fine-tune confidence thresholds based on testing results
- Optimize prompt context injection for response quality
- Validate enthusiast terminology usage and technical accuracy
- Performance testing and optimization

## Open Questions

1. **Material Property Validation**: Should we validate hardcoded material properties against community sources before implementation?
2. **Confidence Threshold Tuning**: What specific test queries should we use to calibrate the confidence thresholds?
3. **General Knowledge Boundaries**: Are there specific types of switch information we should avoid inferring with general knowledge?
4. **Response Length Management**: How do we balance comprehensive analysis with the existing 1500 token limit?
5. **Brand Disambiguation**: How should we handle cases where multiple manufacturers make switches with similar names?
6. **Context Persistence**: Should material context knowledge persist across conversation turns for related queries? 