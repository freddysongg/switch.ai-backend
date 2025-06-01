# Product Requirements Document: Enhanced AI-Powered Mechanical Switch Comparisons

## 1. Introduction/Overview

This document outlines the requirements for the "Enhanced AI-Powered Mechanical Switch Comparisons" feature for `switch.ai`. The current AI provides basic answers and some tech specs. This feature aims to significantly upgrade the chatbot's capabilities by enabling it to generate in-depth, structured, and user-friendly comparisons between two or more mechanical keyboard switches. The output should be similar in quality and detail to expert review sites (e.g., the Milktooth example provided by the user), moving beyond simple Q&A to provide comprehensive analyses that help users make informed decisions. The goal is to establish `switch.ai` as a go-to authority by leveraging the power of an advanced LLM (Gemini) with our curated switch database to deliver rich, well-informed, and analytical results.

## 2. Goals

* To provide users with detailed, analytical comparisons of mechanical keyboard switches, covering technical specifications, qualitative aspects (sound, feel), and potential use cases.
* To enhance user trust and establish `switch.ai` as an authoritative source for switch information.
* To improve user engagement by offering more valuable and comprehensive insights than basic Q&A.
* To deliver AI-generated content that is well-structured, easy to read, and directly comparable to expert human-written reviews.
* To intelligently infer user intent for comparisons from natural language queries.
* To ensure responses are factually grounded in the `switch.ai` database when information is available, and to transparently indicate when general LLM knowledge is used (with attempts to cite sources).

## 3. User Stories

* **US1:** As a keyboard hobbyist new to tactile switches, I want to ask "Compare Glorious Pandas and Boba U4Ts," so I can get a detailed breakdown of their differences in feel, sound, technical specifications, and ideal use cases, helping me choose which one to try first.
* **US2:** As an experienced gamer, I want to ask "What's better for gaming, Gateron Oil Kings or Cherry MX Speeds?", so I can receive a comparison focusing on aspects like actuation, travel, smoothness, and suitability for gaming, to help optimize my in-game performance.
* **US3:** As a user exploring different switch types, I want to ask "Tell me about Gateron Yellow, Akko Cream Yellow, and JWK Black Linear switches," so I can get a comparative overview of these switches, even if I don't explicitly use the word "compare."
* **US4:** As a beginner, if a comparison uses technical terms I don't understand (e.g., "actuation force"), I want to be able to ask `switch.ai` for a clarification of that term in the context of the comparison, so I can better understand the information provided.
* **US5:** As any user, when I request a comparison, I want the information presented in a clear, structured format with distinct sections, making it easy to digest and compare the switches across various attributes.

## 4. Functional Requirements

### 4.1. User Query Interpretation
    FR1. The system MUST attempt to infer a user's intent to compare switches from natural language queries, even if explicit comparison keywords (e.g., "compare," "vs") are not used (e.g., "Is X better than Y for typing?").
    FR2. The system MUST be able to identify the specific switch names mentioned by the user for comparison from their query.
    FR3. The system SHOULD be able to handle requests to compare a variable number of switches based on the user's query. (For MVP, handling 2-3 switches effectively is a good target, with graceful handling if more are requested).

### 4.2. Data Retrieval for Comparison
    FR4. For each switch identified for comparison that exists in the `switches` table (defined in `backend-switchai/src/db/schema.ts` [cite: 1, 2]), the system MUST retrieve all available relevant structured data. This includes, but is not limited to: `name`, `manufacturer`, `type`, `topHousing`, `bottomHousing`, `stem`, `mount`, `spring`, `actuationForce`, `bottomForce`, `preTravel`, and `totalTravel`[cite: 1, 2].
    FR5. If a user query involves comparing a switch in our database with one not in our database, or if certain specific data fields for a switch in our database are missing (null/N/A), the system MUST transparently acknowledge this limitation in its response.
    FR6. In cases where specific data is missing from the database (as per FR5), the LLM MAY use its general knowledge to fill gaps or provide inferred information. If general web knowledge is used, the LLM response SHOULD indicate this (e.g., "Based on general information found on the web...").
    FR7. The system should attempt to cite sources or vendor sites if the LLM uses external information to ensure reliability and avoid hallucination, where feasible.

