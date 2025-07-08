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
      user_id INTEGER REFERENCES users(id),
      total_amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,

  products: `
    CREATE TABLE products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      description TEXT,
      category_id INTEGER,
      in_stock BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,

  categories: `
    CREATE TABLE categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      parent_id INTEGER REFERENCES categories(id)
    );
  `
}

// Complete schema with all tables
export const completeSchema = Object.values(testDDLs).join("\n\n")

// Test questions for natural language queries
export const testQuestions = [
  {
    question: "Show me all users",
    expectedSQL: "SELECT * FROM users",
    description: "Simple select all query"
  },
  {
    question: "Find users created in the last 30 days",
    expectedSQL: "SELECT * FROM users WHERE created_at > NOW() - INTERVAL '30 days'",
    description: "Date filtering query"
  },
  {
    question: "How many orders are pending?",
    expectedSQL: "SELECT COUNT(*) FROM orders WHERE status = 'pending'",
    description: "Count with filtering"
  },
  {
    question: "What's the total revenue from completed orders?",
    expectedSQL: "SELECT SUM(total_amount) FROM orders WHERE status = 'completed'",
    description: "Aggregation query"
  },
  {
    question: "Show me users with their order count",
    expectedSQL:
      "SELECT u.name, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id, u.name",
    description: "Join with aggregation"
  }
]

// Test vector records for Qdrant
export const testVectorRecords = [
  {
    id: "schema_1",
    vector: Array.from({ length: 1536 }, () => Math.random() - 0.5),
    payload: {
      content: testDDLs.users,
      metadata: {
        type: "schema",
        table: "users",
        timestamp: "2024-01-01T00:00:00Z"
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
        table: "orders",
        timestamp: "2024-01-01T00:00:00Z"
      }
    }
  }
]

// Test query results
export const testQueryResults = {
  users: [
    { id: 1, name: "John Doe", email: "john@example.com", created_at: "2024-01-01T00:00:00Z" },
    { id: 2, name: "Jane Smith", email: "jane@example.com", created_at: "2024-01-02T00:00:00Z" },
    { id: 3, name: "Bob Johnson", email: "bob@example.com", created_at: "2024-01-03T00:00:00Z" }
  ],

  orders: [
    { id: 1, user_id: 1, total_amount: "99.99", status: "completed", created_at: "2024-01-01T00:00:00Z" },
    { id: 2, user_id: 2, total_amount: "149.99", status: "pending", created_at: "2024-01-02T00:00:00Z" },
    { id: 3, user_id: 1, total_amount: "299.99", status: "shipped", created_at: "2024-01-03T00:00:00Z" },
    { id: 4, user_id: 3, total_amount: "49.99", status: "completed", created_at: "2024-01-04T00:00:00Z" }
  ],

  tableNames: ["users", "orders", "products", "categories"],

  explainPlan: [
    { "Query Plan": "Seq Scan on users (cost=0.00..1.04 rows=4 width=36)" }
  ]
}

// Configuration objects for different test scenarios
export const testConfigs = {
  minimal: {
    postgres: {
      host: "localhost",
      port: 5432,
      database: "test_db",
      user: "test_user",
      password: "test_password",
      ssl: false
    },
    qdrant: {
      url: "http://localhost:6333",
      collectionName: "test_collection"
    },
    textToSql: {
      model: "gpt-4",
      embeddingModel: "text-embedding-3-small"
    },
    pipeline: {
      minConfidence: 0.5,
      dryRun: true,
      maxRetries: 1
    }
  },

  production: {
    postgres: {
      host: "localhost",
      port: 5432,
      database: "prod_db",
      user: "prod_user",
      password: "prod_password",
      ssl: true
    },
    qdrant: {
      url: "http://localhost:6333",
      apiKey: "test-api-key",
      collectionName: "prod_collection"
    },
    textToSql: {
      model: "gpt-4",
      embeddingModel: "text-embedding-3-small",
      maxTokens: 2000,
      temperature: 0.0
    },
    pipeline: {
      minConfidence: 0.8,
      dryRun: false,
      maxRetries: 3
    }
  }
}

// Error scenarios for testing
export const testErrors = {
  postgresConnectionError: new Error("Connection refused"),
  qdrantNetworkError: new Error("Network timeout"),
  openaiApiError: new Error("OpenAI API rate limit exceeded"),
  invalidSQLError: new Error("SQL syntax error"),
  lowConfidenceError: new Error("Generated SQL has low confidence")
}
