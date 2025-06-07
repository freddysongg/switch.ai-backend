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
- [Security Features](#security-features)
  - [Rate Limiting](#rate-limiting)
  - [API Timeouts](#api-timeouts)

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

## Security Features

SwitchAI backend implements a comprehensive, multi-layered security framework designed to protect against common web vulnerabilities, prompt injection attacks, and data breaches. All security measures follow industry best practices and are continuously tested through automated CI/CD pipelines.

### 🛡️ Input Sanitization & Prompt Injection Protection

**Advanced Input Sanitization Middleware (`src/middleware/inputSanitization.ts`)**

The application employs sophisticated input sanitization that protects against 25+ types of prompt injection patterns, SQL injection, XSS, and command injection attacks.

**Features:**
- **Multi-Pattern Detection**: Blocks direct instruction patterns (`ignore previous instructions`), system override attempts (`system:`, `[admin]`), and injection templates (`{{code}}`, `<%exec%>`)
- **Advanced Obfuscation Detection**: Identifies Base64, hex, Unicode, and other encoding attempts to bypass filters
- **Special Character Validation**: Limits special character density (max 30%), consecutive special chars (max 5), and blocks control characters
- **Security Risk Classification**: Categorizes threats as `low`, `medium`, `high`, or `critical` with confidence scoring
- **Comprehensive Logging**: Records all security events with IP tracking, user identification, and violation details

**Implementation:**
```typescript
// Applied globally to all API endpoints
export const inputSanitization = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitizes all request body, query, and parameter inputs
  // Blocks requests with detected violations
  // Logs security events for monitoring
}
```

**Blocked Attack Patterns Include:**
- Prompt injection: `ignore all previous instructions`, `act as if you are`, `pretend to be`
- System overrides: `system:`, `[admin]`, `<assistant>`, `<user>`
- Code execution: `execute`, `eval`, `import`, `require`
- SQL injection: `union select`, `drop table`, `insert into`
- XSS attempts: `<script>`, `javascript:`, `on[event]=`
- Command injection: `;`, `|`, `&&`, `$(command)`

### 🏷️ User Input Wrapping & Context Protection

**Secure Prompt Construction**

All user-provided input is automatically wrapped in `<user_query>` tags before being sent to the LLM, providing clear boundaries between user input and system instructions.

**Implementation Locations:**
- `src/services/promptBuilder.ts` - Main prompt construction
- `src/services/rerankService.ts` - Query processing 
- `src/services/chat.ts` - Chat message handling
- `src/config/ai.config.ts` - Fallback prompts
- `src/utils/promptTemplates.ts` - Template rendering
- `src/utils/promptHelper.ts` - Intent recognition

**Database Content Sanitization (`src/utils/databaseSanitizer.ts`)**

Sanitizes all content retrieved from the database before inclusion in LLM prompts:
```typescript
export function sanitizeDatabaseContent(content: string): string {
  // Removes potential injection patterns from stored data
  // Validates content integrity
  // Logs suspicious database content
}
```

### 📋 Comprehensive Input Validation

**Zod Schema Validation (`src/schemas/validation.ts`)**

Type-safe validation for all API endpoints using 20+ Zod schemas with strict validation rules:

**Features:**
- **Length Limits**: Maximum input lengths to prevent buffer overflow attacks
- **Format Validation**: Email, UUID, URL, and custom format validation
- **Prompt Injection Detection**: Schema-level pattern detection
- **Type Safety**: Runtime type checking with TypeScript integration
- **File Upload Validation**: Secure file type and size validation

**Applied To:**
- Chat endpoints (`src/routes/chat.ts`)
- Analysis routes (`src/routes/analysisRoutes.ts`) 
- User management (`src/routes/user.ts`)
- All API request/response validation

### 🔐 Secrets Management & Environment Security

**Centralized Secrets Manager (`src/config/secrets.ts`)**

Production-ready secrets management with runtime validation and security features:

**Features:**
- **Runtime Loading**: All secrets loaded and validated at application startup
- **Type Safety**: TypeScript interfaces for all secret configurations
- **Validation**: Strength checks for JWT secrets, format validation for API keys
- **Redaction**: Automatic secret redaction in logs and debug output
- **Error Handling**: Detailed startup errors for missing or invalid secrets

**Managed Secrets:**
```typescript
interface ApplicationSecrets {
  DATABASE_URL: string;           // PostgreSQL connection with validation
  JWT_SECRET: string;            // Minimum 32 characters required  
  GEMINI_API_KEY: string;        // API key format validation
  NODE_ENV: string;              // Environment validation
  PORT: string;                  // Port range validation (1-65535)
}
```

**Implementation:**
```typescript
// Centralized access to all secrets
import { getSecret, getSecrets } from '@/config/secrets';

// Type-safe secret access
const jwtSecret = getSecret('JWT_SECRET');
const dbUrl = getSecret('DATABASE_URL');
```

### 🔍 Automated Security Auditing

**Hardcoded Secret Detection (`backend-switchai/scripts/audit-secrets.js`)**

Automated scanning for hardcoded secrets, API keys, and credentials:

**Detection Patterns:**
- API keys: AWS, Google, GitHub, generic API patterns
- Database credentials: Connection strings, passwords
- JWT secrets: Token patterns, signing keys
- Encryption keys: Base64 encoded secrets
- OAuth tokens: Access tokens, refresh tokens

**CI Integration:**
- Runs on every commit and pull request
- Fails builds on CRITICAL or HIGH severity violations
- Generates detailed security reports
- 25+ secret pattern detection rules

### 🔒 Content Security Policy (CSP)

**Frontend Protection (`src/middleware/csp.ts`)**

Strict Content Security Policy implementation to prevent XSS, clickjacking, and injection attacks:

**CSP Directives:**
```typescript
"default-src 'self'",
"script-src 'self' 'unsafe-inline'",
"style-src 'self' 'unsafe-inline'", 
"img-src 'self' data: https:",
"connect-src 'self'",
"frame-ancestors 'none'",
"base-uri 'self'",
"form-action 'self'"
```

**Additional Security Headers:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` 
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

### 🧹 PII Protection & Data Scrubbing

**PII Scrubbing Utility (`src/utils/pii-scrubber.ts`)**

Automatic detection and scrubbing of Personally Identifiable Information:

**Protected Data Types:**
- Email addresses (scrubbed to `[email protected]`)
- Phone numbers (scrubbed to `[phone]`)
- Social Security Numbers (scrubbed to `[ssn]`)
- Credit card numbers (scrubbed to `[credit_card]`)
- IP addresses (scrubbed to `[ip_address]`)
- Physical addresses (scrubbed to `[address]`)

**Implementation:**
```typescript
export function scrubPII(text: string): string {
  // Regex-based detection and replacement
  // Maintains text structure while removing sensitive data
  // Logs PII detection events for audit trails
}
```

### 🚦 Rate Limiting & API Protection

**Comprehensive Rate Limiting**

Multi-tier rate limiting system protecting against abuse and DDoS attacks:

**Anonymous Users:**
- 20 requests per hour
- 2 concurrent requests maximum (burst protection)

**Authenticated Users:**
- 50 requests per hour  
- 5 concurrent requests maximum (burst protection)
- Database-backed tracking per user and endpoint

**Features:**
- IP-based rate limiting for anonymous users
- User-based rate limiting for authenticated users
- Burst protection to prevent rapid-fire requests
- Automatic cleanup of expired rate limit records
- Proper HTTP 429 responses with retry-after information

**Implementation:**
- Custom middleware in `src/middleware/rateLimiter.ts`
- Applied to all `/api/*` endpoints
- Uses in-memory storage for burst control and IP limits
- Uses database storage for authenticated user limits

### ⏱️ API Timeouts

**Configurable Timeout Protection**

Prevents hanging requests and ensures responsive service:

**Gemini API Timeouts:**
- Regular API calls: 30 seconds timeout
- Health check calls: 10 seconds timeout
- Configurable via `AI_CONFIG.API_TIMEOUT_MS` and `AI_CONFIG.HEALTH_CHECK_TIMEOUT_MS`

**Features:**
- Promise.race() based timeout implementation
- Graceful error handling for timeout scenarios
- Clear timeout error messages to users
- AbortController integration for proper cleanup

**Implementation:**
- Timeout wrapper in `src/services/gemini.ts`
- Health check timeout in `src/controllers/health.ts`
- Configuration centralized in `src/config/ai.config.ts`

### 🧪 Security Testing & CI/CD Integration

**Comprehensive Security Test Suite (`src/tests/security.test.ts`)**

100+ automated security tests covering all attack vectors:

**Test Categories:**
- **Prompt Injection**: 30+ test cases for instruction override attempts
- **SQL Injection**: 20+ test cases for database attack patterns  
- **XSS Protection**: 15+ test cases for script injection attempts
- **Command Injection**: 10+ test cases for system command execution
- **Input Validation**: 25+ test cases for malformed data handling
- **Rate Limiting**: 10+ test cases for abuse protection

**CI/CD Security Pipeline (`.github/workflows/security-tests.yml`)**

Automated security scanning on every build:

**Pipeline Features:**
- **Dependency Scanning**: npm audit with vulnerability reporting
- **Secret Auditing**: Hardcoded secret detection
- **Security Test Execution**: Full test suite run
- **Build Failure**: Automatic failure on high/critical vulnerabilities
- **Security Reporting**: Detailed security scan results

**Local Security Commands:**
```bash
# Run comprehensive security audit
pnpm audit:security

# Check for hardcoded secrets  
pnpm audit:secrets

# Run security test suite
pnpm test:security

# Fix low-risk vulnerabilities
pnpm audit:fix
```

### 📊 Security Monitoring & Logging

**Enhanced Security Logging**

All security events are logged with detailed metadata for monitoring and incident response:

**Logged Events:**
- Input sanitization violations with risk classification
- Rate limiting violations with IP and user tracking
- PII detection events with scrubbing details
- Authentication failures and suspicious activity
- Secret access and validation events

**Log Format:**
```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "SECURITY_WARNING",
  "event": "input_sanitization_violation", 
  "ip": "192.168.1.1",
  "userId": "user-uuid",
  "risk": "high",
  "violations": ["prompt_injection", "excessive_special_chars"],
  "endpoint": "/api/chat",
  "userAgent": "Mozilla/5.0..."
}
```

### 🎯 Security Best Practices Implemented

**Application Security:**
- ✅ Input sanitization and validation on all endpoints
- ✅ Prompt injection protection with 25+ pattern detection
- ✅ SQL injection prevention through parameterized queries
- ✅ XSS protection via CSP and input sanitization
- ✅ Command injection blocking
- ✅ PII detection and scrubbing
- ✅ Rate limiting and DDoS protection
- ✅ API timeout protection

**Infrastructure Security:**
- ✅ Centralized secrets management
- ✅ Environment variable validation  
- ✅ No hardcoded credentials
- ✅ Secure database connections
- ✅ Production-ready error handling
- ✅ Security header implementation

**Development Security:**
- ✅ Automated dependency scanning
- ✅ Security test automation
- ✅ CI/CD security pipeline
- ✅ Secret auditing automation
- ✅ Vulnerability monitoring
- ✅ Security event logging

**Compliance & Monitoring:**
- ✅ OWASP Top 10 coverage
- ✅ Security incident logging
- ✅ Audit trail maintenance  
- ✅ Performance monitoring
- ✅ Error tracking and alerting

### 📚 Security Documentation

For detailed security procedures and incident response, see:

- `SECURITY_AUDIT.md` - Comprehensive security audit procedures
- `tasks/tasks-prd-actionable-security-hardening-plan.md` - Security implementation roadmap
- `src/tests/security.test.ts` - Security test specifications
- `.github/workflows/security-tests.yml` - CI/CD security automation

### 🚨 Security Incident Response

**If you discover a security vulnerability:**

1. **Do NOT** create a public GitHub issue
2. Email security concerns to: [security email - to be configured]
3. Include detailed description and reproduction steps
4. Allow 48-72 hours for initial response
5. Coordinate disclosure timeline with maintainers

**For security questions or reporting:**
- Review existing security tests and documentation
- Check CI/CD pipeline for automated security scanning
- Consult security audit documentation for procedures