### 4.3. AI-Generated Comparison Content
    FR8. The AI (Gemini LLM, model `gemini-2.0-flash` as per `backend-switchai/src/config/ai.config.ts` [cite: 1]) MUST generate a detailed comparison structured into distinct sections.
    FR9. The comparison output MUST include (but is not limited to) the following sections, inspired by the Milktooth example:
        * **Overview:** A brief introduction to each switch being compared and their general positioning or notable characteristics.
        * **Technical Specifications:** A structured presentation (e.g., Markdown table or consistently formatted side-by-side lists) of key objective specifications retrieved from the database (e.g., actuation force, bottom-out force, travel distances, materials).
        * **Detailed Aspect Comparison:** In-depth paragraphs analyzing and comparing switches across various dimensions, such as:
            * Housing Materials (e.g., `topHousing`, `bottomHousing` from `schema.ts` [cite: 1, 2]) and their typical impact on sound and feel.
            * Weighting (e.g., `actuationForce`, `bottomForce` from `schema.ts` [cite: 1, 2]) and implications for typing experience and fatigue.
            * Travel Distance (e.g., `preTravel`, `totalTravel` from `schema.ts` [cite: 1, 2]) and its effect on perceived speed and feedback.
            * Sound Profile: Description of the likely sound (e.g., "clacky," "thocky," "poppy"), drawing from database fields if available, or inferred/general knowledge if explicitly stated.
            * Tactile Feel/Smoothness: Based on switch `type` (linear, tactile, clicky) and other attributes, including analysis of what makes them distinct.
        * **Typing Experience Summary:** A concise summary of the overall subjective typing experience one might expect from each switch.
        * **Conclusion/Recommendation:** A balanced summary highlighting key differentiators. If the user's query included a specific use case (e.g., "for gaming," "for quiet environments"), the recommendation SHOULD be tailored to that use case.
    FR10. The AI's language MUST be analytical and informative, going beyond simple statements of fact to explain implications (e.g., "Switch A's lower actuation force may lead to quicker key presses but could also result in more accidental keystrokes for heavy-handed typists compared to Switch B.").
    FR11. The AI response MUST be formatted using Markdown for headings, lists, tables (if appropriate for specs), and emphasis (e.g., bold for switch names and key terms), as guided by updated `OUTPUT_FORMAT_INSTRUCTIONS` in `ai.config.ts`[cite: 1].
    FR12. The AI MUST adhere to the `CORE_TASK_DESCRIPTION` to base answers primarily on provided knowledge base information when available[cite: 1].
    FR13. If the AI uses technical terms that a beginner might not understand, it SHOULD briefly explain them contextually, or the system should allow users to ask follow-up clarification questions.

### 4.4. API and System Integration
    FR14. The enhanced comparison logic MUST be integrated into the existing `/api/chat` endpoint and `ChatService` (`processMessage` method)[cite: 1, 2]. The `ChatService` will be responsible for detecting comparison intent[cite: 1, 2].
    FR15. The `MAX_OUTPUT_TOKENS` (currently 350 in `ai.config.ts` [cite: 1]) for the Gemini LLM may need to be reviewed and potentially increased to accommodate the more verbose nature of detailed comparisons.
    FR16. The `ChatResponse` structure will continue to deliver the AI's content, which for comparisons, will be the structured Markdown[cite: 1, 2].
    FR17. Existing error handling and fallback messages (`FALLBACK_ERROR_MESSAGE_LLM`, `FALLBACK_ERROR_MESSAGE_INTERNAL` from `ai.config.ts` [cite: 1]) will be used if the comparison generation fails.

## 5. Non-Goals (Out of Scope for MVP)

* **Real-time Price Comparison:** The system will not fetch or display real-time pricing or availability from vendors for MVP. The "By the numbers" section with pricing from the example is out of scope unless static price data is added to the DB.
* **Visual Media:** Comparisons will not include images or embedded videos of switches or sound tests for MVP.
* **User Accounts/Personalization for Comparisons:** Saving comparison preferences or tailoring comparisons based on a user's historical data is out of scope for MVP.
* **Direct Comparison of Switches to Non-Switch Components:** For MVP, direct comparisons like "compare Switch X to Keycap Profile Y" are out of scope. The AI should state its limitation if such a query is made, though it might offer information on Switch X and separately on Keycap Profile Y if data exists.
* **Adding New Fields to Database for MVP:** While future data points like sound test links or detailed modding potential are desirable, the MVP will primarily work with the existing `switches` table schema[cite: 1, 2]. The LLM will be prompted to use web knowledge for these aspects if explicitly asked, noting the data source.

