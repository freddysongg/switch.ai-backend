# backend-switchai

Your Mechanical Switch Assistant

<pre>
    ███████╗██╗    ██╗██╗████████╗ ██████╗██╗  ██╗    █████╗ ██╗
    ██╔════╝██║    ██║██║╚══██╔══╝██╔════╝██║  ██║  ██╔══██╗██║
    ███████╗██║ █╗ ██║██║   ██║   ██║     ███████║  ███████║██║     
    ╚════██║██║███╗██║██║   ██║   ██║     ██╔══██║  ██╔══██║██║
    ███████║╚███╔███╔╝██║   ██║   ╚██████╗██║  ██║  ██║  ██║██║
    ╚══════╝ ╚══╝╚══╝ ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝  ╚═╝  ╚═╝╚═╝

    Your Mechanical Switch Assistant
</pre>

## Project Description

`backend-switchai` is the backend service for "Your Mechanical Switch Assistant". It provides API endpoints to support the assistant's functionalities, likely involving AI-powered chat, user authentication, and database interactions to store and retrieve information related to mechanical switches.

## Table of Contents

- [Project Description](#project-description)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Configuration](#configuration)
- [Available Scripts](#available-scripts)
- [API Endpoints](#api-endpoints)
- [Database](#database)
- [Contributing](#contributing)
- [License](#license)

## Features

- **AI-Powered Chat:** Core functionality providing chat capabilities, likely leveraging the integrated Google Generative AI and embeddings.
- **Health Check:** A dedicated endpoint (`/health`) to monitor the service's status and availability.
- **Embeddings Generation:** Service for creating embeddings, crucial for AI-driven search and context understanding in chat.
- **Database Integration:** Utilizes Drizzle ORM for database operations, with Supabase as a likely PostgreSQL provider.
- **Authentication:** Middleware for securing API endpoints.
- **Rate Limiting:** Protects the API from abuse and ensures fair usage.
- **Comprehensive Error Handling:** Centralized error management for robust API responses.
- **Structured Logging:** Clear and informative console output for events like server start, database connection, etc. (evidenced by `src/config/ascii.ts`).

## Tech Stack

- **Runtime Environment:** Node.js
- **Language:** TypeScript
- **Framework:** Express.js
- **Database ORM:** Drizzle ORM
- **Database:** PostgreSQL (likely via Supabase)
- **AI:** Google Generative AI (as per `@google/generative-ai` dependency)
- **API Client for Supabase:** `@supabase/supabase-js`
- **Environment Variable Management:** `dotenvx`
- **Development Tooling:**
    - `tsx` for running TypeScript directly
    - `prettier` for code formatting
    - `eslint` (assumed, standard for TypeScript projects, though not explicitly seen yet)
- **Package Manager:** pnpm (inferred from `pnpm-lock.yaml` and scripts)

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js:** (Specify version if known, otherwise recommend LTS version) - [Download Node.js](https://nodejs.org/)
- **pnpm:** After installing Node.js, you can install pnpm using `npm install -g pnpm` - [pnpm Website](https://pnpm.io/)
- **Supabase CLI:** (If Supabase local development is used) - [Install Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)
- **Git:** For cloning the repository - [Download Git](https://git-scm.com/)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository_url> # Replace <repository_url> with the actual URL
    cd backend-switchai
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```

3.  **Set up environment variables:**
    See the [Configuration](#configuration) section below.

4.  **Initialize Supabase (if applicable for local development):**
    ```bash
    pnpm supabase:start
    ```
    This command might need to be run if you're using Supabase for local development. Refer to the [Database](#database) section for more details on database setup and migrations.

## Configuration

This project uses `dotenvx` for managing environment variables.

1.  **Create environment files:**
    You'll need to create environment-specific files based on `.env.example`. For local development, create a `.env.local` file:
    ```bash
    cp .env.example .env.local
    ```
    For production, you would typically create a `.env.production` file.

2.  **Populate environment variables:**
    Edit the `.env.local` (and/or `.env.production`) file to include the necessary credentials and configuration values for your environment. This will include:
    - `DATABASE_URL`: The connection string for your PostgreSQL database.
    - `DATABASE_ANON_KEY`: Your Supabase anonymous key (if using Supabase).
    - `GEMINI_API_KEY`: Your API key for Google Generative AI services.
    - Other service-specific keys or configurations.

3.  **Encryption (Optional but Recommended):**
    `dotenvx` provides commands to encrypt your environment files for better security.
    - To encrypt your local environment file:
      ```bash
      pnpm encrypt:local
      ```
    - To encrypt your production environment file:
      ```bash
      pnpm encrypt:prod
      ```
    This will generate encrypted versions (e.g., `.env.local.encrypted`). The application will then use these encrypted files when run with `dotenvx run`.

4.  **Decryption (If needed):**
    To decrypt an encrypted environment file (e.g., to view or edit it), use:
    ```bash
    pnpm decrypt
    ```
    You will be prompted to choose which file to decrypt.

The application uses `dotenvx run` in its `package.json` scripts (e.g., `dev`, `start`) to automatically load the correct environment variables (e.g., from `.env.local` for `pnpm dev` or `.env.production` for `pnpm start`), decrypting them if necessary.

## Available Scripts

This project uses [`pnpm`](https://pnpm.io/) as its package manager. Here are some of the available scripts:

| Script          | Description                                                                              |
|-----------------|------------------------------------------------------------------------------------------|
| `pnpm dev`        | Runs the application in development mode with hot-reloading using `tsx`.                   |
| `pnpm start`      | Runs the compiled application in production mode.                                        |
| `pnpm build`      | Compiles the TypeScript code to JavaScript for production.                               |
| `pnpm format`     | Formats the codebase using Prettier.                                                     |
| `pnpm format:check` | Checks if the codebase is formatted correctly with Prettier.                             |
| `pnpm encrypt`    | Encrypts environment files using `dotenvx`.                                              |
| `pnpm encrypt:local`| Encrypts the `.env.local` file.                                                        |
| `pnpm encrypt:prod` | Encrypts the `.env.production` file.                                                   |
| `pnpm decrypt`    | Decrypts environment files encrypted with `dotenvx`.                                       |
| `pnpm db:generate`| Generates database migration files based on schema changes using Drizzle Kit.              |
| `pnpm db:migrate` | Applies pending database migrations using Drizzle Kit.                                   |
| `pnpm db:studio`  | Starts the Drizzle Studio to view and manage the database.                               |
| `pnpm db:drop`    | Drops the database (use with caution).                                                   |
| `pnpm db:reset`   | Drops the database and then re-applies all migrations.                                   |
| `pnpm db:pull`    | Pulls the remote database schema and generates Drizzle schema (experimental).            |
| `pnpm db:push`    | Pushes schema changes directly to the database without generating migration files (for development). |
| `pnpm supabase:start` | Starts the local Supabase development environment.                                       |
| `pnpm supabase:stop`  | Stops the local Supabase development environment.                                        |
| `pnpm supabase:status`| Shows the status of the local Supabase services.                                         |

## API Endpoints

The API is structured into several modules. All routes are prefixed with `/api`.

### Public Routes

These endpoints are accessible without authentication.

-   **`/health`**
    -   `GET /`: Checks the health of the service, including database, authentication, and LLM connectivity. Returns a JSON object with the status of each component.
-   **`/auth`**
    -   `POST /register`: Registers a new user. Requires `email`, `password`, and `name` in the request body.
    -   `POST /login`: Logs in an existing user. Requires `email` and `password`. Returns a JWT token and user details.
    -   `POST /logout`: Placeholder for user logout. Advises client-side token clearance. (Note: This is effectively a synchronous operation on the backend, actual logout is client-side token management).

### Authenticated Routes

These endpoints require a valid JWT token passed in the `Authorization` header as a Bearer token. Access is managed by `authMiddleware`.

-   **`/auth`**
    -   `GET /me`: Retrieves the profile (`id`, `email`, `name`, `role`) of the currently authenticated user.
-   **`/chat`** (Manages chat interactions and related data)
    -   `POST /`: Sends a user's message to the AI and returns the response. Requires `message` (string) and optionally `conversationId` in the request body.
    -   `GET /`: Lists all conversations for the authenticated user. (Controller: `ChatController.listConversations` -> Service: `ChatService.listConversations`).
    -   `POST /search`: (Not Implemented) Intended for searching within messages. Currently returns a 501 status.
    -   `GET /switches/search`: Searches for mechanical switches based on a query string. Accepts an optional `limit` parameter.
    -   `GET /:conversationId`: Retrieves the message history for a specific conversation. (Controller: `ChatController.getConversation` -> Service: `ChatService.getConversation`).
    -   `DELETE /:conversationId`: Deletes a specific conversation and its associated messages. (Controller: `ChatController.deleteConversation` -> Service: `ChatService.deleteConversation`).
-   **`/conversations`** (CRUD operations for conversation metadata)
    -   `POST /`: Creates a new conversation. Accepts a `ConversationCreatePayload` (e.g., `title`).
    -   `GET /`: Retrieves all conversations belonging to the authenticated user.
    -   `GET /:id`: Retrieves a specific conversation by its UUID.
    -   `PUT /:id`: Updates an existing conversation (e.g., its title). Accepts a `ConversationUpdatePayload`.
    -   `DELETE /:id`: Deletes a specific conversation by its UUID.
-   **`/messages`** (CRUD operations for individual messages within conversations)
    -   `POST /`: Creates a new message within a specified conversation. Requires `conversationId`, `content`, and `role` in the request body.
    -   `GET /`: Retrieves messages for a given conversation. Requires `conversationId` as a query parameter. Supports `limit` and `offset` for pagination.
    -   `GET /:id`: Retrieves a specific message by its UUID.
    -   `PUT /:id`: Updates an existing message. Accepts a `MessageUpdatePayload`.
    -   `DELETE /:id`: Deletes a specific message by its UUID.
-   **`/users`** (User management, with role-based access controls)
    -   `GET /`: Retrieves a list of all users. (Admin access required).
    -   `GET /:id`: Retrieves a specific user by their UUID. (Admin access or requesting user must be the target user).
    -   `PUT /:id`: Updates a user's information (e.g., name, email). Password updates are not allowed via this endpoint. Accepts a `UserUpdatePayload`. (Admin access or requesting user must be the target user).
    -   `DELETE /:id`: Deletes a user by their UUID. (Admin access or requesting user must be the target user).

*(Note: This is a high-level overview. Specific request/response payloads, detailed authorization logic (e.g., ownership checks for resources), and error handling are defined in the respective controller and service files.)*

## Enhanced Comparison Feature

**Version 2.0** - The SwitchAI backend now includes advanced switch comparison functionality that automatically detects comparison intent and generates structured Markdown comparisons.

### Comparison Intent Detection

The `/api/chat` endpoint now intelligently detects when users are requesting switch comparisons through:

- **Pattern Recognition**: Detects phrases like "vs", "versus", "compare", "difference between", "which is better"
- **Embedding-Based Matching**: Uses semantic similarity search to match switch names with 0.5+ confidence threshold
- **Multi-Strategy Extraction**: Employs 6 different strategies including brand-based, color-based, and quoted switch extraction

### Request Format

Standard chat request with comparison queries:

```json
{
  "message": "Compare Gateron Oil King vs Cherry MX Red",
  "conversationId": "optional-uuid"
}
```

**Supported Comparison Patterns**:
- `"Gateron Oil King vs Cherry MX Red"`
- `"Compare Holy Panda and Glorious Panda"`
- `"What's the difference between Kailh Brown and Cherry Brown?"`
- `"Which is better: Gateron Yellow or Red for gaming?"`
- `"Cherry MX Blue vs Brown vs Red"` (3-switch comparisons)

### Response Format for Comparisons

When comparison intent is detected, the response includes enhanced metadata:

```json
{
  "id": "message-uuid",
  "role": "assistant",
  "content": "## Switch Comparison: Gateron Oil King vs Cherry MX Red\n\n### Overview\n...",
  "metadata": {
    "model": "gemini-1.5-flash",
    "isComparison": true,
    "comparisonValid": true,
    "comparisonConfidence": 0.85,
    "switchesCompared": ["Gateron Oil King", "Cherry MX Red"],
    "switchesFoundInDB": ["Gateron Oil King", "Cherry MX Red"],
    "missingSwitches": [],
    "hasDataGaps": false,
    "promptLength": 1245,
    "retrievalNotes": ["High confidence embedding match for both switches"]
  }
}
```

### Comparison Response Structure

All comparison responses follow a standardized Markdown format:

```markdown
## Switch Comparison: [Switch 1] vs [Switch 2] [vs Switch 3]

### Overview
[Brief 2-3 sentence summary of key differences]

### Technical Specifications
| Specification | Switch 1 | Switch 2 | Switch 3 |
|---------------|----------|----------|----------|
| Manufacturer  | Value    | Value    | Value    |
| Type          | Value    | Value    | Value    |
| ...           | ...      | ...      | ...      |

### In-Depth Analysis

#### Housing Materials
[Detailed material comparison]

#### Force & Weighting
[Force profile analysis]

#### Travel & Actuation
[Travel distance comparison]

#### Sound Profile
[Acoustic characteristics]

#### Feel & Tactility
[User experience comparison]

#### Use Case Suitability
[Gaming vs typing recommendations]

### Typing Experience Summary
[Overall experience synthesis]

### Conclusion
[Final recommendations with specific use cases]
```

### Comparison Features

- **Variable Switch Handling**: Supports 1-3+ switches with intelligent filtering
- **Missing Data Management**: Gracefully handles switches not in database with general knowledge attribution
- **Embedding-Based Matching**: Fuzzy name matching for variations like "gateron oil kings" → "Gateron Oil King"
- **Confidence Scoring**: Only generates comparisons with ≥0.5 confidence matches
- **Token Limit Compliance**: All responses ≤1500 tokens per FR15
- **Comprehensive Error Handling**: User-friendly messages for all failure scenarios

### Error Response Examples

**Insufficient Switches**:
```json
{
  "content": "I found \"Cherry MX Blue\" in your query. For a comparison, I need at least two switches...",
  "metadata": {
    "isComparison": true,
    "comparisonValid": false,
    "error": "insufficient_switches"
  }
}
```

**No Switches Found**:
```json
{
  "content": "I couldn't find any of the switches you mentioned in our database...",
  "metadata": {
    "isComparison": true, 
    "comparisonValid": false,
    "error": "no_switches_found"
  }
}
```

**Low Confidence Match**:
```json
{
  "content": "I found some potential switch matches but with low confidence. Could you please...",
  "metadata": {
    "isComparison": true,
    "comparisonValid": false,
    "comparisonConfidence": 0.3,
    "error": "low_confidence_match"
  }
}
```

### Testing

- **Postman Collection**: `/tasks/postman_collections/SwitchAI_Enhanced_Comparisons_Tests.postman_collection.json`
- **Test Plan**: `/tasks/postman_collections/Comparison_Test_Plan.md`  
- **Response Structure Guide**: `/tasks/postman_collections/Expected_Response_Structure.md`

### Implementation Notes

- Embedding service fallback to direct name matching if unavailable
- Database connection failure graceful degradation  
- LLM generation failure fallback to standard error messages
- Conversation history maintained across comparison interactions
- Full backward compatibility with non-comparison queries

---

## Database

This project uses [Drizzle ORM](https://orm.drizzle.team/) with a PostgreSQL database, managed via [Supabase](https://supabase.io/).

-   **Schema Definition:** The database schema is defined in `src/db/schema.ts`.
-   **ORM Configuration:** Drizzle ORM configuration can be found in `drizzle.config.ts`.
-   **Database Management Scripts:** The `package.json` includes several scripts for managing the database:
    -   `pnpm db:generate`: Generates database migration files based on schema changes.
    -   `pnpm db:migrate`: Applies pending database migrations.
    -   `pnpm db:studio`: Starts Drizzle Studio to view and manage the database.
    -   `pnpm db:drop`: Drops the database (use with caution).
    -   `pnpm db:reset`: Drops the database and then re-applies all migrations.
    -   `pnpm db:pull`: Pulls the remote database schema (experimental).
    -   `pnpm db:push`: Pushes schema changes directly to the database (for development).
    -   `pnpm supabase:start`: Starts the local Supabase development environment.
    -   `pnpm supabase:stop`: Stops the local Supabase development environment.
    -   `pnpm supabase:status`: Shows the status of local Supabase services.

For local development, ensure Supabase is running (e.g., using `pnpm supabase:start`) and environment variables for the database connection are correctly set up (see [Configuration](#configuration)).

## Contributing

Contributions are welcome! If you'd like to contribute to this project, please follow these general guidelines:

1.  **Fork the Repository:** Start by forking the main repository to your own GitHub account.
2.  **Create a Branch:** Create a new branch from `main` (or the relevant development branch) for your feature or bug fix. Use a descriptive branch name (e.g., `feat/add-new-endpoint` or `fix/user-auth-bug`).
3.  **Make Changes:** Implement your changes, ensuring you adhere to the project's coding style and conventions.
4.  **Test Your Changes:** If applicable, add or update tests for your changes and ensure all tests pass.
5.  **Commit Your Changes:** Write clear, concise, and descriptive commit messages.
6.  **Push to Your Fork:** Push your changes to your forked repository.
7.  **Open a Pull Request:** Open a pull request (PR) from your branch to the `main` branch of the original repository. Provide a clear description of the changes in your PR.

Your PR will be reviewed, and any necessary feedback will be provided. Thank you for your interest in contributing!

## License

This project is licensed under the terms of the [LICENSE](./LICENSE) file.
