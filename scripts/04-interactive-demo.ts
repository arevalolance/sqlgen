#!/usr/bin/env tsx

import { config } from 'dotenv'
import { Effect } from 'effect'
import * as readline from 'readline'
import { fileURLToPath } from 'url'
import { createSqlGen } from '../src/index.js'
import { setupEnvironment } from './config.js'

// Load environment variables
config({ path: '../.env' })

interface QuerySession {
  queries: Array<{
    question: string
    result: any
    timestamp: Date
    success: boolean
  }>
  startTime: Date
}

class InteractiveDemo {
  private sqlGen: any
  private session: QuerySession
  private rl: readline.Interface

  constructor(sqlGen: any) {
    this.sqlGen = sqlGen
    this.session = {
      queries: [],
      startTime: new Date()
    }
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
  }

  async start() {
    console.log('🎮 SqlGen Interactive Demo')
    console.log('==========================')
    console.log('💡 Ask questions in natural language and see them converted to SQL!')
    console.log('💡 Type "help" for commands, "quit" to exit')
    console.log('💡 Examples: "Show me all users", "How many orders were placed today?"\n')

    await this.showHelp()
    await this.interactiveLoop()
  }

  private async showHelp() {
    console.log('📋 Available Commands:')
    console.log('  help     - Show this help message')
    console.log('  stats    - Show session statistics')
    console.log('  history  - Show query history')
    console.log('  explain  - Explain the last generated SQL')
    console.log('  validate - Validate the last generated SQL')
    console.log('  clear    - Clear the screen')
    console.log('  quit     - Exit the demo')
    console.log('  exit     - Exit the demo')
    console.log('')
  }

  private async interactiveLoop() {
    while (true) {
      try {
        const input = await this.prompt('🤔 Ask me anything about your database: ')
        
        if (!input.trim()) continue
        
        const command = input.toLowerCase().trim()
        
        switch (command) {
          case 'help':
            await this.showHelp()
            break
          case 'stats':
            this.showStats()
            break
          case 'history':
            this.showHistory()
            break
          case 'explain':
            await this.explainLastQuery()
            break
          case 'validate':
            await this.validateLastQuery()
            break
          case 'clear':
            console.clear()
            break
          case 'quit':
          case 'exit':
            await this.exit()
            return
          default:
            await this.processQuery(input)
        }
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error')
      }
    }
  }

