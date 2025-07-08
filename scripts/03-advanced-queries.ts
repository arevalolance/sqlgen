#!/usr/bin/env tsx

import { config } from 'dotenv'
import { Effect } from 'effect'
import { fileURLToPath } from 'url'
import { createSqlGen } from '../src/index.js'
import { setupEnvironment } from './config.js'

// Load environment variables
config({ path: '../.env' })

// Advanced queries that test complex SQL generation
const advancedQueries = [
  "Show me the top 10 most frequently used values in each table",
  "Find all foreign key relationships and show sample data from both tables",
  "Create a summary report showing record counts, null percentages, and data types for each column",
  "Find duplicate records across all tables that have unique constraints",
  "Show me tables with the most recent activity based on timestamp columns",
  "Generate a query to find orphaned records (foreign keys with no matching parent)",
  "Create a data quality report showing columns with high null rates or unusual values",
  "Find tables that might be related based on similar column names or patterns",
  "Show me the distribution of values in categorical columns",
  "Create a query to analyze the cardinality of each column in the database",
  "Find tables with potential many-to-many relationships",
  "Generate a query to check referential integrity across all foreign keys",
  "Create a report showing the growth pattern of data over time",
  "Find columns that might contain sensitive information based on their names",
  "Show me the complexity of each table based on column count and relationships"
]

async function runAdvancedQuery(sqlGen: any, question: string, index: number) {
  console.log(`\n${index + 1}. 🧠 Advanced Query: "${question}"`)
  console.log('   ⏳ Processing complex query...')
  
  try {
    const startTime = Date.now()
    const result = await Effect.runPromise(sqlGen.ask(question))
    const totalTime = Date.now() - startTime
    
    // Analyze SQL complexity
    const sqlComplexity = analyzeSqlComplexity(result.sql)
    
    console.log(`   ✅ Generated SQL: ${result.sql}`)
    console.log(`   📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`)
    console.log(`   ⚡ AI Response Time: ${result.executionTime}ms`)
    console.log(`   ⏱️  Total Time: ${totalTime}ms`)
    console.log(`   🧮 SQL Complexity: ${sqlComplexity.level} (${sqlComplexity.score}/10)`)
    console.log(`   📝 Explanation: ${result.explanation}`)
    console.log(`   📋 Results: ${result.results.length} rows`)
    
    // Show complexity breakdown
    if (sqlComplexity.features.length > 0) {
      console.log(`   🔍 SQL Features: ${sqlComplexity.features.join(', ')}`)
    }
    
    // Show sample results with better formatting
    if (result.results.length > 0) {
      console.log('   📄 Sample Results:')
      const sampleResults = result.results.slice(0, 2)
      sampleResults.forEach((row, i) => {
        console.log(`      ${i + 1}. ${formatResult(row)}`)
      })
      
      if (result.results.length > 2) {
        console.log(`      ... and ${result.results.length - 2} more rows`)
      }
    }
    
    // Show confidence analysis
    const confidenceAnalysis = analyzeConfidence(result.confidence, sqlComplexity.score)
    console.log(`   🎯 Confidence Analysis: ${confidenceAnalysis}`)
    
    return { success: true, result, totalTime, complexity: sqlComplexity }
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    // Analyze error type
    if (error instanceof Error) {
      const errorType = analyzeError(error.message)
      console.log(`   🔍 Error Type: ${errorType}`)
    }
    
    return { success: false, error, totalTime: 0, complexity: null }
  }
}

function analyzeSqlComplexity(sql: string) {
  const features = []
  let score = 1
  
  // Check for various SQL features
  if (sql.toLowerCase().includes('join')) {
    features.push('JOINs')
    score += 2
  }
  
  if (sql.toLowerCase().includes('group by')) {
    features.push('GROUP BY')
    score += 1
  }
  
  if (sql.toLowerCase().includes('having')) {
    features.push('HAVING')
    score += 1
  }
  
  if (sql.toLowerCase().includes('order by')) {
    features.push('ORDER BY')
    score += 1
  }
  
  if (sql.toLowerCase().includes('union')) {
    features.push('UNION')
    score += 2
  }
  
  if (sql.toLowerCase().includes('subquery') || sql.includes('(select')) {
    features.push('Subqueries')
    score += 2
  }
  
  if (sql.toLowerCase().includes('case when')) {
    features.push('CASE statements')
    score += 1
  }
  
  if (sql.toLowerCase().includes('window') || sql.toLowerCase().includes('over(')) {
    features.push('Window functions')
    score += 3
  }
  
  if (sql.toLowerCase().includes('cte') || sql.toLowerCase().includes('with')) {
    features.push('CTEs')
    score += 2
  }
  
  // Count number of tables referenced
  const tableMatches = sql.toLowerCase().match(/from\s+(\w+)|join\s+(\w+)/g)
  if (tableMatches && tableMatches.length > 2) {
    features.push('Multiple tables')
    score += 1
  }
  
  const level = score <= 3 ? 'Simple' : score <= 6 ? 'Medium' : score <= 8 ? 'Complex' : 'Very Complex'
  
  return {
    score: Math.min(score, 10),
    level,
    features
  }
}

