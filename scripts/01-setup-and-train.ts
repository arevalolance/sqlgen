#!/usr/bin/env tsx

import { config } from "dotenv"
import { Effect } from "effect"
import { fileURLToPath } from "url"
import { createSqlGen } from "../src/index.js"
import { setupEnvironment } from "./config.js"

// Load environment variables
config({ path: "../.env" })

async function main() {
  console.log("🚀 SqlGen Setup and Training Script")
  console.log("===================================\n")

  try {
    // Setup configuration
    const sqlGenConfig = setupEnvironment()
    const sqlGen = createSqlGen(sqlGenConfig)

    console.log("✅ Configuration loaded successfully")
    console.log("📊 Starting database schema discovery and training...\n")

    // Train from database
    console.log("🔍 Discovering database schema...")
    await Effect.runPromise(sqlGen.trainFromDatabase())

    console.log("✅ Database schema discovery completed")
    console.log("🧠 Training vector embeddings...")

    console.log("✅ Training completed successfully!\n")

    // Show training results
    console.log("📈 Training Results:")
    console.log("==================")
    console.log(
      `✓ Database connection: ${sqlGenConfig.postgres.host}:${sqlGenConfig.postgres.port}/${sqlGenConfig.postgres.database}`
    )
    console.log(`✓ Vector database: ${sqlGenConfig.qdrant.url}`)
    console.log(`✓ Collection: ${sqlGenConfig.qdrant.collectionName}`)
    console.log(`✓ AI Model: ${sqlGenConfig.textToSql.model}`)
    console.log(`✓ Embedding Model: ${sqlGenConfig.textToSql.embeddingModel}`)
    console.log("")

    // Test a simple query to verify setup
    console.log("🧪 Testing setup with a simple query...")
    const testQuestion = "Show me all tables in the database"

    console.log(`Question: "${testQuestion}"`)
    console.log("Processing...")

    const result = await Effect.runPromise(sqlGen.ask(testQuestion))

    console.log("✅ Test query successful!")
    console.log("📊 Query Result:")
    console.log("================")
    console.log(`SQL: ${result.sql}`)
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`)
    console.log(`Explanation: ${result.explanation}`)
    console.log(`Execution Time: ${result.executionTime}ms`)
    console.log(`Results: ${result.results.length} rows`)

    if (result.results.length > 0) {
      console.log("\n📋 Sample Results:")
      console.log(result.results.slice(0, 5).map((row, i) => `${i + 1}. ${JSON.stringify(row)}`).join("\n"))
      if (result.results.length > 5) {
        console.log(`... and ${result.results.length - 5} more rows`)
      }
    }

    console.log("\n🎉 Setup and training completed successfully!")
    console.log("You can now run the other example scripts to see SqlGen in action.")
  } catch (error) {
    console.error("❌ Setup failed:", error)

    if (error instanceof Error) {
      console.error("\n🔍 Error Details:")
      console.error(`Message: ${error.message}`)

      if (error.message.includes("OPENAI_API_KEY")) {
        console.error("\n💡 Make sure to set your OpenAI API key in the .env file")
      }

      if (error.message.includes("database") || error.message.includes("connection")) {
        console.error("\n💡 Check your database connection settings in the .env file")
      }

      if (error.message.includes("qdrant") || error.message.includes("vector")) {
        console.error("\n💡 Make sure Qdrant is running and accessible at the configured URL")
      }
    }

    process.exit(1)
  }
}

// Check if this script is being run directly
const __filename = fileURLToPath(import.meta.url)
const isMainModule = process.argv[1] === __filename

if (isMainModule) {
  main()
}

export { main as setupAndTrain }