  private async processQuery(question: string) {
    console.log(`\n🔍 Processing: "${question}"`)
    console.log('⏳ Generating SQL...')
    
    const startTime = Date.now()
    
    try {
      const result = await Effect.runPromise(this.sqlGen.ask(question))
      const processingTime = Date.now() - startTime
      
      // Store in session
      this.session.queries.push({
        question,
        result,
        timestamp: new Date(),
        success: true
      })
      
      // Display results
      console.log('\n✅ Query Results:')
      console.log('==================')
      console.log(`🔧 Generated SQL: ${result.sql}`)
      console.log(`📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`)
      console.log(`⚡ Processing Time: ${processingTime}ms`)
      console.log(`📝 Explanation: ${result.explanation}`)
      console.log(`📋 Results: ${result.results.length} rows`)
      
      // Show confidence indicator
      const confidenceEmoji = result.confidence >= 0.8 ? '🟢' : 
                             result.confidence >= 0.6 ? '🟡' : '🔴'
      console.log(`${confidenceEmoji} Confidence Level: ${this.getConfidenceLevel(result.confidence)}`)
      
      // Show sample results
      if (result.results.length > 0) {
        console.log('\n📄 Sample Results:')
        const sampleSize = Math.min(5, result.results.length)
        for (let i = 0; i < sampleSize; i++) {
          console.log(`  ${i + 1}. ${this.formatRow(result.results[i])}`)
        }
        
        if (result.results.length > sampleSize) {
          console.log(`  ... and ${result.results.length - sampleSize} more rows`)
        }
      }
      
      // Show performance metrics
      if (processingTime > 5000) {
        console.log('⚠️  This query took a while to process. Consider simplifying complex requests.')
      }
      
    } catch (error) {
      console.log(`\n❌ Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      
      // Store failed query
      this.session.queries.push({
        question,
        result: null,
        timestamp: new Date(),
        success: false
      })
      
      // Provide helpful suggestions
      this.suggestAlternatives(question, error)
    }
  }

  private getConfidenceLevel(confidence: number): string {
    if (confidence >= 0.8) return 'High - Very likely correct'
    if (confidence >= 0.6) return 'Medium - Probably correct'
    return 'Low - Please review carefully'
  }

  private formatRow(row: any): string {
    if (typeof row === 'object' && row !== null) {
      const entries = Object.entries(row)
      if (entries.length <= 3) {
        return entries.map(([key, value]) => `${key}: ${value}`).join(', ')
      } else {
        const first3 = entries.slice(0, 3).map(([key, value]) => `${key}: ${value}`).join(', ')
        return `${first3}, ... (${entries.length - 3} more fields)`
      }
    }
    return JSON.stringify(row)
  }

  private suggestAlternatives(question: string, error: any) {
    console.log('\n💡 Suggestions:')
    
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase()
      
      if (errorMessage.includes('table') && errorMessage.includes('not found')) {
        console.log('  • Try asking "What tables exist in the database?" first')
        console.log('  • Check the table name spelling')
      } else if (errorMessage.includes('column') && errorMessage.includes('not found')) {
        console.log('  • Try asking "What columns are in the [table_name] table?"')
        console.log('  • Check the column name spelling')
      } else if (errorMessage.includes('syntax')) {
        console.log('  • Try rephrasing your question more simply')
        console.log('  • Break complex requests into smaller parts')
      } else if (errorMessage.includes('permission')) {
        console.log('  • Check your database permissions')
        console.log('  • Try a simpler read-only query')
      } else {
        console.log('  • Try rephrasing your question')
        console.log('  • Make sure your database connection is working')
        console.log('  • Check if the training was completed successfully')
      }
    }
  }

  private showStats() {
    const totalQueries = this.session.queries.length
    const successfulQueries = this.session.queries.filter(q => q.success).length
    const failedQueries = totalQueries - successfulQueries
    
    console.log('\n📊 Session Statistics:')
    console.log('======================')
    console.log(`⏱️  Session Duration: ${this.formatDuration(Date.now() - this.session.startTime.getTime())}`)
    console.log(`📝 Total Queries: ${totalQueries}`)
    console.log(`✅ Successful: ${successfulQueries}`)
    console.log(`❌ Failed: ${failedQueries}`)
    console.log(`🎯 Success Rate: ${totalQueries > 0 ? ((successfulQueries / totalQueries) * 100).toFixed(1) : 0}%`)
    
    if (successfulQueries > 0) {
      const confidences = this.session.queries
        .filter(q => q.success)
        .map(q => q.result.confidence)
      
      const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length
      console.log(`📈 Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`)
      
      const highConfidence = confidences.filter(c => c >= 0.8).length
      const mediumConfidence = confidences.filter(c => c >= 0.6 && c < 0.8).length
      const lowConfidence = confidences.filter(c => c < 0.6).length
      
      console.log(`🟢 High Confidence: ${highConfidence}`)
      console.log(`🟡 Medium Confidence: ${mediumConfidence}`)
      console.log(`🔴 Low Confidence: ${lowConfidence}`)
    }
  }

  private showHistory() {
    console.log('\n📜 Query History:')
    console.log('=================')
    
    if (this.session.queries.length === 0) {
      console.log('No queries in history.')
      return
    }
    
    this.session.queries.forEach((query, index) => {
      const status = query.success ? '✅' : '❌'
      const confidence = query.success ? `(${(query.result.confidence * 100).toFixed(1)}%)` : ''
      const time = query.timestamp.toLocaleTimeString()
      
      console.log(`${index + 1}. ${status} [${time}] "${query.question}" ${confidence}`)
      
      if (query.success) {
        console.log(`   SQL: ${query.result.sql}`)
        console.log(`   Results: ${query.result.results.length} rows`)
      }
    })
  }

  private async explainLastQuery() {
    const lastSuccessful = this.session.queries.findLast(q => q.success)
    
    if (!lastSuccessful) {
      console.log('❌ No successful queries to explain.')
      return
    }
    
    console.log('\n🔍 Explaining Last Query:')
    console.log('=========================')
    console.log(`Question: "${lastSuccessful.question}"`)
    console.log(`SQL: ${lastSuccessful.result.sql}`)
    console.log(`Explanation: ${lastSuccessful.result.explanation}`)
    
    try {
      const explanation = await Effect.runPromise(this.sqlGen.explainQuery(lastSuccessful.result.sql))
      console.log('\n📊 Detailed Explanation:')
      console.log(explanation)
    } catch (error) {
      console.log('❌ Could not get detailed explanation:', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  private async validateLastQuery() {
    const lastSuccessful = this.session.queries.findLast(q => q.success)
    
    if (!lastSuccessful) {
      console.log('❌ No successful queries to validate.')
      return
    }
    
    console.log('\n🔍 Validating Last Query:')
    console.log('=========================')
    console.log(`SQL: ${lastSuccessful.result.sql}`)
    
    try {
      const isValid = await Effect.runPromise(this.sqlGen.validateSql(lastSuccessful.result.sql))
      console.log(`✅ Validation Result: ${isValid ? 'Valid' : 'Invalid'}`)
    } catch (error) {
      console.log('❌ Validation failed:', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  private async exit() {
    console.log('\n👋 Thanks for trying SqlGen!')
    
    if (this.session.queries.length > 0) {
      console.log('\n📊 Final Session Summary:')
      this.showStats()
    }
    
    this.rl.close()
    process.exit(0)
  }

  private prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer)
      })
    })
  }
}

async function main() {
  try {
    // Setup configuration
    const sqlGenConfig = setupEnvironment()
    const sqlGen = createSqlGen(sqlGenConfig)
    
    // Start interactive demo
    const demo = new InteractiveDemo(sqlGen)
    await demo.start()
    
  } catch (error) {
    console.error('❌ Interactive demo failed:', error)
    
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

export { main as interactiveDemo }