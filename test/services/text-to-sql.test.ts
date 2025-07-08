import { describe, expect, it } from "@effect/vitest"
import {
  type TextToSqlConfig,
  TextToSqlError,
  TextToSqlLive,
  TextToSqlService
} from "@template/basic/services/text-to-sql.js"

describe("TextToSqlService", () => {
  const mockConfig: TextToSqlConfig = {
    model: "gpt-4",
    embeddingModel: "text-embedding-3-small",
    maxTokens: 1000,
    temperature: 0.1
  }

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
})
