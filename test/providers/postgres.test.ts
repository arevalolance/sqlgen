import { describe, expect, it } from "@effect/vitest"
import {
  type PostgresConfig,
  PostgresError,
  PostgresLive,
  PostgresService
} from "@template/basic/providers/postgres.js"

describe("PostgresService", () => {
  const mockConfig: PostgresConfig = {
    host: "localhost",
    port: 5432,
    database: "test_db",
    user: "test_user",
    password: "test_password",
    ssl: false
  }

  describe("PostgresLive layer", () => {
    it("should create a PostgresLive layer", () => {
      const layer = PostgresLive(mockConfig)
      expect(layer).toBeDefined()
    })

    it("should handle different configurations", () => {
      const configs = [
        mockConfig,
        { ...mockConfig, ssl: true },
        { ...mockConfig, port: 3306 }
      ]

      configs.forEach((config) => {
        const layer = PostgresLive(config)
        expect(layer).toBeDefined()
      })
    })
  })

  describe("PostgresError", () => {
    it("should create error with message", () => {
      const error = new PostgresError("Test error")
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe("Test error")
      expect(error.name).toBe("PostgresError")
    })

    it("should create error with cause", () => {
      const cause = new Error("Original error")
      const error = new PostgresError("Test error", cause)
      expect(error.cause).toBe(cause)
    })
  })

  describe("PostgresService interface", () => {
    it("should define correct service interface", () => {
      expect(PostgresService).toBeDefined()
      expect(PostgresService.key).toBe("PostgresService")
    })
  })
})
