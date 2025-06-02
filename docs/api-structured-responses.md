# Structured JSON Response API Documentation

## Overview

The SwitchAI backend now returns structured JSON responses instead of raw markdown strings. This provides consistent, parseable data structures that enable better frontend consumption and improved user experience.

## Base Response Structure

All responses follow the base `StructuredContent` format:

```typescript
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

### Error Handling

When parsing fails, the response includes error information:

```typescript
interface ErrorInfo {
  errorType: string;
  errorMessage: string;
  timestamp: string;
  markdownLength: number;
  hasBasicStructure?: any;
}
```

## Response Types

### 1. Switch Comparison Response

**Response Type**: `switch_comparison`

Used for comparing mechanical switches with detailed analysis.

#### Schema

```typescript
interface SwitchComparisonResponse {
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
    recommendations: {
      general: string;
      [useCase: string]: string;
    };
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

interface TechnicalSpecSwitch {
  name: string;
  manufacturer: string;
  type: string | null;
  actuationForce: string | null;
  bottomOutForce: string | null;
  preTravel: string | null;
  totalTravel: string | null;
  mount: string | null;
  topHousing: string | null;
  bottomHousing: string | null;
  stem: string | null;
  spring: string | null;
}

interface AnalysisSection {
  title: string;
  content: string;
  keyPoints?: string[];
}
```

#### Example Response

```json
{
  "responseType": "switch_comparison",
  "data": {
    "title": "Cherry MX Red vs Gateron Yellow Comparison",
    "switchNames": ["Cherry MX Red", "Gateron Yellow"],
    "overview": "Both Cherry MX Red and Gateron Yellow are linear switches designed for gaming and general typing. They offer smooth keystrokes without tactile bumps, making them popular choices for users who prefer consistent actuation.",
    "technicalSpecs": {
      "switches": [
        {
          "name": "Cherry MX Red",
          "manufacturer": "Cherry",
          "type": "Linear",
          "actuationForce": "45g",
          "bottomOutForce": "75g",
          "preTravel": "2.0mm",
          "totalTravel": "4.0mm",
          "mount": "MX",
          "topHousing": "Nylon",
          "bottomHousing": "Nylon",
          "stem": "POM",
          "spring": "Gold-plated"
        },
        {
          "name": "Gateron Yellow",
          "manufacturer": "Gateron",
          "type": "Linear",
          "actuationForce": "50g",
          "bottomOutForce": "80g",
          "preTravel": "2.0mm",
          "totalTravel": "4.0mm",
          "mount": "MX",
          "topHousing": "Polycarbonate",
          "bottomHousing": "Nylon",
          "stem": "POM",
          "spring": "Gold-plated"
        }
      ]
    },
    "analysis": {
      "feelComparison": {
        "title": "Feel Comparison",
        "content": "The Cherry MX Red provides a lighter touch with its 45g actuation force, making it ideal for rapid key presses. The Gateron Yellow, with its 50g actuation force, offers slightly more resistance and a more controlled feel."
      },
      "soundComparison": {
        "title": "Sound Comparison",
        "content": "Both switches are relatively quiet, but the Gateron Yellow tends to have a slightly deeper sound profile compared to the higher-pitched Cherry MX Red."
      },
      "buildQualityComparison": {
        "title": "Build Quality Comparison",
        "content": "Cherry MX switches are known for their durability and consistency, while Gateron switches offer smooth operation and good value for money."
      },
      "performanceComparison": {
        "title": "Performance Comparison",
        "content": "Both excel in gaming applications with Cherry MX Red favoring speed and Gateron Yellow providing better control.",
        "keyPoints": [
          "Gaming: Both excel in gaming applications",
          "Typing: Cherry MX Red for speed, Gateron Yellow for control",
          "Durability: Cherry MX Red rated for 100M+ actuations"
        ]
      }
    },
    "conclusion": {
      "summary": "Both switches are excellent linear options with subtle differences in feel and sound.",
      "recommendations": {
        "general": "Choose based on preferred actuation force and budget",
        "gaming": "Cherry MX Red for lighter touch, Gateron Yellow for better control",
        "typing": "Gateron Yellow provides better feedback",
        "budget": "Gateron Yellow offers better value"
      },
      "keyDifferences": [
        "Actuation force difference (45g vs 50g)",
        "Sound profile variations",
        "Price point differences"
      ]
    },
    "metadata": {
      "switchesCompared": 2,
      "allSwitchesFoundInDatabase": true,
      "sectionsFound": 6,
      "tablesFound": 1,
      "hasDetailedSpecs": true
    }
  },
  "version": "1.0.0",
  "generatedAt": "2024-01-15T10:30:00.000Z"
}
```

### 2. Characteristics Explanation Response

**Response Type**: `characteristics_explanation`

Used for explaining specific switch characteristics or properties.

#### Schema

```typescript
interface CharacteristicsExplanationResponse {
  title: string;
  characteristicsExplained: string[];
  overview: string;
  characteristicDetails: CharacteristicDetail[];
  materialScience?: {
    title: string;
    content: string;
    technicalFactors: string[];
    physicsExplanation?: string;
  };
  examples: {
    title: string;
    content: string;
    switchExamples: ExampleSwitch[];
  };
  practicalImplications: {
    userExperience: string;
    useCaseRecommendations: { [useCase: string]: string };
    keyConsiderations: string[];
  };
  metadata: {
    characteristicsCount: number;
    examplesProvided: number;
    technicalDepth: 'basic' | 'intermediate' | 'advanced';
    sectionsFound?: number;
    hasMaterialScience?: boolean;
  };
}

interface CharacteristicDetail {
  characteristicName: string;
  category: 'feel' | 'sound' | 'technical' | 'build_quality' | 'other';
  explanation: string;
  factors: string[];
  impact: string;
  measurementMethod?: string;
  examples: string[];
}

interface ExampleSwitch {
  name: string;
  manufacturer: string;
  description: string;
}
```

#### Example Response

```json
{
  "responseType": "characteristics_explanation",
  "data": {
    "title": "Understanding Switch Actuation Force",
    "characteristicsExplained": ["actuation force"],
    "overview": "Actuation force refers to the amount of pressure required to register a keystroke. This fundamental characteristic directly impacts typing feel, speed, and fatigue levels.",
    "characteristicDetails": [
      {
        "characteristicName": "Actuation Force",
        "category": "technical",
        "explanation": "The force required to register a key press, typically measured in grams or centinewtons.",
        "factors": [
          "Spring weight and material",
          "Switch mechanism design",
          "Manufacturing tolerances"
        ],
        "impact": "Directly affects typing speed, accuracy, and user fatigue",
        "measurementMethod": "Measured using precision force gauges during switch testing",
        "examples": ["45g for gaming switches", "60g for typing switches", "80g+ for heavy switches"]
      }
    ],
    "materialScience": {
      "title": "Material Science Behind Actuation Force",
      "content": "The actuation force is primarily determined by the spring mechanism within the switch. Different spring weights and materials create varying resistance profiles.",
      "technicalFactors": [
        "Spring steel alloy composition",
        "Spring coil diameter and pitch",
        "Heat treatment processes"
      ],
      "physicsExplanation": "Hooke's law governs the relationship between spring compression and force required"
    },
    "examples": {
      "title": "Examples of Different Actuation Forces",
      "content": "Common actuation forces range from 35g for ultra-light switches to 100g+ for heavy tactile switches.",
      "switchExamples": [
        {
          "name": "Cherry MX Red",
          "manufacturer": "Cherry",
          "description": "45g actuation force - Ideal for gaming with rapid key presses"
        },
        {
          "name": "Cherry MX Brown",
          "manufacturer": "Cherry", 
          "description": "55g actuation force - Balanced for typing and gaming"
        },
        {
          "name": "Cherry MX Green",
          "manufacturer": "Cherry",
          "description": "80g actuation force - Preferred by typists who want definitive feedback"
        }
      ]
    },
    "practicalImplications": {
      "userExperience": "Lower actuation forces enable faster typing but may lead to accidental key presses. Higher forces provide more control but can cause fatigue during extended use.",
      "useCaseRecommendations": {
        "gaming": "Light switches (35-50g) for rapid keypresses",
        "typing": "Medium switches (50-65g) for balanced feel",
        "programming": "Medium to heavy switches (55-75g) for deliberate keypresses"
      },
      "keyConsiderations": [
        "Personal preference varies significantly",
        "Consider your typing style and usage patterns",
        "Test switches before committing to a full keyboard"
      ]
    },
    "metadata": {
      "characteristicsCount": 1,
      "examplesProvided": 3,
      "technicalDepth": "intermediate",
      "sectionsFound": 4,
      "hasMaterialScience": true
    }
  },
  "version": "1.0.0",
  "generatedAt": "2024-01-15T10:30:00.000Z"
}
```

### 3. Material Analysis Response

**Response Type**: `material_analysis`

Used for analyzing switch materials like housing compounds, stem materials, etc.

#### Schema

```typescript
interface MaterialAnalysisResponse {
  title: string;
  materialsAnalyzed: string[];
  overview: string;
  materialDetails: MaterialDetail[];
  materialScience: {
    title: string;
    content: string;
    chemicalProperties?: any;
    mechanicalProperties?: any;
    acousticProperties?: any;
  };
  comparisons?: {
    title: string;
    content: string;
    comparativeAnalysis: any[];
  };
  examples: {
    title: string;
    content: string;
    materialExamples: ExampleSwitch[];
    applicationExamples?: any[];
  };
  practicalGuidance: {
    selectionCriteria: string;
    useCaseRecommendations: { [useCase: string]: string };
    materialCareAndMaintenance?: string;
    keyConsiderations: string[];
  };
  metadata: {
    materialsCount: number;
    examplesProvided: number;
    technicalDepth: 'basic' | 'intermediate' | 'advanced';
    analysisScope: 'single_material' | 'material_comparison' | 'comprehensive_analysis';
    sectionsFound?: number;
    hasMaterialScience?: boolean;
  };
}

interface MaterialDetail {
  materialName: string;
  materialType: 'housing' | 'stem' | 'spring' | 'other';
  properties: {
    soundCharacteristics: string;
    feelCharacteristics: string;
    durability: string;
  };
  advantages: string[];
  disadvantages: string[];
  commonUses: string[];
  examples: ExampleSwitch[];
}
```

#### Example Response

```json
{
  "responseType": "material_analysis",
  "data": {
    "title": "PBT vs ABS Keycap Material Analysis",
    "materialsAnalyzed": ["pbt", "abs"],
    "overview": "This analysis covers Polybutylene Terephthalate (PBT) and Acrylonitrile Butadiene Styrene (ABS), the two most common keycap materials.",
    "materialDetails": [
      {
        "materialName": "PBT",
        "materialType": "housing",
        "properties": {
          "soundCharacteristics": "Deeper, more muted sound profile",
          "feelCharacteristics": "Textured surface that resists shine",
          "durability": "Excellent resistance to wear and chemicals"
        },
        "advantages": [
          "Superior durability",
          "Resistance to shine",
          "Better texture retention",
          "Chemical resistance"
        ],
        "disadvantages": [
          "Higher manufacturing cost",
          "Limited color options",
          "More brittle than ABS"
        ],
        "commonUses": [
          "Premium keycap sets",
          "High-end mechanical keyboards",
          "Enthusiast builds"
        ],
        "examples": []
      }
    ],
    "materialScience": {
      "title": "Material Science Properties",
      "content": "PBT's crystalline structure provides superior chemical resistance and durability compared to ABS's amorphous structure.",
      "chemicalProperties": {
        "polymerStructure": "Semi-crystalline thermoplastic with high molecular weight",
        "thermalProperties": "Higher melting point and better heat resistance than ABS"
      },
      "mechanicalProperties": {
        "durability": "Superior wear resistance and dimensional stability",
        "elasticity": "Lower flexibility but higher strength than ABS"
      },
      "acousticProperties": {
        "soundDamping": "Better sound dampening properties due to denser structure"
      }
    },
    "examples": {
      "title": "Material Examples in Popular Switches",
      "content": "Both materials are widely used across different switch manufacturers",
      "materialExamples": [
        {
          "name": "GMK Keycaps",
          "manufacturer": "GMK",
          "description": "High-quality ABS keycaps known for vibrant colors"
        },
        {
          "name": "Enjoyable PBT",
          "manufacturer": "Various",
          "description": "Durable PBT keycaps with excellent longevity"
        }
      ]
    },
    "practicalGuidance": {
      "selectionCriteria": "Choose PBT for long-term use and premium feel, or ABS for budget-conscious builds with good short-term performance.",
      "useCaseRecommendations": {
        "gaming": "ABS for vibrant backlighting, PBT for durability",
        "typing": "PBT for professional use and longevity",
        "budget": "ABS offers good value for entry-level builds"
      },
      "keyConsiderations": [
        "Budget constraints vs longevity needs",
        "Color preferences and backlighting requirements",
        "Texture preferences for typing feel"
      ]
    },
    "metadata": {
      "materialsCount": 2,
      "examplesProvided": 2,
      "technicalDepth": "intermediate",
      "analysisScope": "material_comparison",
      "sectionsFound": 5,
      "hasMaterialScience": true
    }
  },
  "version": "1.0.0",
  "generatedAt": "2024-01-15T10:30:00.000Z"
}
```

### 4. Standard RAG Response

**Response Type**: `standard_rag`

Used for general Q&A, knowledge queries, and miscellaneous information.

#### Schema

```typescript
interface StandardRAGResponse {
  title: string;
  queryType: 'general_knowledge' | 'product_info' | 'troubleshooting' | 'recommendation' | 'educational' | 'other';
  content: {
    mainAnswer: string;
    additionalContext?: string;
    relatedInformation?: string;
  };
  sections?: AnalysisSection[];
  relatedSwitches?: ExampleSwitch[];
  keyPoints: string[];
  followUp?: {
    suggestedQuestions?: string[];
    relatedTopics?: string[];
    furtherReading?: {
      title: string;
      description: string;
      url?: string;
    }[];
  };
  sourceInformation: {
    sourceTypes: ('database' | 'general_knowledge' | 'technical_documentation' | 'community_knowledge')[];
    confidenceLevel: 'high' | 'medium' | 'low';
    lastUpdated?: Date;
    limitations?: string[];
  };
  metadata: {
    responseLength: 'brief' | 'detailed' | 'comprehensive';
    technicalLevel: 'beginner' | 'intermediate' | 'advanced';
    switchesReferenced?: string[];
    sectionsFound?: number;
    tablesFound?: number;
    listsFound?: number;
    hasStructuredContent?: boolean;
  };
}
```

#### Example Response

```json
{
  "responseType": "standard_rag",
  "data": {
    "title": "Mechanical Switch Lubrication Guide",
    "queryType": "educational",
    "content": {
      "mainAnswer": "Switch lubrication is a modification technique that improves the feel and sound of mechanical switches by reducing friction between moving parts.",
      "additionalContext": "The process involves disassembling switches, cleaning components, and applying specialized lubricants to specific contact points."
    },
    "keyPoints": [
      "Smoother keystroke action",
      "Reduced scratchiness",
      "Improved sound profile", 
      "Enhanced switch longevity"
    ],
    "followUp": {
      "suggestedQuestions": [
        "What lubricants should I use for different switch types?",
        "How do I disassemble switches safely?",
        "What tools do I need for switch lubrication?"
      ],
      "relatedTopics": [
        "Switch filming",
        "Spring swapping",
        "Stabilizer tuning"
      ],
      "furtherReading": [
        {
          "title": "Switch Modding Guide",
          "description": "Comprehensive guide to switch modifications"
        },
        {
          "title": "Lubricant Comparison",
          "description": "Detailed comparison of different switch lubricants"
        }
      ]
    },
    "sourceInformation": {
      "sourceTypes": ["general_knowledge", "community_knowledge"],
      "confidenceLevel": "high",
      "limitations": ["Specific techniques may vary by switch type"]
    },
    "metadata": {
      "responseLength": "detailed",
      "technicalLevel": "intermediate",
      "sectionsFound": 4,
      "listsFound": 2,
      "hasStructuredContent": true
    }
  },
  "version": "1.0.0",
  "generatedAt": "2024-01-15T10:30:00.000Z"
}
```

## Error Responses

When parsing fails, fallback responses are provided with error context:

```json
{
  "responseType": "standard_rag",
  "data": {
    "title": "Response (Parse Error)",
    "queryType": "other",
    "content": {
      "mainAnswer": "Unable to process the content due to parsing error: Insufficient content. Please try rephrasing your question or contact support if the issue persists."
    },
    "keyPoints": [],
    "sourceInformation": {
      "sourceTypes": ["general_knowledge"],
      "confidenceLevel": "low",
      "limitations": [
        "Content could not be properly parsed",
        "Information may be incomplete or inaccurate"
      ]
    },
    "metadata": {
      "responseLength": "brief",
      "technicalLevel": "beginner",
      "confidence": 0,
      "warnings": ["Parsing failed: Insufficient content"],
      "limitations": ["This response contains fallback data due to parsing failure"],
      "processingMode": "fallback"
    }
  },
  "version": "1.0.0",
  "generatedAt": "2024-01-15T10:30:00.000Z",
  "error": {
    "errorType": "INSUFFICIENT_CONTENT",
    "errorMessage": "Insufficient content",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "markdownLength": 15,
    "hasBasicStructure": {
      "hasHeaders": false,
      "hasTables": false,
      "hasLists": false,
      "estimatedSections": 0
    }
  },
  "isFallback": true
}
```

## Integration Guidelines

### Frontend Consumption

1. **Check Response Type**: Always check `responseType` to determine how to render the data
2. **Handle Fallbacks**: Check for `isFallback: true` and display appropriate UI
3. **Error Handling**: Show error information from `error` field when present
4. **Metadata Usage**: Use metadata for additional context and UI enhancements

### Backend Integration

1. **Type Safety**: Use the provided TypeScript interfaces for type safety
2. **Error Handling**: Implement proper error handling for all transformer methods
3. **Validation**: Validate input and output structures before processing
4. **Monitoring**: Log error types and frequencies for monitoring

### Migration from String Responses

1. **Backward Compatibility**: The system supports both structured and string content
2. **Gradual Migration**: Update frontend components incrementally
3. **Testing**: Test both structured and fallback responses thoroughly

## Versioning

- **Current Version**: 1.0.0
- **Version Field**: Each response includes a version field for future compatibility
- **Breaking Changes**: Version increments will indicate breaking changes to response structure

## Performance Considerations

- **Response Size**: Structured responses may be larger than plain text
- **Parsing Time**: Additional processing time for parsing and validation
- **Memory Usage**: Increased memory usage for complex response structures
- **Caching**: Consider caching structured responses for frequently accessed content 