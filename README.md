# SqlGen - Text-to-SQL Library for TypeScript

A powerful TypeScript library for generating SQL queries from natural language using AI, built with Effect-ts.

## Features

- **Text-to-SQL Generation**: Convert natural language questions to SQL queries
- **Vector-based Schema Training**: Uses Qdrant for storing and retrieving schema context
- **PostgreSQL Support**: Native PostgreSQL integration with schema introspection
- **Effect-ts Architecture**: Built on Effect-ts for composable, type-safe error handling
- **AI SDK Integration**: Uses Vercel's AI SDK for LLM interactions
- **Query Validation**: Validates generated SQL before execution
- **Training Pipeline**: Train on your database schema or custom DDL

## Installation

```bash
npm install sqlgen
# or
pnpm add sqlgen
# or
yarn add sqlgen
```

## Required Dependencies

You'll also need to install the peer dependencies:

```bash
pnpm add ai @ai-sdk/openai pg @qdrant/js-client-rest effect
pnpm add -D @types/pg
```

## Quick Start

```typescript
import { createSqlGen } from 'sqlgen'
import { Effect } from 'effect'

// Configure your SqlGen instance
const config = {
  postgres: {
    host: "localhost",
    port: 5432,
    database: "your_database",
    user: "your_user",
    password: "your_password",
    ssl: false
  },
  qdrant: {
    url: "http://localhost:6333",
    collectionName: "sql_schemas"
  },
  textToSql: {
    model: "gpt-4",
    embeddingModel: "text-embedding-3-small",
    maxTokens: 1000,
    temperature: 0.1
  },
  pipeline: {
    minConfidence: 0.7,
    dryRun: false,
    maxRetries: 3
  }
}

const sqlGen = createSqlGen(config)

// Train from DDL
const ddl = `
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL
  );
`

// Example usage with Effect.runPromise
const example = async () => {
  try {
    // Train the model
    await Effect.runPromise(sqlGen.trainFromDdl(ddl))
    
    // Ask a question
    const result = await Effect.runPromise(
      sqlGen.ask("Show me all users created in the last 30 days")
    )
    
    console.log("Generated SQL:", result.sql)
    console.log("Results:", result.results)
  } catch (error) {
    console.error("Error:", error)
  }
}
```

## API Reference

### SqlGen Class

#### Methods

- `ask(question: string)` - Generate and execute SQL from natural language
- `trainFromDatabase()` - Train on existing database schema
- `trainFromDdl(ddl: string)` - Train on provided DDL statement
- `trainFromDdlArray(ddls: string[])` - Train on multiple DDL statements
- `validateSql(sql: string)` - Validate SQL syntax
- `explainQuery(sql: string)` - Get query execution plan

### Configuration

#### PostgresConfig
- `host: string` - Database host
- `port: number` - Database port
- `database: string` - Database name
- `user: string` - Database user
- `password: string` - Database password
- `ssl?: boolean` - Enable SSL

#### QdrantConfig
- `url: string` - Qdrant server URL
- `apiKey?: string` - Optional API key
- `collectionName: string` - Collection name for storing vectors

#### TextToSqlConfig
- `model: string` - LLM model (e.g., "gpt-4")
- `embeddingModel: string` - Embedding model (e.g., "text-embedding-3-small")
- `maxTokens?: number` - Maximum tokens (default: 1000)
- `temperature?: number` - Temperature (default: 0.1)

#### QueryPipelineConfig
- `minConfidence: number` - Minimum confidence threshold (0-1)
- `dryRun: boolean` - Whether to execute queries or just generate
- `maxRetries: number` - Maximum retry attempts

## Prerequisites

1. **PostgreSQL Database** - Running instance with your data
2. **Qdrant Vector Database** - For storing schema embeddings
3. **OpenAI API Key** - Set as environment variable `OPENAI_API_KEY`

## Architecture

The library is built with Effect-ts and follows these principles:

- **Composability**: All operations return Effects that can be composed
- **Type Safety**: Full TypeScript support with proper error types
- **Error Handling**: Structured error handling with Effect-ts
- **Dependency Injection**: Services are provided through Effect's Layer system

## Development

**Building**

```sh
pnpm build
```

**Testing**

```sh
pnpm test
```

**Type Checking**

```sh
pnpm check
```

**Linting**

```sh
pnpm lint
```

## License

MIT License - see LICENSE file for details.
