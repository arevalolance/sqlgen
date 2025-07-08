#!/usr/bin/env tsx

import { config } from 'dotenv'
import { Effect } from 'effect'
import { fileURLToPath } from 'url'
import { createSqlGen } from '../src/index.js'
import { setupEnvironment } from './config.js'

// Load environment variables
config({ path: '../.env' })

// Example basic queries that work with most database schemas
const basicQueries = [
  "How many records are in each table?",
  "What are the column names and types in the first table?",
  "Show me the first 5 rows from the largest table",
  "What tables exist in this database?",
  "Find all tables that have an 'id' column",
  "Show me tables with foreign key relationships",
  "What are the primary keys for each table?",
  "List all columns that contain 'name' in their name",
  "Show me any tables with timestamp columns",
  "What are the indexes on the tables?"
]

async function runBasicQuery(sqlGen: any, question: string, index: number) {
  console.log(`\n${index + 1}. 🔍 Query: "${question}"`)
  console.log('   ⏳ Processing...')
  
  try {
    const startTime = Date.now()
    const result = await Effect.runPromise(sqlGen.ask(question))
    const totalTime = Date.now() - startTime
    
    console.log(`   ✅ Generated SQL: ${result.sql}`)
    console.log(`   📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`)
    console.log(`   ⚡ AI Response Time: ${result.executionTime}ms`)
    console.log(`   ⏱️  Total Time: ${totalTime}ms`)
    console.log(`   📝 Explanation: ${result.explanation}`)
    console.log(`   📋 Results: ${result.results.length} rows`)
    
    // Show sample results
    if (result.results.length > 0) {
      console.log('   📄 Sample Results:')
      const sampleResults = result.results.slice(0, 3)
      sampleResults.forEach((row, i) => {
        console.log(`      ${i + 1}. ${JSON.stringify(row)}`)
      })
      
      if (result.results.length > 3) {
        console.log(`      ... and ${result.results.length - 3} more rows`)
      }
    }
    
    // Show confidence level indicator
    const confidenceLevel = result.confidence >= 0.8 ? '🟢 High' : 
                           result.confidence >= 0.6 ? '🟡 Medium' : '🔴 Low'
    console.log(`   🎯 Confidence Level: ${confidenceLevel}`)
    
    return { success: true, result, totalTime }
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return { success: false, error, totalTime: 0 }
  }
}

async function main() {
  console.log('🔍 SqlGen Basic Queries Demo')
  console.log('============================\n')

  try {
    // Setup configuration
    const sqlGenConfig = setupEnvironment()
    const sqlGen = createSqlGen(sqlGenConfig)

    console.log('✅ Configuration loaded successfully')
    console.log('📊 Running basic queries against your database...\n')

    const results = []
    let successCount = 0
    let totalTime = 0

    // Run each basic query
    for (let i = 0; i < basicQueries.length; i++) {
      const result = await runBasicQuery(sqlGen, basicQueries[i], i)
      results.push(result)
      
      if (result.success) {
        successCount++
        totalTime += result.totalTime
      }
      
      // Small delay between queries
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Summary
    console.log('\n📊 Summary')
    console.log('==========')
    console.log(`✅ Successful queries: ${successCount}/${basicQueries.length}`)
    console.log(`❌ Failed queries: ${basicQueries.length - successCount}`)
    console.log(`⏱️  Average response time: ${Math.round(totalTime / successCount)}ms`)
    console.log(`🎯 Success rate: ${((successCount / basicQueries.length) * 100).toFixed(1)}%`)
    
    // Show confidence distribution
    const confidenceResults = results.filter(r => r.success).map(r => r.result.confidence)
    if (confidenceResults.length > 0) {
      const avgConfidence = confidenceResults.reduce((a, b) => a + b, 0) / confidenceResults.length
      console.log(`📈 Average confidence: ${(avgConfidence * 100).toFixed(1)}%`)
      
      const highConfidence = confidenceResults.filter(c => c >= 0.8).length
      const mediumConfidence = confidenceResults.filter(c => c >= 0.6 && c < 0.8).length
      const lowConfidence = confidenceResults.filter(c => c < 0.6).length
      
      console.log(`🟢 High confidence (≥80%): ${highConfidence}`)
      console.log(`🟡 Medium confidence (60-79%): ${mediumConfidence}`)
      console.log(`🔴 Low confidence (<60%): ${lowConfidence}`)
    }
    
    console.log('\n🎉 Basic queries demo completed!')
    console.log('💡 Try running the advanced queries demo next: pnpm tsx scripts/03-advanced-queries.ts')
    
  } catch (error) {
    console.error('❌ Demo failed:', error)
    
    if (error instanceof Error) {
      console.error('\n🔍 Error Details:')
      console.error(`Message: ${error.message}`)
      
      if (error.message.includes('training') || error.message.includes('collection')) {
        console.error('\n💡 Make sure to run the setup script first: pnpm tsx scripts/01-setup-and-train.ts')
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

export { main as basicQueriesDemo }