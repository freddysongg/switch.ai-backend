## Relevant Files

- `backend-switchai/src/services/chat.ts` - **[UPDATED]** Now includes comparison intent recognition, embedding-based switch data retrieval (`retrieveComprehensiveSwitchData()`, `formatMissingDataForPrompt()`), variable switch handling, and integration framework for comparison prompt flow. Key methods: `processComparisonQuery()`, `detectComparisonIntent()`, `processVariableSwitchComparison()`.
- `backend-switchai/src/services/promptBuilder.ts` - Will need major changes to incorporate a new prompt building strategy for comparisons, or a new dedicated module/class for comparison prompts might be created. This will use `identity.txt` as a base and integrate with the structured switch data blocks from embedding-based retrieval.
- `backend-switchai/src/config/ai.config.ts` - May require updates to `PROMPT_COMPONENTS` to include new structures for comparison, and review/adjustment of `MAX_OUTPUT_TOKENS`.
- `backend-switchai/src/controllers/chat.ts` - Minor changes might be needed to ensure the existing `/api/chat` endpoint correctly routes comparison requests through the updated `ChatService` and handles responses.
- `backend-switchai/src/db/schema.ts` - Primarily for reference to understand available fields in the `switches` table. No schema changes are anticipated for MVP.
- `backend-switchai/src/data/identity.txt` - This file containing the core identity and prompt structure for comparisons will be referenced and used when implementing comparison prompt logic. **The existing SWITCH_DATA_BLOCKS format aligns with our new `formatMissingDataForPrompt()` output.**
- `/tasks/postman_collections/SwitchAI_Enhanced_Comparisons_Tests.postman_collection.json` - (To be created) Postman collection for testing the enhanced comparison feature, including embedding-based matching and confidence scoring.
- `/tasks/postman_collections/Comparison_Test_Plan.md` - **[TO BE CREATED]** Comprehensive test plan documentation detailing test cases, expected responses, and validation criteria for comparison functionality.
- `/tasks/postman_collections/Expected_Response_Structure.md` - **[CREATED]** Comprehensive documentation of expected Markdown response structure, validation criteria, and quality standards for comparison functionality.
- `/tasks/frontend_team/Frontend_Comparison_Integration_Brief.md` - **[CREATED]** Detailed integration brief for frontend team with TypeScript interfaces, CSS styling recommendations, error handling patterns, and implementation guidelines for enhanced comparison feature.

### Notes

- API testing will primarily be conducted using Postman. Test suites should be designed to cover various scenarios outlined in the PRD.
- The Postman collection should include example requests for different comparison queries and clearly define expected characteristics of the Markdown response.
- Exported Postman collections (`.json` files) should be version-controlled or shared with the team.
- Manual validation of the AI-generated Markdown structure and content against the PRD requirements is crucial.

## Tasks

- [x] 1.0 Design and Implement Enhanced User Query Interpretation for Comparisons
  - [x] 1.1 Research and decide on the initial strategy for comparison intent recognition within `ChatService` (e.g., keyword matching, regex for "X vs Y" patterns, simple entity extraction for switch names).
  - [x] 1.2 Implement logic in `ChatService` to parse the user's query and robustly extract the names of all switches intended for comparison.
  - [x] 1.3 Implement handling in `ChatService` for a variable number of identified switches (target 2-3 for effective MVP display, with graceful degradation or user feedback if more are identified).

- [x] 2.0 Develop Specialized Data Retrieval Logic for Switch Comparisons
  - [x] 2.1 Modify `ChatService` to fetch full data records from the `switches` PostgreSQL table (using Drizzle ORM as per `db/index.ts`) for *each* switch identified in TC2, not just general context. **Updated to use embedding-based similarity search for robust switch matching instead of direct name lookup.**
  - [x] 2.2 Ensure the retrieval logic fetches all fields necessary for detailed comparison as outlined in FR4 and the `switches` table schema (e.g., `name`, `manufacturer`, `type`, `topHousing`, `bottomHousing`, `stem`, `actuationForce`, etc.). **Building on embedding-based approach from 2.1.**
  - [x] 2.3 Implement logic to handle cases where one or more identified switches are not found in the database, or specific fields are null/N/A. This information needs to be passed to the prompt building stage. **Extending the confidence-based matching and missing field tracking from 2.1.**

