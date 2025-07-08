# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Build the package:**
```bash
pnpm build
```

**Run tests:**
```bash
pnpm test
```

**Run tests with coverage:**
```bash
pnpm coverage
```

**Type checking:**
```bash
pnpm check
```

**Linting:**
```bash
pnpm lint
```

**Lint with auto-fix:**
```bash
pnpm lint-fix
```

**Execute TypeScript files directly:**
```bash
pnpm tsx ./path/to/file.ts
```

**Run a single test:**
```bash
pnpm test test/path/to/test.test.ts
```

## Architecture

This is a Text-to-SQL library built with Effect-ts that converts natural language questions into SQL queries and executes them against PostgreSQL databases.

### Core Components

**Effect-based Architecture:**
- Built on the Effect library for functional programming with proper error handling and composability
- Uses Effect's Context/Layer system for dependency injection
- All operations return Effects that can be composed and chained

**Main Services:**
- `TextToSqlService` - Handles natural language to SQL conversion using AI/LLM
- `QueryPipelineService` - Orchestrates the full query pipeline (validation, execution, explanation)
- `PostgresService` - Database operations and schema introspection
- `QdrantService` - Vector database for storing and retrieving schema embeddings
- `TrainingService` - Handles training the model on database schemas

**Key Dependencies:**
- `@ai-sdk/openai` and `ai` - AI/LLM integration for text-to-SQL generation
- `@qdrant/js-client-rest` - Vector database client for schema embeddings
- `pg` - PostgreSQL database client
- `effect` - Functional programming framework

### Source Structure

- `src/index.ts` - Main entry point exposing `SqlGen` class and `createSqlGen` factory
- `src/providers/postgres.ts` - PostgreSQL database provider and operations
- `src/providers/qdrant.ts` - Qdrant vector database provider
- `src/services/text-to-sql.ts` - AI-powered text-to-SQL generation service
- `src/services/query-pipeline.ts` - Query execution pipeline with validation
- `src/train.ts` - Training service for schema learning
- `src/example.ts` - Usage examples and demonstrations
- `test/` - Test files using Vitest with @effect/vitest integration

### Configuration

The library uses a comprehensive configuration system:

```typescript
interface SqlGenConfig {
  postgres: PostgresConfig    // Database connection settings
  qdrant: QdrantConfig       // Vector database settings
  textToSql: TextToSqlConfig // AI model configuration
  pipeline: QueryPipelineConfig // Query execution settings
}
```

**Build System:**
- Multi-target build (ESM, CJS, annotated) using TypeScript compiler and Babel
- Uses @effect/build-utils for export and index generation
- TypeScript with multiple tsconfig files for different build targets

**Testing:**
- Uses Vitest with @effect/vitest integration
- Test utilities in `test/utils/` for fixtures and helpers
- Path aliases configured (@template/basic maps to src/)

**Code Quality:**
- ESLint with Effect-specific rules and strict TypeScript configuration
- Babel plugins for pure call annotations and module transformations
- Uses pnpm with specific version (9.10.0)