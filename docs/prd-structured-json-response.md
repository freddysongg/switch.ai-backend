# Product Requirements Document: Structured JSON Response System

## Introduction/Overview

Currently, the SwitchAI `/api/chat` endpoint returns responses with markdown content in a `content` field, which makes it challenging for the frontend to parse specific sections and render custom UI components. This feature will restructure the response to provide a structured JSON object in the `content` field, enabling the frontend to easily extract specific sections (like "Overview", "Technical Specifications", "Conclusion") and render them with custom component designs.

**Problem**: Frontend teams cannot easily parse markdown content to extract specific sections for custom UI rendering, leading to limited design flexibility and poor component-based architecture.

**Goal**: Transform the current markdown-based `content` field into a structured JSON object that allows frontend components to directly access specific sections and data for optimal UI rendering.

## Goals

1. **Enable Component-Based Rendering**: Allow frontend to render different sections using custom React/Vue components
2. **Improve Data Accessibility**: Make specific data fields (switch names, specs, etc.) easily accessible without markdown parsing
3. **Maintain Content Quality**: Preserve all existing information and formatting capabilities
4. **Support All Response Types**: Handle switch comparisons, characteristics explanations, material analyses, and standard queries
5. **Ensure Backward Compatibility**: Provide migration path for existing frontend implementations

## User Stories

1. **As a frontend developer**, I want to access the "Overview" section directly as `response.content.overview` so that I can render it in a custom card component without parsing markdown.

2. **As a frontend developer**, I want technical specifications as structured data so that I can render them in a beautiful comparison table without extracting data from markdown tables.

3. **As a frontend developer**, I want to detect response types from the JSON structure so that I can conditionally render different UI layouts (comparison cards vs educational content vs standard responses).

4. **As a UI/UX designer**, I want different content sections available as separate data fields so that I can design custom layouts for each section type.

5. **As a frontend developer**, I want switch names and metadata as structured fields so that I can create interactive elements and links without text parsing.

## Functional Requirements

### Core JSON Structure

1. **The system must** replace the current `content: string` with `content: object` in API responses.

2. **The system must** provide different JSON structures based on response type:
   - Switch Comparisons
   - Characteristics Explanations  
   - Material Analyses
   - Standard RAG Responses

3. **The system must** preserve all existing information currently available in markdown format.

4. **The system must** maintain text formatting using markdown syntax within text fields.

5. **The system must** convert markdown tables to structured JSON arrays/objects.

### Switch Comparison Response Structure

6. **The system must** provide the following fields for switch comparison responses:
   ```javascript
   {
     "type": "switch_comparison",
     "overview": "markdown_text",
     "technicalSpecs": {
       "switches": [
         {
           "name": "Switch Name",
           "manufacturer": "Manufacturer", 
           "type": "Linear|Tactile|Clicky",
           "actuationForce": "45g",
           "bottomOutForce": "60g",
           "preTravel": "2.0mm",
           "totalTravel": "4.0mm",
           "topHousing": "PC",
           "bottomHousing": "Nylon",
           "stem": "POM",
           "spring": "Steel",
           "mount": "PCB",
           "factoryLubed": "Yes|No|Partial"
         }
       ]
     },
     "analysis": {
       "housingMaterials": "markdown_text",
       "forceAndWeighting": "markdown_text", 
       "travelAndActuation": "markdown_text",
       "soundProfile": "markdown_text",
       "feelAndTactility": "markdown_text",
       "useCaseSuitability": "markdown_text"
     },
     "typingExperience": "markdown_text",
     "conclusion": "markdown_text",
     "switchNames": ["Switch 1", "Switch 2"],
     "comparisonType": "detailed"
   }
   ```

### Characteristics Explanation Response Structure

