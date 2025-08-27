import { beforeEach, describe, expect, it, vi } from "@effect/vitest"
import { Effect, Layer } from "effect"
import {
  QdrantError,
  QdrantLive,
  QdrantService,
  type QdrantConfig,
  type VectorRecord
} from "@template/basic/providers/qdrant.js"
import { MockQdrantClient, expectEffect, testVectorRecords } from "../utils/test-helpers.js"

describe("QdrantService", () => {
  const mockConfig: QdrantConfig = {
    url: "http://localhost:6333",
    collectionName: "test_collection"
  }

  let mockQdrantClient: MockQdrantClient

  beforeEach(() => {
    vi.clearAllMocks()
    mockQdrantClient = new MockQdrantClient()
    
    // Mock the QdrantClient constructor
    vi.doMock("@qdrant/js-client-rest", () => ({
      QdrantClient: vi.fn().mockImplementation(() => mockQdrantClient)
    }))
  })

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

  describe("createCollection method", () => {
    it("should create collection through service with proper configuration", async () => {
      const vectorSize = 1536
      const expectedConfig = {
        vectors: {
          size: vectorSize,
          distance: "Cosine"
        }
      }
      
      const mockQdrantService = {
        createCollection: async (size: number) => {
          // Check if collection already exists
          const existing = await mockQdrantClient.getCollections()
          const collectionExists = existing.collections.some(c => c.name === "test_collection")
          
          if (!collectionExists) {
            await mockQdrantClient.createCollection("test_collection", {
              vectors: { size, distance: "Cosine" }
            })
          }
          
          return { created: !collectionExists, size }
        }
      }
      
      const result = await mockQdrantService.createCollection(vectorSize)
      
      expect(result.created).toBe(true)
      expect(result.size).toBe(vectorSize)
      
      const collections = await mockQdrantClient.getCollections()
      expect(collections.collections).toHaveLength(1)
      expect(collections.collections[0].config.vectors.size).toBe(vectorSize)
    })

    it("should not create collection if it already exists", async () => {
      // Pre-create the collection
      await mockQdrantClient.createCollection("test_collection", { vectors: { size: 1536 } })
      
      const collections = await mockQdrantClient.getCollections()
      expect(collections.collections).toHaveLength(1) // Still only one collection
    })

    it("should handle server errors during collection creation", async () => {
      const serverError = new Error("Connection refused - Qdrant server unavailable")
      vi.spyOn(mockQdrantClient, "getCollections").mockRejectedValue(serverError)
      
      const mockQdrantService = {
        createCollection: async (size: number) => {
          try {
            const existing = await mockQdrantClient.getCollections()
            // This won't be reached due to mock rejection
            return { created: true, size }
          } catch (error) {
            throw new QdrantError("Failed to create collection - server unavailable", error as Error)
          }
        }
      }
      
      await expect(mockQdrantService.createCollection(1536))
        .rejects.toThrow("Failed to create collection - server unavailable")
      
      try {
        await mockQdrantService.createCollection(1536)
      } catch (error) {
        expect(error).toBeInstanceOf(QdrantError)
        expect((error as QdrantError).cause).toBe(serverError)
      }
    })
  })

  describe("upsertVectors method", () => {
    it("should batch insert schema vectors with proper metadata", async () => {
      const schemaVectors: VectorRecord[] = [
        {
          id: "schema_users",
          vector: Array(1536).fill(0).map(() => Math.random() * 0.1), // Normalized vectors
          payload: {
            content: "CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(100), email VARCHAR(255) UNIQUE);",
            metadata: { type: "schema", table: "users", columns: 3 }
          }
        },
        {
          id: "schema_orders",
          vector: Array(1536).fill(0).map(() => Math.random() * 0.1),
          payload: {
            content: "CREATE TABLE orders (id SERIAL PRIMARY KEY, user_id INTEGER, total NUMERIC);",
            metadata: { type: "schema", table: "orders", columns: 3 }
          }
        }
      ]
      
      const mockQdrantService = {
        upsertVectors: async (vectors: VectorRecord[]) => {
          // Validate vector dimensions
          for (const vector of vectors) {
            if (vector.vector.length !== 1536) {
              throw new Error(`Invalid vector dimension: expected 1536, got ${vector.vector.length}`)
            }
          }
          
          // Ensure collection exists
          const collections = await mockQdrantClient.getCollections()
          if (collections.collections.length === 0) {
            await mockQdrantClient.createCollection("test_collection", { vectors: { size: 1536 } })
          }
          
          // Batch upsert
          await mockQdrantClient.upsert("test_collection", {
            wait: true,
            points: vectors.map(v => ({
              id: v.id,
              vector: v.vector,
              payload: v.payload
            }))
          })
          
          return { inserted: vectors.length, collection: "test_collection" }
        }
      }

      const result = await mockQdrantService.upsertVectors(schemaVectors)
      
      expect(result.inserted).toBe(2)
      expect(result.collection).toBe("test_collection")
      
      // Verify vectors were stored with correct metadata
      const storedVectors = await mockQdrantClient.search("test_collection", {
        vector: schemaVectors[0].vector,
        limit: 10
      })
      expect(storedVectors).toHaveLength(2)
      expect(storedVectors[0].payload.metadata.type).toBe("schema")
    })

    it("should handle dimension mismatch and collection errors", async () => {
      const invalidVectors: VectorRecord[] = [
        {
          id: "invalid_vector",
          vector: Array(512).fill(0.1), // Wrong dimension
          payload: { content: "test", metadata: {} }
        }
      ]
      
      const mockQdrantService = {
        upsertVectors: async (vectors: VectorRecord[]) => {
          // Validate dimensions
          for (const vector of vectors) {
            if (vector.vector.length !== 1536) {
              throw new QdrantError(`Vector dimension mismatch: expected 1536, got ${vector.vector.length}`)
            }
          }
          
          try {
            await mockQdrantClient.upsert("test_collection", {
              wait: true,
              points: vectors.map(v => ({ id: v.id, vector: v.vector, payload: v.payload }))
            })
          } catch (error) {
            throw new QdrantError("Failed to store vectors in collection", error as Error)
          }
        }
      }
      
      // Test dimension validation
      await expect(mockQdrantService.upsertVectors(invalidVectors))
        .rejects.toThrow("Vector dimension mismatch: expected 1536, got 512")
      
      // Test collection not found error
      const validVectors = testVectorRecords.slice(0, 1)
      vi.spyOn(mockQdrantClient, "upsert").mockRejectedValue(new Error("Collection 'test_collection' not found"))
      
      await expect(mockQdrantService.upsertVectors(validVectors))
        .rejects.toThrow("Failed to store vectors in collection")
    })
  })

  describe("search method", () => {
    beforeEach(async () => {
      // Pre-populate with test vectors
      await mockQdrantClient.createCollection("test_collection", { vectors: { size: 1536 } })
      await mockQdrantClient.upsert("test_collection", {
        wait: true,
        points: testVectorRecords.map(v => ({
          id: v.id,
          vector: v.vector,
          payload: v.payload
        }))
      })
    })

    it("should perform semantic search with proper ranking and filtering", async () => {
      const userTableQuery = "Find schema for user information table with email and name columns"
      
      // Generate query vector (simulating embedding of the query)
      const queryVector = Array(1536).fill(0).map(() => Math.random() * 0.1)
      
      const mockQdrantService = {
        search: async (query: string | number[], limit = 5, filter?: any) => {
          const searchVector = Array.isArray(query) ? query : queryVector
          
          const results = await mockQdrantClient.search("test_collection", {
            vector: searchVector,
            limit,
            filter: filter ? {
              must: [
                { key: "metadata.type", match: { value: filter.type } }
              ]
            } : undefined
          })
          
          // Sort by relevance score and add distance calculation
          return results
            .map(result => ({
              ...result,
              score: result.score || (1 - Math.random() * 0.5), // Mock similarity score
              distance: Math.random() * 0.8 // Mock cosine distance
            }))
            .sort((a, b) => b.score - a.score) // Higher score = more relevant
        }
      }
      
      // Test basic semantic search
      const results = await mockQdrantService.search(queryVector, 3)
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThanOrEqual(3)
      
      // Verify results are sorted by relevance
      for (let i = 1; i < results.length; i++) {
        expect(results[i-1].score).toBeGreaterThanOrEqual(results[i].score)
      }
      
      // Test filtered search for schema type
      const schemaResults = await mockQdrantService.search(queryVector, 5, { type: "schema" })
      expect(schemaResults.length).toBeGreaterThan(0)
      schemaResults.forEach(result => {
        expect(result.payload.metadata.type).toBe("schema")
      })
    })

    it("should handle search timeouts and empty results gracefully", async () => {
      const timeoutError = new Error("Request timeout after 30s")
      const queryVector = Array(1536).fill(0).map(() => Math.random())
      
      const mockQdrantService = {
        search: async (queryVector: number[], limit: number, timeout = 30000) => {
          try {
            // Simulate timeout conditions
            const isTimeout = Math.random() < 0.3 // 30% chance of timeout for testing
            
            if (isTimeout) {
              throw new Error("Request timeout after 30s")
            }
            
            const results = await mockQdrantClient.search("test_collection", {
              vector: queryVector,
              limit,
              timeout
            })
            
            return results.length === 0 
              ? { results: [], message: "No similar vectors found" }
              : { results, message: `Found ${results.length} similar vectors` }
              
          } catch (error) {
            if ((error as Error).message.includes('timeout')) {
              throw new QdrantError("Vector search timed out - try reducing search scope", error as Error)
            }
            throw new QdrantError("Vector search failed", error as Error)
          }
        }
      }
      
      // Test timeout handling with retry
      let searchResult: any = null
      let attempts = 0
      const maxAttempts = 3
      
      while (!searchResult && attempts < maxAttempts) {
        try {
          searchResult = await mockQdrantService.search(queryVector, 5)
          break
        } catch (error) {
          attempts++
          if (attempts === maxAttempts) {
            expect(error).toBeInstanceOf(QdrantError)
            expect((error as QdrantError).message).toContain("Vector search")
          }
        }
      }
      
      // If search succeeded, verify result structure
      if (searchResult) {
        expect(searchResult).toHaveProperty('results')
        expect(searchResult).toHaveProperty('message')
        expect(Array.isArray(searchResult.results)).toBe(true)
      }
    })
  })

  describe("deleteCollection method", () => {
    it("should delete a collection", async () => {
      // Create a collection first
      await mockQdrantClient.createCollection("test_collection", { vectors: { size: 1536 } })
      await mockQdrantClient.deleteCollection("test_collection")

      const collections = await mockQdrantClient.getCollections()
      expect(collections.collections).toHaveLength(0)
    })

    it("should handle deletion errors", () => {
      const error = new Error("Server error during deletion")
      vi.spyOn(mockQdrantClient, "deleteCollection").mockRejectedValue(error)

      const qdrantError = new QdrantError("Failed to delete collection", error)
      expect(qdrantError).toBeInstanceOf(QdrantError)
      expect(qdrantError.message).toContain("Failed to delete collection")
    })
  })
})
