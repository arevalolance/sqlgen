import { createSqlGen } from "./index.js"

// Example configuration
export const config = {
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

// Create SqlGen instance
export const sqlGen = createSqlGen(config)

// Example DDL for training
export const exampleDdl = `
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`