function analyzeConfidence(confidence: number, complexityScore: number) {
  if (confidence >= 0.8) {
    return complexityScore >= 7 ? 'Excellent (High confidence on complex query)' : 'Very Good'
  } else if (confidence >= 0.6) {
    return complexityScore >= 7 ? 'Good (Medium confidence on complex query)' : 'Acceptable'
  } else {
    return complexityScore >= 7 ? 'Challenging (Low confidence on complex query)' : 'Needs Review'
  }
}

function analyzeError(errorMessage: string) {
  if (errorMessage.includes('syntax')) return 'SQL Syntax Error'
  if (errorMessage.includes('column') && errorMessage.includes('not found')) return 'Column Not Found'
  if (errorMessage.includes('table') && errorMessage.includes('not found')) return 'Table Not Found'
  if (errorMessage.includes('permission')) return 'Permission Error'
  if (errorMessage.includes('timeout')) return 'Query Timeout'
  if (errorMessage.includes('connection')) return 'Database Connection Error'
  return 'Unknown Error'
}

function formatResult(row: any): string {
  if (typeof row === 'object' && row !== null) {
    const formatted = Object.entries(row)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')
    return `{ ${formatted} }`
  }
  return JSON.stringify(row)
}

async function main() {
  console.log('🧠 SqlGen Advanced Queries Demo')
  console.log('===============================\n')

  try {
    // Setup configuration
    const sqlGenConfig = setupEnvironment()
    const sqlGen = createSqlGen(sqlGenConfig)

    console.log('✅ Configuration loaded successfully')
    console.log('🧠 Running advanced queries against your database...')
    console.log('💡 These queries test complex SQL generation capabilities\n')

    const results = []
    let successCount = 0
    let totalTime = 0
    let complexityScores = []

    // Run each advanced query
    for (let i = 0; i < advancedQueries.length; i++) {
      const result = await runAdvancedQuery(sqlGen, advancedQueries[i], i)
      results.push(result)
      
      if (result.success) {
        successCount++
        totalTime += result.totalTime
        if (result.complexity) {
          complexityScores.push(result.complexity.score)
        }
      }
      
      // Longer delay between complex queries
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Advanced Summary
    console.log('\n📊 Advanced Query Analysis')
    console.log('==========================')
    console.log(`✅ Successful queries: ${successCount}/${advancedQueries.length}`)
    console.log(`❌ Failed queries: ${advancedQueries.length - successCount}`)
    console.log(`⏱️  Average response time: ${Math.round(totalTime / successCount)}ms`)
    console.log(`🎯 Success rate: ${((successCount / advancedQueries.length) * 100).toFixed(1)}%`)
    
    // Confidence analysis
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
    
    // Complexity analysis
    if (complexityScores.length > 0) {
      const avgComplexity = complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length
      console.log(`🧮 Average SQL complexity: ${avgComplexity.toFixed(1)}/10`)
      
      const simple = complexityScores.filter(s => s <= 3).length
      const medium = complexityScores.filter(s => s > 3 && s <= 6).length
      const complex = complexityScores.filter(s => s > 6).length
      
      console.log(`🟢 Simple queries: ${simple}`)
      console.log(`🟡 Medium queries: ${medium}`)
      console.log(`🔴 Complex queries: ${complex}`)
    }
    
    console.log('\n🎉 Advanced queries demo completed!')
    console.log('💡 Try the interactive demo next: pnpm tsx scripts/04-interactive-demo.ts')
    
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

export { main as advancedQueriesDemo }