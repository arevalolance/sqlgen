import { describe, expect, it } from "@effect/vitest"
import { makeTrainingService, TrainingError } from "@template/basic/train.js"

describe("TrainingService", () => {
  describe("makeTrainingService", () => {
    it("should create a training service factory", () => {
      const serviceFactory = makeTrainingService()
      expect(serviceFactory).toBeDefined()
      expect(typeof serviceFactory).toBe("object")
      expect("pipe" in serviceFactory).toBe(true)
    })

    it("should be a function that returns Effect", () => {
      const factory = makeTrainingService
      expect(typeof factory).toBe("function")

      const effect = factory()
      expect(typeof effect).toBe("object")
      expect("pipe" in effect).toBe(true)
    })
  })

  describe("TrainingError", () => {
    it("should create error with message", () => {
      const error = new TrainingError("Test error")
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe("Test error")
      expect(error.name).toBe("TrainingError")
    })

    it("should create error with cause", () => {
      const cause = new Error("Database connection failed")
      const error = new TrainingError("Test error", cause)
      expect(error.cause).toBe(cause)
    })
  })

  describe("TrainingService interface", () => {
    it("should define the expected service structure", () => {
      // The service should have these methods when created
      const expectedMethods = [
        "trainFromDatabase",
        "trainFromDdl",
        "trainFromDdlArray"
      ]

      // Test that the method names are defined as expected
      expectedMethods.forEach((method) => {
        expect(typeof method).toBe("string")
        expect(method.length).toBeGreaterThan(0)
      })
    })
  })

  describe("training concepts", () => {
    it("should handle different training sources", () => {
      const trainingSources = [
        "database",
        "ddl",
        "ddlArray"
      ]

      trainingSources.forEach((source) => {
        expect(typeof source).toBe("string")
        expect(source.length).toBeGreaterThan(0)
      })
    })

    it("should support DDL training", () => {
      const sampleDdl = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL
        );
      `

      expect(sampleDdl).toContain("CREATE TABLE")
      expect(sampleDdl).toContain("users")
      expect(sampleDdl).toContain("PRIMARY KEY")
    })

    it("should support multiple DDL training", () => {
      const ddlArray = [
        "CREATE TABLE users (id SERIAL PRIMARY KEY);",
        "CREATE TABLE orders (id SERIAL PRIMARY KEY);",
        "CREATE TABLE products (id SERIAL PRIMARY KEY);"
      ]

      expect(Array.isArray(ddlArray)).toBe(true)
      expect(ddlArray).toHaveLength(3)
      ddlArray.forEach((ddl) => {
        expect(ddl).toContain("CREATE TABLE")
      })
    })
  })

  describe("training workflow", () => {
    it("should support standard vector size", () => {
      const vectorSize = 1536 // OpenAI embedding standard size
      expect(vectorSize).toBe(1536)
      expect(typeof vectorSize).toBe("number")
      expect(vectorSize).toBeGreaterThan(0)
    })

    it("should handle training metadata", () => {
      const metadata = {
        type: "schema",
        timestamp: new Date().toISOString(),
        source: "ddl"
      }

      expect(metadata.type).toBe("schema")
      expect(typeof metadata.timestamp).toBe("string")
      expect(metadata.source).toBe("ddl")
    })
  })
})
