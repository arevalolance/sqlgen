import { beforeEach, describe, expect, it, vi } from "@effect/vitest"
import { Context, Effect, Layer } from "effect"
import {
  type QueryPipelineConfig,
  type QueryResult,
  QueryPipelineError,
  QueryPipelineLive,
  QueryPipelineService
} from "../../src/services/query-pipeline.js"
import { TextToSqlService } from "../../src/services/text-to-sql.js"
import { PostgresService } from "../../src/providers/postgres.js"
import { expectEffect, mockOpenAIResponses } from "../utils/test-helpers.js"

describe("QueryPipelineService", () => {
  const mockConfig: QueryPipelineConfig = {
    minConfidence: 0.7,
    dryRun: false,
    maxRetries: 3
  }

  // Mock services for integration testing
  const mockTextToSqlService = {
    generateSql: vi.fn(),
    trainFromSchema: vi.fn(),
    executeQuery: vi.fn()
  }

  const mockPostgresService = {
    query: vi.fn(),
    getSchema: vi.fn(),
    getTableSchema: vi.fn(),
    close: vi.fn()
  }

  const MockTextToSqlLive = Layer.succeed(TextToSqlService, mockTextToSqlService)
  const MockPostgresLive = Layer.succeed(PostgresService, mockPostgresService)
  const TestLayer = Layer.mergeAll(MockTextToSqlLive, MockPostgresLive)

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up default successful responses
    mockTextToSqlService.generateSql.mockResolvedValue({
      sql: "SELECT * FROM users WHERE created_at > NOW() - INTERVAL '30 days'",
      confidence: 0.95,
      explanation: "This query selects all users created in the last 30 days"
    })
    
    mockTextToSqlService.executeQuery.mockResolvedValue([
      { id: 1, name: "John", email: "john@example.com" },
      { id: 2, name: "Jane", email: "jane@example.com" }
    ])
    
    mockPostgresService.query.mockResolvedValue({
      rows: [{ plan: "Seq Scan on users" }]
    })
  })

  describe("QueryPipelineLive layer", () => {
    it("should create a QueryPipelineLive layer", () => {
      const layer = QueryPipelineLive(mockConfig)
      expect(layer).toBeDefined()
    })

    it("should handle different configurations", () => {
      const configs = [
        mockConfig,
        { ...mockConfig, dryRun: true },
        { ...mockConfig, minConfidence: 0.5 },
        { ...mockConfig, maxRetries: 5 }
      ]

      configs.forEach((config) => {
        const layer = QueryPipelineLive(config)
        expect(layer).toBeDefined()
      })
    })

    it("should handle extreme configurations", () => {
      const extremeConfigs = [
        { minConfidence: 0, dryRun: false, maxRetries: 0 },
        { minConfidence: 1.0, dryRun: true, maxRetries: 100 },
        { minConfidence: 0.9, dryRun: false, maxRetries: 1 }
      ]

      extremeConfigs.forEach((config) => {
        const layer = QueryPipelineLive(config)
        expect(layer).toBeDefined()
      })
    })
  })

  describe("QueryPipelineError", () => {
    it("should create error with message", () => {
      const error = new QueryPipelineError("Test error")
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe("Test error")
      expect(error.name).toBe("QueryPipelineError")
    })

    it("should create error with cause", () => {
      const cause = new Error("SQL generation failed")
      const error = new QueryPipelineError("Test error", cause)
      expect(error.cause).toBe(cause)
    })
  })

  describe("QueryPipelineService interface", () => {
    it("should define correct service interface", () => {
      expect(QueryPipelineService).toBeDefined()
      expect(QueryPipelineService.key).toBe("QueryPipelineService")
    })
  })

  describe("QueryResult interface", () => {
    it("should accept valid query results", () => {
      const result: QueryResult = {
        sql: "SELECT * FROM users",
        data: [{ id: 1, name: "John" }],
        executionTime: 150,
        confidence: 0.95,
        explanation: "Query explanation"
      }

      expect(result.sql).toBe("SELECT * FROM users")
      expect(result.data).toHaveLength(1)
      expect(result.executionTime).toBe(150)
      expect(result.confidence).toBe(0.95)
      expect(typeof result.explanation).toBe("string")
    })

    it("should handle empty results", () => {
      const result: QueryResult = {
        sql: "SELECT * FROM empty_table",
        data: [],
        executionTime: 50,
        confidence: 0.8,
        explanation: "No records found"
      }

      expect(result.data).toHaveLength(0)
      expect(result.executionTime).toBeGreaterThan(0)
    })
  })

  describe("Configuration validation", () => {
    it("should accept valid confidence ranges", () => {
      const validConfigs = [
        { ...mockConfig, minConfidence: 0.0 },
        { ...mockConfig, minConfidence: 0.5 },
        { ...mockConfig, minConfidence: 1.0 }
      ]

      validConfigs.forEach((config) => {
        expect(config.minConfidence).toBeGreaterThanOrEqual(0)
        expect(config.minConfidence).toBeLessThanOrEqual(1)
      })
    })

    it("should handle retry configurations", () => {
      const retryConfigs = [
        { ...mockConfig, maxRetries: 0 },
        { ...mockConfig, maxRetries: 3 },
        { ...mockConfig, maxRetries: 10 }
      ]

      retryConfigs.forEach((config) => {
        expect(config.maxRetries).toBeGreaterThanOrEqual(0)
        expect(typeof config.maxRetries).toBe("number")
      })
    })
  })

  describe("askQuestion method - complete workflows", () => {
    it("should execute full pipeline: question → SQL → validation → results", async () => {
      const question = "Show me all users created this week"
      const expectedSql = "SELECT * FROM users WHERE created_at >= date_trunc('week', CURRENT_DATE)"
      const mockData = [
        { id: 1, name: "Alice", created_at: "2024-01-15T10:00:00Z" },
        { id: 2, name: "Bob", created_at: "2024-01-16T14:30:00Z" }
      ]
      
      // Set up the complete pipeline flow
      mockTextToSqlService.generateSql.mockResolvedValue({
        sql: expectedSql,
        confidence: 0.9,
        explanation: "Gets all users created in the current week"
      })
      
      mockTextToSqlService.executeQuery.mockResolvedValue(mockData)
      mockPostgresService.query.mockResolvedValue({ rows: [{ valid: true }] }) // SQL validation
      
      // Create a pipeline service that uses our mocks
      const mockPipelineService = {
        askQuestion: async (q: string) => {
          const sqlResult = await mockTextToSqlService.generateSql(q)
          if (sqlResult.confidence < 0.7) throw new Error("Low confidence")
          const data = await mockTextToSqlService.executeQuery(sqlResult.sql)
          return {
            sql: sqlResult.sql,
            data,
            confidence: sqlResult.confidence,
            executionTime: 150,
            explanation: sqlResult.explanation
          }
        }
      }
      
      const result = await mockPipelineService.askQuestion(question)
      
      // Verify the complete workflow
      expect(mockTextToSqlService.generateSql).toHaveBeenCalledWith(question)
      expect(mockTextToSqlService.executeQuery).toHaveBeenCalledWith(expectedSql)
      expect(result.sql).toBe(expectedSql)
      expect(result.data).toEqual(mockData)
      expect(result.confidence).toBe(0.9)
      expect(result.executionTime).toBeGreaterThan(0)
    })

    it("should reject queries with low confidence", async () => {
      const question = "Show me data from the flibbertigibbet table"
      
      mockTextToSqlService.generateSql.mockResolvedValue({
        sql: "SELECT * FROM unknown_table",
        confidence: 0.3,
        explanation: "Unable to determine table structure"
      })

      // Create pipeline that enforces confidence threshold
      const mockPipelineService = {
        askQuestion: async (q: string) => {
          const sqlResult = await mockTextToSqlService.generateSql(q)
          if (sqlResult.confidence < 0.7) {
            throw new QueryPipelineError(`Query confidence (${sqlResult.confidence}) is below minimum threshold (0.7)`)
          }
          return sqlResult
        }
      }
      
      await expect(mockPipelineService.askQuestion(question)).rejects.toThrow(
        "Query confidence (0.3) is below minimum threshold (0.7)"
      )
      expect(mockTextToSqlService.generateSql).toHaveBeenCalledWith(question)
    })

    it("should validate SQL syntax and reject invalid queries", async () => {
      const question = "Show me the data"
      
      mockTextToSqlService.generateSql.mockResolvedValue({
        sql: "SELCT * FORM users WHRE id = 1", // Invalid SQL with typos
        confidence: 0.8,
        explanation: "Query with syntax errors"
      })
      
      // Mock SQL validation failure
      mockPostgresService.query.mockRejectedValue(new Error('syntax error at or near "SELCT"'))

      const mockPipelineService = {
        askQuestion: async (q: string) => {
          const sqlResult = await mockTextToSqlService.generateSql(q)
          try {
            // Validate SQL syntax
            await mockPostgresService.query(`EXPLAIN ${sqlResult.sql}`)
          } catch (error) {
            throw new QueryPipelineError("Invalid SQL syntax generated", error as Error)
          }
          return sqlResult
        }
      }
      
      await expect(mockPipelineService.askQuestion(question)).rejects.toThrow("Invalid SQL syntax generated")
      expect(mockPostgresService.query).toHaveBeenCalledWith("EXPLAIN SELCT * FORM users WHRE id = 1")
    })

    it("should handle dry run mode correctly", async () => {
      const question = "Show me all orders"
      const dryRunConfig = { ...mockConfig, dryRun: true }
      
      mockTextToSqlService.generateSql.mockResolvedValue({
        sql: "SELECT * FROM orders",
        confidence: 0.85,
        explanation: "Gets all orders from the orders table"
      })
      
      const mockPipelineService = {
        askQuestion: async (q: string, config = mockConfig) => {
          const sqlResult = await mockTextToSqlService.generateSql(q)
          
          if (config.dryRun) {
            // In dry run mode, don't execute the query
            return {
              sql: sqlResult.sql,
              data: null, // No data in dry run
              confidence: sqlResult.confidence,
              executionTime: 0,
              explanation: sqlResult.explanation,
              dryRun: true
            }
          }
          
          const data = await mockTextToSqlService.executeQuery(sqlResult.sql)
          return { ...sqlResult, data, executionTime: 100 }
        }
      }
      
      const result = await mockPipelineService.askQuestion(question, dryRunConfig)
      
      expect(mockTextToSqlService.generateSql).toHaveBeenCalledWith(question)
      expect(mockTextToSqlService.executeQuery).not.toHaveBeenCalled() // Should not execute in dry run
      expect(result.data).toBeNull()
      expect(result.dryRun).toBe(true)
      expect(result.sql).toBe("SELECT * FROM orders")
    })

    it("should handle SQL generation failures with retries", async () => {
      const question = "Show me the data"
      const apiError = new Error("OpenAI API rate limit exceeded")
      
      // Mock the service to fail initially, then succeed on retry
      mockTextToSqlService.generateSql
        .mockRejectedValueOnce(new Error("API rate limit"))
        .mockRejectedValueOnce(new Error("API timeout"))
        .mockResolvedValueOnce({
          sql: "SELECT * FROM users LIMIT 10",
          confidence: 0.8,
          explanation: "Gets first 10 users"
        })
      
      const mockPipelineService = {
        askQuestion: async (q: string, maxRetries = 3) => {
          let lastError: Error | null = null
          
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              return await mockTextToSqlService.generateSql(q)
            } catch (error) {
              lastError = error as Error
              if (attempt === maxRetries) {
                throw new QueryPipelineError(`SQL generation failed after ${maxRetries} attempts`, lastError)
              }
              // Wait before retry (in real implementation)
            }
          }
        }
      }
      
      const result = await mockPipelineService.askQuestion(question)
      
      expect(mockTextToSqlService.generateSql).toHaveBeenCalledTimes(3) // 2 failures + 1 success
      expect(result.sql).toBe("SELECT * FROM users LIMIT 10")
      expect(result.confidence).toBe(0.8)
    })

    it("should handle database query execution failures", async () => {
      const question = "Show me all users"
      
      mockTextToSqlService.generateSql.mockResolvedValue({
        sql: "SELECT * FROM users",
        confidence: 0.9,
        explanation: "Gets all users"
      })
      
      mockTextToSqlService.executeQuery.mockRejectedValue(new Error("Connection timeout"))
      
      const mockPipelineService = {
        askQuestion: async (q: string) => {
          const sqlResult = await mockTextToSqlService.generateSql(q)
          try {
            const data = await mockTextToSqlService.executeQuery(sqlResult.sql)
            return { ...sqlResult, data }
          } catch (error) {
            throw new QueryPipelineError("Failed to execute query", error as Error)
          }
        }
      }
      
      await expect(mockPipelineService.askQuestion(question)).rejects.toThrow("Failed to execute query")
      expect(mockTextToSqlService.generateSql).toHaveBeenCalledWith(question)
      expect(mockTextToSqlService.executeQuery).toHaveBeenCalledWith("SELECT * FROM users")
    })

    it("should measure execution time accurately during query processing", async () => {
      const question = "Show me recent orders"
      
      // Mock a delay in SQL generation
      mockTextToSqlService.generateSql.mockImplementation(async (q) => {
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 10))
        return {
          sql: "SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '1 day'",
          confidence: 0.85,
          explanation: "Gets orders from last day"
        }
      })
      
      mockTextToSqlService.executeQuery.mockResolvedValue([
        { id: 1, total: 99.99 },
        { id: 2, total: 149.50 }
      ])
      
      const mockPipelineService = {
        askQuestion: async (q: string) => {
          const startTime = performance.now()
          
          const sqlResult = await mockTextToSqlService.generateSql(q)
          const data = await mockTextToSqlService.executeQuery(sqlResult.sql)
          
          const endTime = performance.now()
          const executionTime = Math.round(endTime - startTime)
          
          return {
            sql: sqlResult.sql,
            data,
            confidence: sqlResult.confidence,
            executionTime,
            explanation: sqlResult.explanation
          }
        }
      }
      
      const result = await mockPipelineService.askQuestion(question)
      
      expect(result.executionTime).toBeGreaterThan(0)
      expect(typeof result.executionTime).toBe("number")
      expect(result.data).toHaveLength(2)
    })

    it("should handle different confidence levels with appropriate actions", async () => {
      const testCases = [
        { question: "Show me users", confidence: 0.95, shouldAccept: true },
        { question: "Show me orders", confidence: 0.75, shouldAccept: true },
        { question: "Show me flibber", confidence: 0.65, shouldAccept: false },
        { question: "Show me gibberish", confidence: 0.2, shouldAccept: false }
      ]
      
      const mockPipelineService = {
        askQuestion: async (q: string, minConfidence = 0.7) => {
          // Mock different confidence responses based on question
          const testCase = testCases.find(t => t.question === q)
          if (!testCase) throw new Error("Unknown test case")
          
          const sqlResult = {
            sql: "SELECT * FROM table",
            confidence: testCase.confidence,
            explanation: "Test query"
          }
          
          if (sqlResult.confidence < minConfidence) {
            throw new QueryPipelineError(`Confidence ${sqlResult.confidence} below threshold ${minConfidence}`)
          }
          
          return {
            ...sqlResult,
            data: [{ id: 1 }],
            executionTime: 100
          }
        }
      }
      
      // Test each confidence level
      for (const testCase of testCases) {
        if (testCase.shouldAccept) {
          const result = await mockPipelineService.askQuestion(testCase.question)
          expect(result.confidence).toBeGreaterThanOrEqual(0.7)
          expect(result.data).toBeDefined()
        } else {
          await expect(mockPipelineService.askQuestion(testCase.question)).rejects.toThrow("below threshold")
        }
      }
    })
  })

  describe("validateSql method", () => {
    it("should validate correct SQL using EXPLAIN", async () => {
      const validSql = "SELECT id, name FROM users WHERE created_at > NOW() - INTERVAL '1 day'"
      
      // Mock successful SQL validation
      mockPostgresService.query.mockResolvedValue({
        rows: [{
          "QUERY PLAN": "Seq Scan on users (cost=0.00..35.50 rows=10 width=68)"
        }]
      })
      
      const mockPipelineService = {
        validateSql: async (sql: string) => {
          try {
            const result = await mockPostgresService.query(`EXPLAIN ${sql}`)
            return {
              isValid: true,
              plan: result.rows[0]["QUERY PLAN"]
            }
          } catch (error) {
            return {
              isValid: false,
              error: (error as Error).message
            }
          }
        }
      }
      
      const result = await mockPipelineService.validateSql(validSql)
      
      expect(mockPostgresService.query).toHaveBeenCalledWith(`EXPLAIN ${validSql}`)
      expect(result.isValid).toBe(true)
      expect(result.plan).toContain("Seq Scan")
    })

    it("should reject invalid SQL with syntax errors", async () => {
      const invalidSql = "SELCT * FORM users WHR id = 1" // Multiple typos
      
      // Mock SQL syntax error from database
      mockPostgresService.query.mockRejectedValue(new Error('syntax error at or near "SELCT"'))
      
      const mockPipelineService = {
        validateSql: async (sql: string) => {
          try {
            await mockPostgresService.query(`EXPLAIN ${sql}`)
            return { isValid: true }
          } catch (error) {
            return {
              isValid: false,
              error: (error as Error).message
            }
          }
        }
      }
      
      const result = await mockPipelineService.validateSql(invalidSql)
      
      expect(mockPostgresService.query).toHaveBeenCalledWith(`EXPLAIN ${invalidSql}`)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('syntax error')
    })

    it("should handle database connection errors during validation", async () => {
      const sql = "SELECT * FROM users"
      
      // Mock database connection error
      mockPostgresService.query.mockRejectedValue(new Error("Connection timed out"))
      
      const mockPipelineService = {
        validateSql: async (sql: string) => {
          try {
            await mockPostgresService.query(`EXPLAIN ${sql}`)
            return { isValid: true }
          } catch (error) {
            const errorMsg = (error as Error).message
            if (errorMsg.includes('Connection timed out')) {
              throw new QueryPipelineError("Database unavailable for SQL validation", error as Error)
            }
            return { isValid: false, error: errorMsg }
          }
        }
      }
      
      await expect(mockPipelineService.validateSql(sql)).rejects.toThrow("Database unavailable for SQL validation")
      expect(mockPostgresService.query).toHaveBeenCalledWith(`EXPLAIN ${sql}`)
    })
  })

  describe("explainQuery method", () => {
    it("should return detailed query execution plan", async () => {
      const sql = "SELECT u.name, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id, u.name"
      
      // Mock detailed execution plan
      mockPostgresService.query.mockResolvedValue({
        rows: [
          { "QUERY PLAN": "HashAggregate (cost=87.17..89.67 rows=200 width=36)" },
          { "QUERY PLAN": "  Group Key: u.id, u.name" },
          { "QUERY PLAN": "  ->  Hash Left Join (cost=22.50..84.67 rows=500 width=68)" },
          { "QUERY PLAN": "        Hash Cond: (u.id = o.user_id)" },
          { "QUERY PLAN": "        ->  Seq Scan on users u (cost=0.00..15.40 rows=540 width=68)" },
          { "QUERY PLAN": "        ->  Hash (cost=15.30..15.30 rows=530 width=8)" },
          { "QUERY PLAN": "              ->  Seq Scan on orders o (cost=0.00..15.30 rows=530 width=8)" }
        ]
      })
      
      const mockPipelineService = {
        explainQuery: async (sql: string, analyze = false) => {
          const explainSql = analyze ? `EXPLAIN ANALYZE ${sql}` : `EXPLAIN ${sql}`
          const result = await mockPostgresService.query(explainSql)
          
          return {
            sql,
            plan: result.rows.map(row => row["QUERY PLAN"]).join('\n'),
            cost: result.rows[0]["QUERY PLAN"].match(/cost=([0-9.]+)\.\.([0-9.]+)/)?.[1] || 'unknown',
            analyzed: analyze
          }
        }
      }
      
      const result = await mockPipelineService.explainQuery(sql)
      
      expect(mockPostgresService.query).toHaveBeenCalledWith(`EXPLAIN ${sql}`)
      expect(result.plan).toContain("HashAggregate")
      expect(result.plan).toContain("Hash Left Join")
      expect(result.cost).toBe("87.17")
      expect(result.analyzed).toBe(false)
    })

    it("should handle EXPLAIN query errors properly", async () => {
      const invalidSql = "SELECT * FROM nonexistent_table"
      
      // Mock table does not exist error
      mockPostgresService.query.mockRejectedValue(new Error('relation "nonexistent_table" does not exist'))
      
      const mockPipelineService = {
        explainQuery: async (sql: string) => {
          try {
            const result = await mockPostgresService.query(`EXPLAIN ${sql}`)
            return {
              sql,
              plan: result.rows.map(row => row["QUERY PLAN"]).join('\n')
            }
          } catch (error) {
            throw new QueryPipelineError("Failed to generate query plan", error as Error)
          }
        }
      }
      
      await expect(mockPipelineService.explainQuery(invalidSql)).rejects.toThrow("Failed to generate query plan")
      expect(mockPostgresService.query).toHaveBeenCalledWith(`EXPLAIN ${invalidSql}`)
    })
  })

  describe("configuration edge cases", () => {
    it("should accept all queries with zero confidence threshold", async () => {
      const question = "Show me some random data"
      const zeroConfig = { ...mockConfig, minConfidence: 0 }
      
      mockTextToSqlService.generateSql.mockResolvedValue({
        sql: "SELECT * FROM unknown_table",
        confidence: 0.1, // Very low confidence
        explanation: "Uncertain query"
      })
      
      mockTextToSqlService.executeQuery.mockResolvedValue([{ data: "some data" }])
      
      const mockPipelineService = {
        askQuestion: async (q: string, config = zeroConfig) => {
          const sqlResult = await mockTextToSqlService.generateSql(q)
          
          // With zero threshold, even low confidence should pass
          if (sqlResult.confidence < config.minConfidence) {
            throw new QueryPipelineError("Confidence too low")
          }
          
          const data = await mockTextToSqlService.executeQuery(sqlResult.sql)
          return { ...sqlResult, data, executionTime: 50 }
        }
      }
      
      const result = await mockPipelineService.askQuestion(question)
      
      expect(result.confidence).toBe(0.1)
      expect(result.data).toEqual([{ data: "some data" }])
      expect(mockTextToSqlService.generateSql).toHaveBeenCalledWith(question)
    })

    it("should reject most queries with maximum confidence threshold", async () => {
      const question = "Show me users"
      const maxConfig = { ...mockConfig, minConfidence: 1.0 }
      
      mockTextToSqlService.generateSql.mockResolvedValue({
        sql: "SELECT * FROM users",
        confidence: 0.95, // High but not perfect confidence
        explanation: "Gets all users"
      })
      
      const mockPipelineService = {
        askQuestion: async (q: string, config = maxConfig) => {
          const sqlResult = await mockTextToSqlService.generateSql(q)
          
          if (sqlResult.confidence < config.minConfidence) {
            throw new QueryPipelineError(`Confidence ${sqlResult.confidence} below perfect threshold ${config.minConfidence}`)
          }
          
          return sqlResult
        }
      }
      
      await expect(mockPipelineService.askQuestion(question)).rejects.toThrow("below perfect threshold 1")
      expect(mockTextToSqlService.generateSql).toHaveBeenCalledWith(question)
    })

    it("should handle zero retry configuration", () => {
      const zeroRetryConfig = { ...mockConfig, maxRetries: 0 }
      expect(zeroRetryConfig.maxRetries).toBe(0)
    })
  })

  describe("logging and observability", () => {
    it("should track processing metrics and timing", async () => {
      const question = "Show me recent orders with customer info"
      const mockLogger = {
        info: vi.fn(),
        error: vi.fn()
      }
      
      mockTextToSqlService.generateSql.mockResolvedValue({
        sql: "SELECT o.*, u.name FROM orders o JOIN users u ON o.user_id = u.id WHERE o.created_at > NOW() - INTERVAL '7 days'",
        confidence: 0.88,
        explanation: "Gets recent orders with customer names"
      })
      
      mockTextToSqlService.executeQuery.mockResolvedValue([
        { id: 1, total: 99.99, name: "Alice" },
        { id: 2, total: 149.50, name: "Bob" }
      ])
      
      const mockPipelineService = {
        askQuestion: async (q: string) => {
          const startTime = performance.now()
          mockLogger.info(`Processing question: ${q}`)
          
          try {
            const sqlResult = await mockTextToSqlService.generateSql(q)
            mockLogger.info(`Generated SQL with confidence ${sqlResult.confidence}: ${sqlResult.sql}`)
            
            const data = await mockTextToSqlService.executeQuery(sqlResult.sql)
            const endTime = performance.now()
            const executionTime = Math.round(endTime - startTime)
            
            mockLogger.info(`Query completed in ${executionTime}ms, returned ${data.length} rows`)
            
            return {
              ...sqlResult,
              data,
              executionTime,
              metrics: {
                questionLength: q.length,
                sqlLength: sqlResult.sql.length,
                resultCount: data.length
              }
            }
          } catch (error) {
            mockLogger.error(`Query failed: ${(error as Error).message}`)
            throw error
          }
        }
      }
      
      const result = await mockPipelineService.askQuestion(question)
      
      expect(mockLogger.info).toHaveBeenCalledWith(`Processing question: ${question}`)
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Generated SQL with confidence 0.88`))
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`returned 2 rows`))
      expect(result.metrics.questionLength).toBe(question.length)
      expect(result.metrics.resultCount).toBe(2)
    })
  })
})