# PRD: LLM-Powered Switch Analysis Feature Redesign

## 1. Introduction/Overview

This document outlines the requirements for redesigning the mechanical keyboard switch analysis feature. The current system, characterized by complex conditional logic and limitations due to sparse database embeddings, has proven to be rigid and inefficient.

The goal of this redesign is to transition to a more dynamic, intelligent, and flexible system primarily driven by a Large Language Model (LLM). This new approach will leverage the LLM's capabilities to understand diverse user queries, generate in-depth analyses, and provide responses in a structured JSON format. This structured output is intended to simplify frontend integration and allow for richer, more versatile presentation of information to users. The system will use the existing database as a supplementary source for switch specifications, rather than the primary driver of analysis.

## 2. Goals

*   **G1: LLM-Driven Core Analysis:** The LLM will be responsible for understanding user queries, performing the core analysis, and generating the content for the response.
*   **G2: Structured JSON Output:** All responses will be delivered in a JSON format. The structure will be flexible, with a "word bank" of potential fields, many of which will be optional. A comprehensive "overview" field will be mandatory.
*   **G3: Professional Audience Focus:** The depth of information, terminology, and analysis should cater primarily to keyboard professionals and experienced enthusiasts. However, clarity should be maintained so that motivated learners can also benefit.
*   **G4: Supplementary Database Use:** The existing switch database will be used to provide known specifications to the LLM as supplementary context. The system must not be bottlenecked by missing database entries or rely on complex SQL queries.
*   **G5: Comprehensive Query Handling:** The system must be able to handle various query types, including:
    *   General information about a specific switch.
    *   Follow-up questions related to a previous query.
    *   Comparisons between multiple switches.
    *   Comparisons and analysis of switch materials.
*   **G6: Detailed Logging:** Implement comprehensive step-by-step logging to the console for debugging purposes and to provide transparency into the analysis process.
*   **G7: Configurable Response Structure:** The potential JSON output structure (the "word bank" of fields) will be defined and managed in a TypeScript configuration file (`src/config/responseStructure.ts`).
*   **G8: Maintainable and Scalable Design:** The implementation should adhere to the existing project structure, emphasizing code abstraction and modularity for future scalability and maintainability.

## 3. User Stories

*   **US1 (General Info - Beginner):** "As a beginner keyboard enthusiast, I want to ask about a specific switch like 'NovelKey Creams' so that I can get a simple overview, its key specs, and how it generally sounds and feels."
*   **US2 (Comparison - Experienced):** "As an experienced keyboard modder, I want to compare 'Gateron Oil Kings' vs 'JWK Lavenders' vs 'Alpaca V2s' so that I can get a detailed technical breakdown, an in-depth analysis of their differences in feel, sound, and build, and recommendations for similar switches."
*   **US3 (Material Analysis - Designer):** "As a switch designer, I want to understand the impact of 'POM housing vs PC housing' so that I can see a comparison of their material properties, how they affect sound and feel in switches, and examples of popular switches using these materials."

## 4. Functional Requirements

**FR1: Query Ingestion & Intent Recognition**
*   FR1.1: The system must accept user queries as text input.
*   FR1.2: The LLM must analyze the raw user query to determine the user's intent (e.g., request for general switch information, switch comparison, material analysis, follow-up question).

**FR2: Database Interaction (Supplementary)**
*   FR2.1: For queries mentioning specific switches, the system should attempt to fetch known specifications from the local database after potential LLM-based normalization of switch names.
*   FR2.2: Any data fetched from the database will be passed to the LLM as supplementary context to aid in response generation.
*   FR2.3: If a switch is not found in the database, or if data is incomplete, the system must gracefully proceed using the LLM's general knowledge without interrupting the flow or erroring out.
*   FR2.4: In instances where both database information and LLM knowledge exist for a clearly identified switch, and a conflict arises, the database information should be subtly preferred for factual specs if confidence in the switch match is high. The LLM should be instructed to note discrepancies if significant.

**FR3: LLM-Powered Analysis & Response Generation**
*   FR3.1: The LLM is responsible for generating the primary analytical content, drawing upon the user's query, its identified intent, any supplementary data from the database, and its broad knowledge base.
*   FR3.2: The system should avoid complex, hardcoded conditional logic (e.g., extensive switch-case statements) for structuring responses based on query type. Instead, it will rely on the LLM's ability to intelligently populate fields within a flexible, predefined JSON structure.
*   FR3.3: **General Switch Query Handling:** Output should typically include:
    *   A detailed overview of the switch.
    *   Technical specifications (sourced from DB if available, otherwise from LLM).
    *   Analysis of its sound profile.
    *   Description of its typing feel/experience.
    *   Recommendations for other similar or relevant switches.
*   FR3.4: **Follow-up Query Handling:** Output should provide a relevant answer in context, including:
    *   A main overview connecting to the previous context.
    *   Specific information addressing the follow-up (e.g., application, implication).
    *   Other relevant fields as determined by the LLM.
*   FR3.5: **Switch Comparison Query Handling (e.g., X vs Y vs Z):** Output should include:
    *   A main overview summarizing the switches being compared and highlighting key differentiators.
    *   A nested object for each compared switch, containing its technical specifications.
    *   An "analysis" section (potentially a nested object) with comparative sub-sections for:
        *   Feeling/Tactility
        *   Sound Profile
        *   Build & Material Composition
        *   Performance Aspects
    *   A concluding summary.
    *   Individual switch recommendations related to each of the compared switches.
*   FR3.6: **Material Comparison Query Handling:** Output should include:
    *   A main overview of the materials being discussed.
    *   Explanation of material compositions and properties.
    *   How these materials apply to switch construction (housing, stem, etc.).
    *   Analysis of how different material combinations affect sound, feel, and performance.
    *   Example switches that utilize these materials, including a brief overview, specs, and sound profile for each example.

**FR4: JSON Output Structure**
*   FR4.1: The final output of the analysis must be a single JSON object.
*   FR4.2: The structure of this JSON object will be guided by a "word bank" of predefined potential fields. This "word bank" will be maintained in `src/config/responseStructure.ts`.
*   FR4.3: Most fields in the JSON structure will be optional. The LLM will populate only those fields relevant to the processed query and its findings. It is acceptable for some fields to be empty or omitted if not applicable.
*   FR4.4: A comprehensive "overview" field (or its equivalent, clearly designated as the primary summary) must be present and populated in all successful, non-error responses.
*   FR4.5: The values within the JSON object will primarily be text. Nested JSON objects are permitted and encouraged for organizing complex data (e.g., technical specifications for multiple switches in a comparison).
*   FR4.6: Section headers or descriptive keys should be used within the JSON to allow the frontend to style or render distinct blocks of information.

**FR5: Detailed Logging**
*   FR5.1: The system must log key steps of the request processing and analysis lifecycle to the console.
*   FR5.2: Logs should be descriptive, indicating the source or nature of decisions (e.g., "LLM identified intent as: [intent]", "Database lookup for [switch_name] yielded: [data/not_found]", "Prompt constructed for LLM: [prompt_summary_or_key_elements]", "Raw LLM JSON response received").
*   FR5.3: Information to be logged should include: the initial user query, identified intent, results of any database interactions, the core elements of the prompt sent to the LLM, and the raw JSON response from the LLM before any final parsing/validation.

**FR6: Error Handling**
*   FR6.1: In the event of unrecoverable errors during processing (e.g., LLM failure, critical data issues), the system must return a user-friendly error message in JSON format (e.g., `{"error": "An issue occurred. Please try again or contact support."}`). A playful or context-appropriate error message is also acceptable.
*   FR6.2: The system should always aim to generate a response. If detailed analysis fails, it should fall back to simpler, more generic messages or an error indication rather than crashing or returning no response.

**FR7: Configuration Management**
*   FR7.1: The master list of potential JSON fields and their hierarchical relationships (the "word bank") will be defined and managed within a TypeScript file located at `src/config/responseStructure.ts`.

## 5. Non-Goals (Out of Scope)

*   **NG1: No Complex SQL Queries:** The system will not employ complex SQL queries. Database interactions will be limited to simple lookups for supplementary switch data.
*   **NG2: No Heavy Reliance on Embeddings:** The system will not heavily rely on vector embeddings from the local database for switch identification or information retrieval due to current data limitations.
*   **NG3: No Initial Formal JSON Schema Validation:** While the output is JSON, formal schema validation (e.g., using JSON Schema) is not a requirement for the initial implementation. Manual testing of the output structure against `responseStructure.ts` will suffice.
*   **NG4: No Automated LLM Quality Tests (Initial Phase):** Quantitative, automated testing of LLM output quality (e.g., using benchmark datasets or semantic similarity scores) is not in scope for the initial release. Success will be judged by manual testing and qualitative evaluation.
*   **NG5: Frontend Implementation:** The specific implementation details of the frontend consuming this JSON output are out of scope for this backend PRD.

## 6. Design Considerations

*   **DC1: Frontend Rendering Enablement:** The JSON structure, while flexible, should be designed to intuitively map to frontend components. The use of descriptive keys and logical nesting will aid the frontend in rendering distinct blocks of information (e.g., tables for specifications, paragraphs for analysis).
*   **DC2: Persona Adherence (`identity.txt`):** The textual content generated by the LLM within the JSON values should align with the "switch.ai" persona: expert, analytical, knowledgeable, slightly enthusiastic, and utilizing appropriate mechanical keyboard terminology. This primarily influences the tone, style, and depth of the generated text.
*   **DC3: Clarity and Maintainability of JSON Structure:** The keys used in the JSON and defined in `responseStructure.ts` should be clear and descriptive to aid both frontend development and backend debugging/maintenance.
*   **DC4: Phased Implementation Approach:** Given the various query types, implementation can be phased. For example:
    *   Phase 1: General switch information queries.
    *   Phase 2: Basic switch comparison (e.g., two switches).
    *   Phase 3: Advanced comparisons (multiple switches), material analysis, and nuanced follow-up question handling.

## 7. Technical Considerations

*   **TC1: JSON Structure Definition (`src/config/responseStructure.ts`):**
    *   A TypeScript file will define interfaces or types representing the potential JSON output structure. This aids in type safety within the backend and serves as a clear reference.
    *   A representation of this structure (or key parts of it) must be communicated to the LLM as part of its prompt to guide the generation of the JSON.
*   **TC2: LLM as Core Logic Unit:** The primary intelligence for understanding queries and generating analytical content resides with the LLM. The surrounding backend application logic will focus on orchestrating data flow, robust prompt engineering, supplementary data retrieval, and output formatting.
*   **TC3: Modularity and Abstraction:** The implementation must adhere to the existing project structure within `backend-switchai/src`. Code should be organized into logical services, controllers, and utility modules with clear separation of concerns.
*   **TC4: Advanced Prompt Engineering:** Crafting effective and detailed prompts for the LLM is critical. Prompts must:
    *   Clearly define the LLM's role and task.
    *   Provide necessary context, including any supplementary data from the database.
    *   Specify the desired JSON output format, referencing the "word bank" from `responseStructure.ts`.
    *   Guide the LLM on tone, style (persona), and desired level of detail.
    *   Incorporate principles from the "Prompt Engineering Assistant" guide previously discussed.
*   **TC5: Logging Implementation:** Logging calls will be integrated at each significant step of the request processing pipeline. Console logging is acceptable for the initial implementation.

## 8. Success Metrics

*   **SM1: Qualitative Evaluation of LLM Output (Manual):**
    *   Accuracy, relevance, and depth of information provided by the LLM for various query types.
    *   Consistency and correctness of the generated JSON structure against the intended design in `responseStructure.ts`.
    *   Appropriateness of the LLM's tone, style, and terminology in line with the "switch.ai" expert persona.
    *   Completeness of relevant JSON fields for a given query type.
*   **SM2: Frontend Integration Viability (Indirect):** The ease with which the generated JSON can be parsed and utilized by a frontend developer to create a rich user interface (to be assessed when frontend work begins).
*   **SM3: System Maintainability & Scalability:**
    *   Clarity, modularity, and readability of the backend code.
    *   Ease with which the JSON structure (`responseStructure.ts`) or prompt engineering logic can be updated or extended.
*   **SM4: Debuggability:** Effectiveness of the logging in helping developers trace issues and understand system behavior.

## 9. Open Questions

*   **OQ1: Initial JSON "Word Bank" Definition:** What is the comprehensive initial list of all possible top-level and nested JSON fields (including data types/structures for values) that the LLM should be guided to use? This needs to be defined for `src/config/responseStructure.ts`.
*   **OQ2: Versioning of `responseStructure.ts`:** What strategy will be used for versioning or managing changes to `responseStructure.ts` if the desired output structure evolves significantly over time?
*   **OQ3: Performance Expectations:** Are there any specific performance targets or acceptable latency for the LLM response generation, particularly for complex comparison queries?
*   **OQ4: LLM Prompting for JSON Structure:** What is the most effective method to communicate the desired JSON structure (from `responseStructure.ts`) to the LLM within the prompt? (e.g., providing a TypeScript interface as text, a JSON example, a list of fields and types).
*   **OQ5: Depth and Nuance for "Professional" Level:** While the target is professionals, are there specific advanced sub-topics, technical details, or analytical frameworks that *must* be included for certain query types to meet professional expectations?
*   **OQ6: Handling Ambiguity in User Queries:** What strategies will be employed if a user's query is highly ambiguous and the LLM struggles to determine a clear intent or relevant fields to populate? 