# backend-switchai

Your Mechanical Switch Assistant Backend

<pre>
    ███████╗██╗    ██╗██╗████████╗ ██████╗██╗  ██╗    █████╗ ██╗
    ██╔════╝██║    ██║██║╚══██╔══╝██╔════╝██║  ██║  ██╔══██╗██║
    ███████╗██║ █╗ ██║██║   ██║   ██║     ███████║  ███████║██║     
    ╚════██║██║███╗██║██║   ██║   ██║     ██╔══██║  ██╔══██║██║
    ███████║╚███╔███╔╝██║   ██║   ╚██████╗██║  ██║  ██║  ██║██║
    ╚══════╝ ╚══╝╚══╝ ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝  ╚═╝  ╚═╝╚═╝
</pre>

## Overview

Backend service for the SwitchAI mechanical switch assistant, providing AI-powered chat, switch comparisons, and database management through a RESTful API.

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL with Drizzle ORM
- **AI:** Google Gemini / Anthropic Claude
- **RAG:** LangChain with hybrid search
- **Infrastructure:** Supabase
- **Package Manager:** pnpm

## Quick Start

### Prerequisites

- Node.js (LTS version)
- pnpm (`npm install -g pnpm`)
- Supabase CLI (optional for local development)

### Installation

```bash
# Clone and install
git clone <repository_url>
cd backend-switchai
pnpm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Start database (if using local Supabase)
pnpm supabase:start

# Run in development
pnpm dev
```

### Environment Configuration

Required environment variables in `.env.local`:

```env
# Database
DATABASE_URL=postgresql://...
DATABASE_ANON_KEY=your-supabase-anon-key

# AI Provider (choose one)
GEMINI_API_KEY=your-gemini-key
CLAUDE_API_KEY=your-claude-key
IS_CLAUDE=false  # Set to "true" to use Claude instead of Gemini

# Security
JWT_SECRET=your-secure-jwt-secret-min-32-chars

# LangChain (for RAG and tracing)
LANGCHAIN_API_KEY=your-langsmith-key
LANGCHAIN_PROJECT=SwitchAI-RAG-Evaluation
LANGCHAIN_TRACING_V2=true
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm start` | Start production server |
| `pnpm build` | Build for production |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm format` | Format code with Prettier |

## Architecture

### Core Services

```
src/
├── controllers/     # HTTP request handlers
├── services/        # Business logic
│   ├── chat.ts      # Main chat service
│   ├── langchain/   # RAG implementation
│   └── llm.factory.ts # AI provider abstraction
├── db/              # Database schema and config
├── middleware/      # Security and validation
├── routes/          # API route definitions
└── utils/           # Helper utilities
```

### LangChain RAG Pipeline

The system uses LangChain Expression Language (LCEL) for retrieval-augmented generation:

**Key Components:**
- `langchain/wrappers.ts` - Custom retriever and embeddings classes
- `langchain/chain.ts` - LCEL pipeline with query re-phrasing and document reordering
- `langchain/evaluation.ts` - LangSmith integration for testing and evaluation

**Flow:**
1. User query → Input sanitization
2. Query embedding → Hybrid search (vector + keyword)
3. Context retrieval → Document ranking
4. LLM generation → Response validation
5. LangSmith tracing → Performance monitoring

### API Structure

**Public Endpoints:**
- `GET /health` - Health check
- `POST /auth/login` - User authentication
- `POST /auth/register` - User registration

**Authenticated Endpoints:**
- `POST /api/chat` - AI chat with switch comparison detection
- `GET /api/conversations` - List user conversations
- `GET/POST/PUT/DELETE /api/messages` - Message management
- `GET/PUT/DELETE /api/users` - User management

### Security Features

- **Input Sanitization:** 25+ pattern detection for prompt injection, XSS, SQL injection
- **Rate Limiting:** IP-based and user-based limits with burst protection  
- **PII Protection:** Automatic detection and scrubbing of sensitive data
- **CSP Headers:** Content Security Policy implementation
- **Secrets Management:** Centralized configuration with validation

### Database Schema

```sql
-- Core tables
users (id, email, name, role, created_at)
conversations (id, user_id, title, created_at)
messages (id, conversation_id, role, content, metadata)
switches (id, name, manufacturer, specifications, embeddings)
```

## Development

### Running Tests

```bash
pnpm test                    # All tests
pnpm test:security          # Security tests
pnpm test:langchain         # RAG pipeline tests
```

### LangChain Evaluation

```bash
pnpm eval:setup             # Create test datasets
pnpm eval:quick             # Quick evaluation
pnpm eval:comprehensive     # Full evaluation suite
```

### Database Management

```bash
pnpm db:generate            # Generate migrations
pnpm db:migrate             # Apply migrations
pnpm db:studio              # Database browser
pnpm db:reset               # Reset database
```

## Production Deployment

1. Set production environment variables
2. Build the application: `pnpm build`
3. Run migrations: `pnpm db:migrate`
4. Start the server: `pnpm start`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run security checks: `pnpm audit:security`
5. Submit a pull request

## License

See [LICENSE](./LICENSE) file for details.
