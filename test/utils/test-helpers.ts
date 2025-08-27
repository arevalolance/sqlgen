import type { PostgresConfig } from "@template/basic/providers/postgres.js"
import type { QdrantConfig } from "@template/basic/providers/qdrant.js"
import type { QueryPipelineConfig } from "@template/basic/services/query-pipeline.js"
import type { TextToSqlConfig } from "@template/basic/services/text-to-sql.js"
import { Effect, Layer } from "effect"
import { newDb } from "pg-mem"
import { vi } from "@effect/vitest"

// Mock PostgreSQL configuration for testing
export const mockPostgresConfig: PostgresConfig = {
  host: "localhost",
  port: 5432,
  database: "test_db",
  user: "test_user",
  password: "test_password",
  ssl: false
}

// Mock Qdrant configuration for testing
export const mockQdrantConfig: QdrantConfig = {
  url: "http://localhost:6333",
  collectionName: "test_collection"
}

// Mock Text-to-SQL configuration for testing
export const mockTextToSqlConfig: TextToSqlConfig = {
  model: "gpt-4",
  embeddingModel: "text-embedding-3-small",
  maxTokens: 1000,
  temperature: 0.1
}

// Mock Query Pipeline configuration for testing
export const mockQueryPipelineConfig: QueryPipelineConfig = {
  minConfidence: 0.7,
  dryRun: false,
  maxRetries: 3
}

// Create an in-memory PostgreSQL database for testing
export const createTestDatabase = () => {
  const db = newDb()

  // Create test schema
  db.public.none(`
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      total_amount NUMERIC NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `)

  // Insert test data
  db.public.none(`
    INSERT INTO users (name, email) VALUES 
    ('John Doe', 'john@example.com'),
    ('Jane Smith', 'jane@example.com'),
    ('Bob Johnson', 'bob@example.com');
    
    INSERT INTO orders (user_id, total_amount, status) VALUES 
    (1, 99.99, 'completed'),
    (2, 149.99, 'pending'),
    (1, 299.99, 'shipped'),
    (3, 49.99, 'completed');
  `)

  return db
}

// Mock OpenAI API responses
export const mockOpenAIResponses = {
  embedding: {
    embedding: Array.from({ length: 1536 }, () => Math.random() - 0.5),
    usage: { prompt_tokens: 10, total_tokens: 10 }
  },
  generateText: {
    text: JSON.stringify({
      sql: "SELECT * FROM users WHERE created_at > NOW() - INTERVAL '30 days'",
      confidence: 0.95,
      explanation: "This query selects all users created in the last 30 days"
    }),
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
  }
}

// Mock Qdrant client
export class MockQdrantClient {
  private collections: Array<{ name: string; config: any }> = []
  private vectors: Map<string, Array<any>> = new Map()

  async getCollections() {
    return {
      collections: this.collections
    }
  }

  async createCollection(name: string, config: any) {
    this.collections.push({ name, config })
    this.vectors.set(name, [])
    return { result: true }
  }

  async upsert(collectionName: string, data: any) {
    const vectors = this.vectors.get(collectionName) || []
    const updatedVectors = vectors.concat(data.points)
    this.vectors.set(collectionName, updatedVectors)
    return { result: true }
  }

  async search(collectionName: string, params: any) {
    const vectors = this.vectors.get(collectionName) || []
    // Return mock search results
    return vectors.slice(0, params.limit || 10).map((point, index) => ({
      id: point.id,
      score: 0.9 - (index * 0.1),
      payload: point.payload,
      vector: point.vector
    }))
  }

  async deleteCollection(collectionName: string) {
    this.collections = this.collections.filter((c) => c.name !== collectionName)
    this.vectors.delete(collectionName)
    return { result: true }
  }
}

// Test DDL fixtures for training
export const testDDLs = {
  users: `
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,
  orders: `
    CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      total_amount NUMERIC NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,
  products: `
    CREATE TABLE products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price NUMERIC NOT NULL,
      description TEXT
    );
  `
}

// Test vector records for Qdrant
export const testVectorRecords = [
  {
    id: "schema_1",
    vector: Array.from({ length: 1536 }, () => Math.random() - 0.5),
    payload: {
      content: testDDLs.users,
      metadata: {
        type: "schema",
        table: "users"
      }
    }
  },
  {
    id: "schema_2", 
    vector: Array.from({ length: 1536 }, () => Math.random() - 0.5),
    payload: {
      content: testDDLs.orders,
      metadata: {
        type: "schema",
        table: "orders"
      }
    }
  }
]

// Additional test fixture
export const completeSchema = `
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    total_amount NUMERIC NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`

// Mock TextToSql service for tests
export const mockTextToSqlService = {
  generateSql: vi.fn(),
  trainFromSchema: vi.fn(),
  executeQuery: vi.fn()
}

// Helper to create test Effects that can be safely run
export const runTestEffect = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect)

// Helper to create test layers
export const createTestLayers = () => {
  // We'll implement specific test layers for each provider in their respective test files
  return Layer.empty
}

// Test assertion helpers
export const expectEffect = {
  toSucceed: async <A, E>(effect: Effect.Effect<A, E>) => {
    const result = await Effect.runPromise(Effect.either(effect))
    if (result._tag === "Left") {
      throw new Error(`Expected effect to succeed, but it failed with: ${result.left}`)
    }
    return result.right
  },

  toFail: async <A, E>(effect: Effect.Effect<A, E>) => {
    const result = await Effect.runPromise(Effect.either(effect))
    if (result._tag === "Right") {
      throw new Error(`Expected effect to fail, but it succeeded with: ${result.right}`)
    }
    return result.left
  }
}