7. **The system must** provide the following fields for characteristics explanation responses:
   ```javascript
   {
     "type": "characteristics_explanation",
     "title": "Understanding Smooth vs Clicky Characteristics",
     "characteristics": ["smooth", "clicky"],
     "overview": "markdown_text",
     "characteristicDetails": [
       {
         "name": "smooth",
         "explanation": "markdown_text",
         "mechanisms": "markdown_text"
       }
     ],
     "materialScience": "markdown_text",
     "soundAndFeel": "markdown_text", 
     "typingExperience": "markdown_text",
     "examples": [
       {
         "characteristic": "smooth",
         "switches": [
           {
             "name": "Switch Name",
             "manufacturer": "Manufacturer",
             "description": "Why it exemplifies this characteristic"
           }
         ]
       }
     ],
     "choosingGuidance": "markdown_text"
   }
   ```

### Material Analysis Response Structure

8. **The system must** provide the following fields for material analysis responses:
   ```javascript
   {
     "type": "material_analysis", 
     "title": "Understanding PC vs Nylon Housing Materials",
     "materials": ["polycarbonate", "nylon"],
     "overview": "markdown_text",
     "materialDetails": [
       {
         "name": "polycarbonate",
         "properties": "markdown_text",
         "soundProfile": "markdown_text",
         "feelCharacteristics": "markdown_text",
         "useCases": "markdown_text"
       }
     ],
     "materialScience": "markdown_text",
     "soundAndFeelComparison": "markdown_text",
     "examples": [
       {
         "material": "polycarbonate", 
         "switches": [
           {
             "name": "Switch Name",
             "manufacturer": "Manufacturer",
             "housingDetails": "Top: PC, Bottom: Nylon"
           }
         ]
       }
     ],
     "choosingGuidance": "markdown_text"
   }
   ```

### Standard RAG Response Structure

9. **The system must** provide the following fields for standard RAG responses:
   ```javascript
   {
     "type": "standard_response",
     "content": "markdown_text",
     "relevantSwitches": [
       {
         "name": "Switch Name",
         "relevanceScore": 0.95,
         "context": "Why this switch is relevant"
       }
     ]
   }
   ```

### Text Formatting and Data Handling

10. **The system must** preserve markdown formatting within text fields for styling (bold, italic, lists, etc.).

11. **The system must** convert markdown tables to structured arrays where applicable.

12. **The system must** extract switch names, manufacturers, and technical specs as structured data fields.

13. **The system must** maintain line breaks and paragraph structure using markdown syntax.

## Non-Goals (Out of Scope)

1. **HTML Conversion**: Will not convert markdown to HTML - frontend can handle markdown rendering
2. **Rich Text Objects**: Will not create complex nested objects for text styling - markdown is sufficient
3. **Backward Compatibility Layer**: Will not maintain dual response formats (old + new)
4. **Image/Media Support**: Will not add structured support for images or media content
5. **Real-time Updates**: Will not add websocket or streaming support for progressive JSON building
6. **Response Compression**: Will not add compression or optimization of JSON structure size

## Technical Considerations

1. **Integration with Existing Services**: Should integrate with current `ChatService`, `PromptBuilder`, and comparison services
2. **Response Parser Service**: Will need a new service to parse Gemini markdown responses into structured JSON
3. **Type Safety**: Should provide TypeScript interfaces for all response structures
4. **Error Handling**: Must handle cases where markdown parsing fails or content doesn't match expected structure
5. **Performance**: JSON parsing and structuring should not significantly increase response times
6. **Testing**: Will need comprehensive tests for different content types and edge cases

## Success Metrics

1. **Frontend Development Speed**: Reduce time to implement new UI components by 60%
2. **Code Maintainability**: Eliminate frontend markdown parsing code in favor of direct property access
3. **UI Design Flexibility**: Enable custom component designs for each content section  
4. **Response Consistency**: Achieve 100% successful JSON parsing for all response types
5. **Performance Impact**: Keep JSON structuring overhead under 100ms per response

## Open Questions

1. **Fallback Strategy**: How should the system handle cases where Gemini response doesn't match expected markdown structure?
2. **Nested Content**: How should we handle deeply nested content within analysis sections?
3. **Custom Formatting**: Should we support custom formatting tags beyond standard markdown?
4. **Dynamic Sections**: How should we handle responses that might have additional or missing sections?
5. **Validation**: Do we need JSON schema validation for the structured responses?
6. **Migration Timeline**: What's the rollout plan for frontend teams to adopt the new JSON structure? 