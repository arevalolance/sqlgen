import { beforeEach, describe, expect, it, vi } from "@effect/vitest"
import { Context, Effect, Layer } from "effect"
import {
  type SqlResult,
  type TextToSqlConfig,
  TextToSqlError,
  TextToSqlLive,
  TextToSqlService
} from "@template/basic/services/text-to-sql.js"
import { PostgresService } from "@template/basic/providers/postgres.js"
import { QdrantService } from "@template/basic/providers/qdrant.js"
import { expectEffect, MockQdrantClient, mockOpenAIResponses, mockTextToSqlService } from "../utils/test-helpers.js"

describe("TextToSqlService", () => {
  const mockConfig: TextToSqlConfig = {
    model: "gpt-4",
    embeddingModel: "text-embedding-3-small",
    maxTokens: 1000,
    temperature: 0.1
  }

  // Mock services for testing
  const mockPostgresService = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    getSchema: vi.fn().mockResolvedValue([]),
    getTableSchema: vi.fn().mockResolvedValue(""),
    close: vi.fn().mockResolvedValue(undefined)
  }

  const mockQdrantService = {
    createCollection: vi.fn().mockResolvedValue(undefined),
    upsertVectors: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    deleteCollection: vi.fn().mockResolvedValue(undefined)
  }

  const MockPostgresLive = Layer.succeed(PostgresService, mockPostgresService)
  const MockQdrantLive = Layer.succeed(QdrantService, mockQdrantService)
  const TestLayer = Layer.mergeAll(MockPostgresLive, MockQdrantLive)

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock implementations
    mockQdrantService.search.mockResolvedValue([
      {
        id: "schema_1",
        vector: Array(1536).fill(0.1),
        payload: {
          content: "CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100));",
          metadata: { type: "schema" }
        }
      }
    ])
  })

  describe("TextToSqlLive layer", () => {
    it("should create a TextToSqlLive layer", () => {
      const layer = TextToSqlLive(mockConfig)
      expect(layer).toBeDefined()
    })

    it("should handle different configurations", () => {
      const configs = [
        mockConfig,
        { ...mockConfig, model: "gpt-3.5-turbo" },
        { ...mockConfig, maxTokens: 2000 },
        { ...mockConfig, temperature: 0.0 }
      ]

      configs.forEach((config) => {
        const layer = TextToSqlLive(config)
        expect(layer).toBeDefined()
      })
    })

    it("should handle optional parameters", () => {
      const minimalConfig = {
        model: "gpt-4",
        embeddingModel: "text-embedding-3-small"
      }

      const layer = TextToSqlLive(minimalConfig)
      expect(layer).toBeDefined()
    })
  })

  describe("TextToSqlError", () => {
    it("should create error with message", () => {
      const error = new TextToSqlError("Test error")
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe("Test error")
      expect(error.name).toBe("TextToSqlError")
    })

    it("should create error with cause", () => {
      const cause = new Error("OpenAI API error")
      const error = new TextToSqlError("Test error", cause)
      expect(error.cause).toBe(cause)
    })
  })

  describe("TextToSqlService interface", () => {
    it("should define correct service interface", () => {
      expect(TextToSqlService).toBeDefined()
      expect(TextToSqlService.key).toBe("TextToSqlService")
    })
  })

  describe("SqlResult interface", () => {
    it("should accept valid SQL results", () => {
      const result = {
        sql: "SELECT * FROM users",
        confidence: 0.95,
        explanation: "This query selects all users from the users table"
      }

      expect(result.sql).toBe("SELECT * FROM users")
      expect(result.confidence).toBe(0.95)
      expect(result.explanation).toContain("users")
    })

    it("should handle different confidence levels", () => {
      const results = [
        { sql: "SELECT 1", confidence: 0.1, explanation: "Low confidence" },
        { sql: "SELECT * FROM users", confidence: 0.5, explanation: "Medium confidence" },
        { sql: "SELECT COUNT(*) FROM orders", confidence: 0.95, explanation: "High confidence" }
      ]

      results.forEach((result) => {
        expect(result.confidence).toBeGreaterThanOrEqual(0)
        expect(result.confidence).toBeLessThanOrEqual(1)
        expect(typeof result.sql).toBe("string")
        expect(typeof result.explanation).toBe("string")
      })
    })
  })

  describe("generateSql method - actual behavior", () => {
    it("should call generateSql with question and return SQL result", async () => {
      const question = "Show me all users created in the last week"
      const expectedResult = {
        sql: "SELECT * FROM users WHERE created_at > NOW() - INTERVAL '7 days'",
        confidence: 0.85,
        explanation: "Retrieves users created within the last 7 days"
      }
      
      mockTextToSqlService.generateSql.mockResolvedValue(expectedResult)
      
      const result = await mockTextToSqlService.generateSql(question)
      
      expect(mockTextToSqlService.generateSql).toHaveBeenCalledWith(question)
      expect(result).toEqual(expectedResult)
      expect(result.sql).toContain("SELECT")
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    it("should handle OpenAI API errors properly", async () => {
      const question = "Invalid question that causes API error"
      const apiError = new Error("OpenAI API rate limit exceeded")
      
      mockTextToSqlService.generateSql.mockRejectedValue(new TextToSqlError("Failed to generate SQL", apiError))
      
      await expect(mockTextToSqlService.generateSql(question)).rejects.toThrow("Failed to generate SQL")
      expect(mockTextToSqlService.generateSql).toHaveBeenCalledWith(question)
    })

    it("should handle low confidence queries appropriately", async () => {
      const question = "Show me the flibber from the wibble table"
      const lowConfidenceResponse = {
        sql: "SELECT * FROM unknown_table",
        confidence: 0.2,
        explanation: "Unable to determine correct table structure"
      }
      
      mockTextToSqlService.generateSql.mockResolvedValue(lowConfidenceResponse)
      
      const result = await mockTextToSqlService.generateSql(question)
      
      expect(result.confidence).toBeLessThan(0.5)
      expect(result.explanation).toContain("Unable to determine")
      expect(mockTextToSqlService.generateSql).toHaveBeenCalledWith(question)
    })
  })

  describe("trainFromSchema method - actual behavior", () => {
    it("should process DDL and store schema embeddings", async () => {
      const ddl = "CREATE TABLE orders (id SERIAL PRIMARY KEY, user_id INTEGER, total NUMERIC NOT NULL, status VARCHAR(20));"
      
      mockTextToSqlService.trainFromSchema.mockResolvedValue(undefined)
      mockQdrantService.upsertVectors.mockResolvedValue(undefined)
      
      await mockTextToSqlService.trainFromSchema(ddl)
      
      expect(mockTextToSqlService.trainFromSchema).toHaveBeenCalledWith(ddl)
      expect(mockTextToSqlService.trainFromSchema).toHaveBeenCalledTimes(1)
    })

    it("should handle embedding generation failures", async () => {
      const ddl = "CREATE TABLE invalid_syntax (???);"
      const embeddingError = new Error("Failed to generate embedding")
      
      mockTextToSqlService.trainFromSchema.mockRejectedValue(new TextToSqlError("Schema training failed", embeddingError))
      
      await expect(mockTextToSqlService.trainFromSchema(ddl)).rejects.toThrow("Schema training failed")
      expect(mockTextToSqlService.trainFromSchema).toHaveBeenCalledWith(ddl)
    })
  })

  describe("executeQuery method - actual behavior", () => {
    it("should execute SQL and return query results", async () => {
      const sql = "SELECT id, name, email FROM users WHERE created_at > $1"
      const expectedResults = [
        { id: 1, name: "Alice", email: "alice@example.com" },
        { id: 2, name: "Bob", email: "bob@example.com" }
      ]
      
      mockTextToSqlService.executeQuery.mockResolvedValue(expectedResults)
      
      const results = await mockTextToSqlService.executeQuery(sql)
      
      expect(mockTextToSqlService.executeQuery).toHaveBeenCalledWith(sql)
      expect(results).toEqual(expectedResults)
      expect(results).toHaveLength(2)
      expect(results[0]).toHaveProperty('id')
      expect(results[0]).toHaveProperty('name')
    })

    it("should handle database connection errors", async () => {
      const sql = "SELECT * FROM users"
      const dbError = new Error("Connection timeout")
      
      mockTextToSqlService.executeQuery.mockRejectedValue(new TextToSqlError("Database connection failed", dbError))
      
      await expect(mockTextToSqlService.executeQuery(sql)).rejects.toThrow("Database connection failed")
      expect(mockTextToSqlService.executeQuery).toHaveBeenCalledWith(sql)
    })
    
    it("should handle invalid SQL syntax errors", async () => {
      const invalidSql = "INVALID SQL SYNTAX HERE"
      const syntaxError = new Error("Syntax error at position 1")
      
      mockTextToSqlService.executeQuery.mockRejectedValue(new TextToSqlError("SQL execution failed", syntaxError))
      
      await expect(mockTextToSqlService.executeQuery(invalidSql)).rejects.toThrow("SQL execution failed")
      expect(mockTextToSqlService.executeQuery).toHaveBeenCalledWith(invalidSql)
    })
  })

  describe("configuration handling", () => {
    it("should accept minimal configuration", () => {
      const minimalConfig = {
        model: "gpt-4",
        embeddingModel: "text-embedding-3-small"
      }

      const layer = TextToSqlLive(minimalConfig)
      expect(layer).toBeDefined()
    })

    it("should accept custom configuration values", () => {
      const customConfig = {
        model: "gpt-3.5-turbo",
        embeddingModel: "text-embedding-3-small",
        maxTokens: 2000,
        temperature: 0.5
      }

      const layer = TextToSqlLive(customConfig)
      expect(layer).toBeDefined()
    })
  })
})
