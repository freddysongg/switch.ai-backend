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
