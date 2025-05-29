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