- [x] 3.0 Engineer Advanced Comparison Prompt for LLM
  - [x] 3.1 Following the methodology in Section 10 of `MyFeature-PRD.md`, and using `backend-switchai/src/data/identity.txt` as the primary reference for the structure and content of the comparison prompt, design the comprehensive prompt for the Gemini LLM. **Will integrate with the structured switch data blocks from our embedding-based retrieval.**
  - [x] 3.2 Define specific instructions within the prompt for the LLM to generate all required sections (Overview, Technical Specifications, Detailed Aspect Comparison, Conclusion, etc.) as per FR9.
  - [x] 3.3 Specify exact Markdown formatting requirements in the prompt (headings, tables, bolding, lists) to ensure structured and readable output, as per FR11 and the example in Section 10 of the PRD.
  - [x] 3.4 Incorporate instructions into the prompt on how the LLM should handle missing data for switches (FR5, FR6), including when to state "N/A" or use general knowledge transparently (e.g., "Based on general community understanding..."). **Will leverage the missing data formatting from `formatMissingDataForPrompt()` method.**
  - [x] 3.5 Implement the new comparison prompt logic within `PromptBuilder.ts` or create a new dedicated module. Ensure it correctly incorporates conversation history, retrieved switch data blocks from embedding-based retrieval, and the user query. **Must integrate with `ComprehensiveSwitchData` format and confidence scores.**
  - [x] 3.6 Update `ai.config.ts` if new static prompt components are defined or if `MAX_OUTPUT_TOKENS` needs adjustment for verbose comparisons (FR15).

- [x] 4.0 Integrate Comparison Generation into Chat Service and API
  - [x] 4.1 Modify the `processMessage` method in `ChatService` to include a step that detects if the query is a comparison request. **Will use existing `processComparisonQuery()` method that combines detection and variable switch handling.**
  - [x] 4.2 If comparison intent is detected, route the processing to use the embedding-based data retrieval (`retrieveComprehensiveSwitchData()`) and formatted data preparation (`formatMissingDataForPrompt()`) instead of the standard RAG approach, then apply comparison prompt building (Task 3.0) logic.
  - [x] 4.3 Ensure the `GeminiService` (`services/gemini.ts`) is called with the newly constructed comparison prompt that includes structured switch data blocks and confidence information.
  - [x] 4.4 Ensure the existing `/api/chat` endpoint in `ChatController` (`controllers/chat.ts`) correctly handles the flow and returns the structured Markdown response in the `ChatResponse` object.

- [x] 5.0 Define and Implement Fallback and Error Handling for Comparisons
  - [x] 5.1 Ensure existing fallback mechanisms in `ChatService` and `GeminiService` (using `FALLBACK_ERROR_MESSAGE_LLM` and `FALLBACK_ERROR_MESSAGE_INTERNAL` from `ai.config.ts`) are appropriately triggered if comparison generation fails at any stage (e.g., LLM error, critical data retrieval failure). **Must handle embedding service failures and low confidence matches.**
  - [x] 5.2 Implement specific user-facing messages if a comparison cannot be generated due to issues like failing to identify any switches, low confidence matches from embedding search, or if all identified switches are not found in the database. **Will leverage existing user feedback messages from variable switch handling.**

- [ ] 6.0 API Testing, Response Validation, Documentation, and Refinement
  - [x] 6.1 Design a comprehensive suite of test cases for Postman, covering various comparison queries (2 switches, 3+ switches, switches with missing data, ambiguous queries, edge cases) to validate against PRD acceptance criteria.
  - [x] 6.2 Create and configure a Postman collection (`.json` format, e.g., `SwitchAI_Enhanced_Comparisons_Tests.postman_collection.json`) for the `/api/chat` endpoint, including example requests for each test case.
  - [x] 6.3 Within the Postman collection or associated documentation, clearly describe the expected structure and key content elements for the Markdown responses for each test case.
  - [x] 6.4 Conduct thorough manual testing using the Postman collection, meticulously validating the accuracy, structure, and analytical depth of the AI-generated Markdown comparisons against the PRD requirements.
  - [x] 6.5 Review and iteratively refine the prompts (Task 3.0) and backend logic based on the results of manual testing to improve the quality of comparisons.
  - [x] 6.6 Update any internal API documentation (e.g., README, Swagger/OpenAPI spec if used) to reflect the expected behavior for comparison queries via the `/api/chat` endpoint.
  - [x] 6.7 Prepare a clear brief or examples for the frontend team, detailing the expected Markdown structure of comparison responses to guide their parsing and rendering logic.