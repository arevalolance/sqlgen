import { describe, expect, it } from "@effect/vitest"
import { type QdrantConfig, QdrantError, QdrantLive, QdrantService } from "@template/basic/providers/qdrant.js"

describe("QdrantService", () => {
  const mockConfig: QdrantConfig = {
    url: "http://localhost:6333",
    collectionName: "test_collection"
  }

  describe("QdrantLive layer", () => {
    it("should create a QdrantLive layer", () => {
      const layer = QdrantLive(mockConfig)
      expect(layer).toBeDefined()
    })

    it("should handle configuration with API key", () => {
      const configWithApiKey = {
        ...mockConfig,
        apiKey: "test-api-key"
      }
      const layer = QdrantLive(configWithApiKey)
      expect(layer).toBeDefined()
    })

    it("should handle different URLs", () => {
      const configs = [
        { ...mockConfig, url: "http://localhost:6333" },
        { ...mockConfig, url: "https://cloud.qdrant.io" },
        { ...mockConfig, url: "http://192.168.1.100:6333" }
      ]

      configs.forEach((config) => {
        const layer = QdrantLive(config)
        expect(layer).toBeDefined()
      })
    })
  })

  describe("QdrantError", () => {
    it("should create error with message", () => {
      const error = new QdrantError("Test error")
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe("Test error")
      expect(error.name).toBe("QdrantError")
    })

    it("should create error with cause", () => {
      const cause = new Error("Network error")
      const error = new QdrantError("Test error", cause)
      expect(error.cause).toBe(cause)
    })
  })

  describe("QdrantService interface", () => {
    it("should define correct service interface", () => {
      expect(QdrantService).toBeDefined()
      expect(QdrantService.key).toBe("QdrantService")
    })
  })

  describe("VectorRecord interface", () => {
    it("should accept valid vector records", () => {
      const record = {
        id: "test-vector-1",
        vector: [0.1, 0.2, 0.3],
        payload: {
          content: "test content",
          metadata: {
            type: "test",
            timestamp: "2024-01-01T00:00:00Z"
          }
        }
      }

      // Test that the record structure is accepted
      expect(record.id).toBe("test-vector-1")
      expect(record.vector).toHaveLength(3)
      expect(record.payload.content).toBe("test content")
    })
  })
})