## 6. Design Considerations (Optional)

* The backend will provide the comparison content as structured Markdown. The frontend team will be responsible for parsing this Markdown and rendering it in a user-friendly, readable format that effectively presents the comparison sections (e.g., using distinct visual blocks, potentially tables for specs).
* Consideration should be given on the frontend to how multiple switch comparisons (e.g., 3 or 4 switches) are displayed to avoid overwhelming the user.

## 7. Technical Considerations

### 7.1. Intent Recognition
    TC1. The `ChatService` in `backend-switchai/src/services/chat.ts` [cite: 1, 2] will require logic to detect comparison intent. Initial implementation could use keyword/pattern matching (e.g., "compare", "vs", "versus", "better than", "difference between"). More advanced NLU/entity extraction can be considered for future iterations.
    TC2. The system needs to robustly extract the names of all switches the user wishes to compare.

### 7.2. Data Fetching for Multiple Switches
    TC3. The `ChatService` must be updated to fetch full data records from the `switches` table for each identified switch in a comparison query, not just the top K similar items for general RAG[cite: 1, 2].

### 7.3. Prompt Engineering for Comparisons
    TC4. A new, detailed prompt strategy specifically for generating comparisons will be developed. This will involve creating new prompt components or a distinct template within `backend-switchai/src/services/promptBuilder.ts` [cite: 1, 2] or by modifying `backend-switchai/src/config/ai.config.ts`[cite: 1].
    TC5. This "comparison prompt" must clearly instruct the LLM on the required output structure (sections, Markdown usage, analytical tone) and provide the retrieved data for all switches involved in the comparison as distinct contexts.
    TC6. The prompt engineering process detailed in "Section 10: Prompt Engineering Methodology" (below) MUST be followed to design and refine this new comparison prompt.

### 7.4. LLM Configuration
    TC7. The `GEMINI_MODEL` and `TEMPERATURE` settings in `ai.config.ts` [cite: 1] will be used. `MAX_OUTPUT_TOKENS` should be evaluated and potentially increased[cite: 1].

### 7.5. API Endpoint
    TC8. The comparison functionality will be integrated into the existing `/api/chat` endpoint[cite: 1, 2]. The `ChatService` will differentiate between standard chat queries and comparison queries to apply the appropriate logic[cite: 1, 2]. This is preferred for MVP to maintain a single chat interface.

## 8. Success Metrics

* **Feature Usage:** Percentage of user sessions that utilize the comparison feature.
* **Quality of Comparisons:**
    * Accuracy of technical specifications presented (manual review and comparison against database).
    * Completeness of comparison sections as defined in FR9.
    * Clarity and structure of the generated Markdown output.
    * Relevance and depth of the analysis provided.
* **User Satisfaction:** Qualitative feedback from users (e.g., via community feedback, surveys if implemented) regarding the usefulness and quality of comparisons.
* **Reduced Clarification Questions:** A decrease in follow-up questions from users that indicate the initial comparison was unclear or incomplete (if measurable).
* **Engagement:** Increased average session duration for users engaging with comparison results.
* **Community Reviews:** Positive mentions or reviews of the comparison feature on relevant forums or social media.

## 9. Open Questions

* What is the precise strategy for handling queries comparing more than an optimal number of switches (e.g., >3-4)? Should the AI ask the user to narrow it down, or attempt a more summarized comparison?
* For data points where the LLM is allowed to use its general knowledge (e.g., subjective feel, sound profiles not in DB), what is the specific phrasing to be used to indicate the source of this information (e.g., "General consensus suggests...", "Typically, switches with this material sound...")?
* What level of detail should the "Technical Specifications" section go into by default? Should it list all fields from the `switches` table[cite: 1, 2], or a curated subset deemed most relevant for comparisons?

## 10. Prompt Engineering Methodology to be Used

The following "Prompt Engineering Assistant" methodology MUST be used by the AI Engineer when designing and iterating on the new "comparison prompt" for the Target LLM (Gemini).

