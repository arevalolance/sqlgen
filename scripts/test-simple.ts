#!/usr/bin/env tsx

import { config } from "dotenv"
import { Effect } from "effect"
import { createSqlGen } from "../src/index.js"

// Load environment variables
config({ path: "../.env" })

async function test() {
  try {
    console.log("Testing basic SqlGen setup...")

    const sqlGenConfig = {
      postgres: {
        host: "localhost",
        port: 5432,
        database: "dashboard_dev",
        user: "postgres",
        password: "postgres",
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

    const sqlGen = createSqlGen(sqlGenConfig)
    console.log("✅ SqlGen instance created successfully")

    // Test ask method
    const result = await Effect.runPromise(sqlGen.ask("What tables exist in the database?"))
    console.log("✅ Ask method works:", result)
  } catch (error) {
    console.error("❌ Test failed:", error)
    if (error instanceof Error) {
      console.error("Stack:", error.stack)
    }
  }
}

test()
