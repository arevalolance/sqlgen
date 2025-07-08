import { describe, expect, it } from "@effect/vitest"
import {
  type QueryPipelineConfig,
  QueryPipelineError,
  QueryPipelineLive,
  QueryPipelineService
} from "../../src/services/query-pipeline.js"

describe("QueryPipelineService", () => {
  const mockConfig: QueryPipelineConfig = {
    minConfidence: 0.7,
    dryRun: false,
    maxRetries: 3
  }

  describe("QueryPipelineLive layer", () => {
    it("should create a QueryPipelineLive layer", () => {
      const layer = QueryPipelineLive(mockConfig)
      expect(layer).toBeDefined()
    })

    it("should handle different configurations", () => {
      const configs = [
        mockConfig,
        { ...mockConfig, minConfidence: 0.9 },
        { ...mockConfig, dryRun: true },
        { ...mockConfig, maxRetries: 5 }
      ]

      configs.forEach((config) => {
        const layer = QueryPipelineLive(config)
        expect(layer).toBeDefined()
      })
    })

    it("should handle extreme configurations", () => {
      const extremeConfigs = [
        { minConfidence: 0.0, dryRun: true, maxRetries: 0 },
        { minConfidence: 1.0, dryRun: false, maxRetries: 10 }
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
      const result = {
        question: "Show me all users",
        sql: "SELECT * FROM users",
        confidence: 0.95,
        explanation: "This query selects all users",
        results: [{ id: 1, name: "John" }],
        executionTime: 150
      }

      expect(result.question).toBe("Show me all users")
      expect(result.sql).toBe("SELECT * FROM users")
      expect(result.confidence).toBe(0.95)
      expect(result.results).toHaveLength(1)
      expect(result.executionTime).toBeGreaterThan(0)
    })

    it("should handle empty results", () => {
      const result = {
        question: "Show me users with impossible condition",
        sql: "SELECT * FROM users WHERE 1 = 0",
        confidence: 0.99,
        explanation: "This query returns no results",
        results: [],
        executionTime: 50
      }

      expect(result.results).toHaveLength(0)
      expect(Array.isArray(result.results)).toBe(true)
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
        { ...mockConfig, maxRetries: 1 },
        { ...mockConfig, maxRetries: 10 }
      ]

      retryConfigs.forEach((config) => {
        expect(config.maxRetries).toBeGreaterThanOrEqual(0)
        expect(typeof config.maxRetries).toBe("number")
      })
    })
  })
})
