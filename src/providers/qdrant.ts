import { QdrantClient } from "@qdrant/js-client-rest"
import { Context, Effect, Layer } from "effect"

export class QdrantError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message)
    this.name = "QdrantError"
  }
}

export interface QdrantConfig {
  readonly url: string
  readonly apiKey?: string
  readonly collectionName: string
}

export interface VectorRecord {
  readonly id: string
  readonly vector: Array<number>
  readonly payload: {
    readonly content: string
    readonly metadata?: Record<string, unknown>
  }
}

export interface QdrantService {
  readonly createCollection: (vectorSize: number) => Effect.Effect<void, QdrantError>
  readonly upsertVectors: (vectors: Array<VectorRecord>) => Effect.Effect<void, QdrantError>
  readonly search: (
    vector: Array<number>,
    limit?: number,
    filter?: Record<string, unknown>
  ) => Effect.Effect<Array<VectorRecord>, QdrantError>
  readonly deleteCollection: () => Effect.Effect<void, QdrantError>
}

export const QdrantService = Context.GenericTag<QdrantService>("QdrantService")

const make = (config: QdrantConfig): Effect.Effect<QdrantService, QdrantError> =>
  Effect.gen(function*() {
    const client = yield* Effect.sync(() =>
      config.apiKey
        ? new QdrantClient({
          url: config.url,
          apiKey: config.apiKey
        })
        : new QdrantClient({
          url: config.url
        })
    )

    const createCollection = (vectorSize: number): Effect.Effect<void, QdrantError> =>
      Effect.tryPromise({
        try: async () => {
          const collections = await client.getCollections()
          const exists = collections.collections.some(
            (col) => col.name === config.collectionName
          )

          if (!exists) {
            await client.createCollection(config.collectionName, {
              vectors: {
                size: vectorSize,
                distance: "Cosine"
              }
            })
          }
        },
        catch: (error) => new QdrantError(`Failed to create collection: ${error}`, error as Error)
      })

    const upsertVectors = (vectors: Array<VectorRecord>): Effect.Effect<void, QdrantError> =>
      Effect.tryPromise({
        try: () =>
          client.upsert(config.collectionName, {
            wait: true,
            points: vectors.map((v) => ({
              id: v.id,
              vector: v.vector,
              payload: v.payload
            }))
          }),
        catch: (error) => new QdrantError(`Failed to upsert vectors: ${error}`, error as Error)
      }).pipe(Effect.map(() => void 0))

    const search = (
      vector: Array<number>,
      limit = 10,
      filter?: Record<string, unknown>
    ): Effect.Effect<Array<VectorRecord>, QdrantError> =>
      Effect.tryPromise({
        try: () => {
          const searchParams = {
            vector,
            limit,
            with_payload: true
          } as any

          if (filter) {
            searchParams.filter = filter
          }

          return client.search(config.collectionName, searchParams)
        },
        catch: (error) => new QdrantError(`Search failed: ${error}`, error as Error)
      }).pipe(
        Effect.map((result) =>
          result.map((point) => ({
            id: point.id as string,
            vector: point.vector as Array<number>,
            payload: point.payload as {
              content: string
              metadata?: Record<string, unknown>
            }
          }))
        )
      )

    const deleteCollection = (): Effect.Effect<void, QdrantError> =>
      Effect.tryPromise({
        try: () => client.deleteCollection(config.collectionName),
        catch: (error) => new QdrantError(`Failed to delete collection: ${error}`, error as Error)
      }).pipe(Effect.map(() => void 0))

    return {
      createCollection,
      upsertVectors,
      search,
      deleteCollection
    }
  })

export const QdrantLive = (config: QdrantConfig): Layer.Layer<QdrantService, QdrantError> =>
  Layer.effect(QdrantService, make(config))