---
**You are the "Prompt Engineering Assistant."** Your goal is to help me, the user, transform my raw ideas or tasks into detailed, effective context prompts that I can use with another Large Language Model (the "Target LLM"). Please ask me the following questions one by one. Wait for my answer to each question before proceeding to the next. After gathering all my answers, you will synthesize them into a comprehensive context prompt for the Target LLM, structured for clarity and effectiveness.

**Questions for the User (Me):**

1.  **Core Idea/Goal:** Briefly, what is the main idea, goal, or task you want the Target LLM to accomplish?
2.  **Target LLM's Role:** What specific persona or role should the Target LLM adopt to best achieve this goal? (e.g., "a helpful customer support agent," "an expert Python programmer," "a creative storyteller," "a factual data analyst").
3.  **Specific Task for Target LLM:** What is the precise and detailed task you want the Target LLM to perform related to your goal? Be very specific about the action it needs to take.
4.  **Desired Output Format & Structure:**
    * How should the Target LLM's final output be formatted? (e.g., plain text, JSON, XML, Markdown, a list, a table, code, etc.)
    * If it's structured (like JSON or Markdown with headers), please define the exact fields, keys, header names, and any specific structure it MUST follow. (e.g., "JSON with fields: 'title', 'summary', 'action_items' which is an array of strings").
    * Should the Target LLM avoid any conversational fluff and only return the structured output?
5.  **Essential Context & Inputs:**
    * What key information, data, or context MUST the Target LLM have to perform this task effectively? (This could include user inputs, documents, examples, specific constraints, data from other systems, or parameters it needs to consider).
    * Will any part of this context be variable or provided at runtime (e.g., user queries)? If so, how should I represent these placeholders in the prompt you generate?
6.  **Output Qualities & Constraints:**
    * Are there any specific qualities the Target LLM's output should possess? (e.g., tone: formal/casual/empathetic; style: concise/detailed/technical; language: specific programming language or natural language).
    * What should the Target LLM AVOID doing or including in its output? (e.g., avoid opinions, avoid specific topics, avoid making assumptions).
    * Are there any length constraints (e.g., "summary should be under 200 words")?
7.  **Examples (Highly Recommended):**
    * Can you provide one or more simple examples of the input the Target LLM might receive (if applicable) and the corresponding ideal output you envision? This helps immensely in clarifying your expectations.
8.  **Creativity vs. Factualness (Temperature Indication):**
    * On a scale of "Highly Factual" to "Highly Creative," where should the Target LLM's response lean? (This will help suggest an appropriate temperature setting for the Target LLM, e.g., low for factual, high for creative).

**Your Task (Prompt Engineering Assistant):**

Once I have answered all the above questions, please generate a comprehensive and detailed "Target LLM Context Prompt" based on my responses. Structure this generated prompt clearly, using distinct sections for:

* `### ROLE:`
* `### TASK:`
* `### CONTEXT:` (Include any placeholders for variable inputs as specified)
* `### OUTPUT_FORMAT:` (Detail the structure, fields, and any specific instructions like "No conversational fluff, only the JSON output.")
* `### OUTPUT_QUALITIES_AND_CONSTRAINTS:`
* `### EXAMPLES:` (If I provided them)
* `### BEHAVIORAL_GUIDELINE:` (Summarize the desired level of factualness/creativity and any key "DOs" or "DON'Ts")

Ensure the generated prompt incorporates the principles of clarity, specificity, structured output mandates, comprehensive context, and control over LLM behavior, as discussed in effective prompt engineering.

Finally, add a brief note to me (the user) at the end of your response: *"Remember to adjust the 'temperature' parameter for your Target LLM based on the 'BEHAVIORAL_GUIDELINE' (e.g., low for factual, higher for creative). You may also need to implement post-processing for the Target LLM's output to ensure it perfectly fits your needs."*
---

This methodology will be applied to construct the specific prompts used by the `PromptBuilder` service for generating the switch comparisons[cite: 1, 2]. The structure of this prompt should be reminiscent of highly effective system prompts, clearly defining roles, instructions, and access to tools or specific knowledge (like the v0.dev examples, adapted for our text-based LLM interaction rather than code generation). For instance: