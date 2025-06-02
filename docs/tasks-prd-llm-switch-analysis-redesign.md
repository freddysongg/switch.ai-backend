## Relevant Files

- `backend-switchai/src/config/responseStructure.ts` - ✅ CREATED - TypeScript interfaces/types for the LLM JSON output structure (the "word bank" of fields).
- `backend-switchai/src/types/analysisTypes.ts` - ✅ CREATED - Shared TypeScript types for internal data structures, requests, processing, and workflow management.
- `backend-switchai/src/services/llmAnalysisService.ts` - ✅ CREATED - Service for LLM interaction, prompt engineering, and response processing.
- `backend-switchai/src/utils/promptHelper.ts` - ✅ COMPLETED - Utility for constructing detailed prompts for the LLM with all specialized prompt builders.
- `backend-switchai/src/utils/loggingHelper.ts` - ✅ CREATED - Utility for standardized console logging throughout the analysis process.
- `backend-switchai/src/controllers/analysisController.ts` - ✅ COMPLETED - Controller to handle incoming analysis requests and orchestrate calls to services.
- `backend-switchai/src/routes/analysisRoutes.ts` - ✅ CREATED - Routes file to define API endpoints for the analysis feature.
- `backend-switchai/src/services/databaseService.ts` - ✅ CREATED - Database service for supplementary data fetching for switches, focusing on simple lookups.
- `backend-switchai/src/index.ts` - To register new routes and middleware if necessary.

### Notes

- The implementation should align with the existing project structure in `backend-switchai/src`.
- Emphasis on modularity and clear separation of concerns as per PRD (TC3).
- Reference `backend-switchai/docs/prd-llm-switch-analysis-redesign.md` for the (FR, OQ, TC, etc.)

## Tasks

- [x] 1.0 Setup Core Project Structure and Configuration
  - [x] 1.1 Define initial TypeScript interfaces/types for the JSON response structure (the "word bank") in `backend-switchai/src/config/responseStructure.ts` (addresses OQ1, FR4.2, TC1).
  - [x] 1.2 Create `backend-switchai/src/types/analysisTypes.ts` for shared types used across the feature.
  - [x] 1.3 Stub out new service files: `llmAnalysisService.ts`, `promptHelper.ts`, `loggingHelper.ts`.
  - [x] 1.4 Stub out new controller `analysisController.ts` and `analysisRoutes.ts`.

- [x] 2.0 Develop Query Ingestion and Intent Recognition Module
  - [x] 2.1 Design and implement the request input structure in `analysisController.ts` to accept user queries (FR1.1).
  - [x] 2.2 In `llmAnalysisService.ts`, develop the initial prompt engineering logic in `promptHelper.ts` to instruct the LLM to perform intent recognition on the user query (FR1.2).
  - [x] 2.3 Implement the interaction with the LLM for intent recognition (e.g., calling the Gemini API).
  - [x] 2.4 Define how recognized intent will be captured and used for subsequent processing steps.

- [x] 3.0 Implement Supplementary Database Interaction Logic
  - [x] 3.1 Identify necessary modifications or additions to `databaseService.ts` for fetching switch specifications based on (normalized) names (FR2.1).
  - [x] 3.2 Implement LLM-based normalization of switch names if needed before DB lookup (part of `llmAnalysisService.ts` or a utility).
  - [x] 3.3 Ensure database interaction gracefully handles cases where switches are not found or data is incomplete (FR2.3).
  - [x] 3.4 Develop logic to pass fetched database data to the `llmAnalysisService.ts` to be included in prompts as supplementary context (FR2.2).
  - [x] 3.5 Define logic for handling conflicts between DB and LLM data, preferring DB for factual specs with high confidence (FR2.4).

- [x] 4.0 Build LLM-Powered Analysis and Structured JSON Response Generation
  - [x] 4.1 **Phase 1: General Switch Information Queries (DC4)**
    - [x] 4.1.1 Enhance `promptHelper.ts` to construct prompts for general switch queries, instructing the LLM to use the `responseStructure.ts` and include overview, specs (from DB/LLM), sound profile, feel/experience, and recommendations (FR3.1, FR3.3, TC4).
    - [x] 4.1.2 Implement logic in `llmAnalysisService.ts` to send the prompt to the LLM and receive the JSON response.
    - [x] 4.1.3 Ensure the mandatory "overview" field is always populated (FR4.4).
  - [x] 4.2 **Phase 2: Basic Switch Comparison Queries (DC4)**
    - [x] 4.2.1 Update `promptHelper.ts` for switch comparison queries (e.g., 2 switches), detailing the required nested structure for specs and comparative analysis sections (feeling, sound, build, performance, conclusion, recommendations) (FR3.5).
    - [x] 4.2.2 Implement the LLM interaction for comparison queries in `llmAnalysisService.ts`.
  - [x] 4.3 **Phase 3: Advanced Query Types (DC4)**
    - [x] 4.3.1 Extend `promptHelper.ts` and `llmAnalysisService.ts` to handle follow-up queries, ensuring context is maintained (FR3.4).
    - [x] 4.3.2 Extend for multi-switch comparisons (more than 2 switches) (FR3.5).
    - [x] 4.3.3 Extend for material comparison queries, including material properties, application to switches, impact on sound/feel, and example switches (FR3.6).
  - [x] 4.4 Ensure LLM is guided to use the persona from `identity.txt` for tone and style of text content in JSON values (DC2).
  - [x] 4.5 Develop mechanisms in `promptHelper.ts` or `llmAnalysisService.ts` to effectively communicate the JSON structure from `responseStructure.ts` to the LLM (addresses OQ4, TC1).

- [ ] 5.0 Implement Logging, Error Handling, and Final Integrations
  - [ ] 5.1 Integrate detailed console logging using `loggingHelper.ts` at key stages: query receipt, intent determination, DB lookup, prompt construction, raw LLM response (FR5.1, FR5.2, FR5.3, TC5).
  - [ ] 5.2 Implement robust error handling in `analysisController.ts` and `llmAnalysisService.ts` to return user-friendly JSON error messages if unrecoverable errors occur (FR6.1).
  - [ ] 5.3 Ensure the system falls back to simpler messages or an error indication if detailed analysis fails (FR6.2).
  - [x] 5.4 Define API endpoints in `analysisRoutes.ts` and register them in `index.ts`.
  - [x] 5.5 Conduct thorough manual testing for various query types and edge cases (SM1).
    - [x] 5.5.1 Create me a detailed test suite in .json format that I can import into Postman
  - [ ] 5.6 Review code for adherence to project structure, modularity, and clarity (G8, SM3). 