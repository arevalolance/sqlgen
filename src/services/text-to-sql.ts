import { openai } from "@ai-sdk/openai"
import { embed, generateText } from "ai"
import { Context, Effect, Layer } from "effect"
import { PostgresService } from "../providers/postgres.js"
import { QdrantService } from "../providers/qdrant.js"

export class TextToSqlError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message)
    this.name = "TextToSqlError"
  }
}

export interface TextToSqlConfig {
  readonly model: string
  readonly embeddingModel: string
  readonly maxTokens?: number
  readonly temperature?: number
}

export interface SqlResult {
  readonly sql: string
  readonly confidence: number
  readonly explanation: string
}

export interface TextToSqlService {
  readonly generateSql: (question: string) => Effect.Effect<SqlResult, TextToSqlError>
  readonly trainFromSchema: (ddl: string) => Effect.Effect<void, TextToSqlError>
  readonly executeQuery: (sql: string) => Effect.Effect<Array<any>, TextToSqlError>
}

export const TextToSqlService = Context.GenericTag<TextToSqlService>("TextToSqlService")

const make = (
  config: TextToSqlConfig
): Effect.Effect<TextToSqlService, TextToSqlError, PostgresService | QdrantService> =>
  Effect.gen(function*() {
    const postgres = yield* PostgresService
    const qdrant = yield* QdrantService

    const generateSql = (question: string): Effect.Effect<SqlResult, TextToSqlError> =>
      Effect.gen(function*() {
        const questionEmbedding = yield* Effect.tryPromise({
          try: () =>
            embed({
              model: openai.embedding(config.embeddingModel),
              value: question
            }),
          catch: (error) => new TextToSqlError(`Failed to generate embedding: ${error}`, error as Error)
        })

        const similarSchemas = yield* qdrant.search(
          questionEmbedding.embedding,
          5
        ).pipe(
          Effect.mapError((error) => new TextToSqlError(`Vector search failed: ${error}`, error))
        )

        const schemaContext = similarSchemas
          .map((record) => record.payload.content)
          .join("\n\n")

        const prompt =
          `You are a SQL expert. Given the following database schema and a natural language question, generate a SQL query.

          Database Schema:
          ${schemaContext}

          Question: ${question}

          Generate a SQL query that answers this question. Provide your response in the following JSON format:
          {
            "sql": "your SQL query here",
            "confidence": 0.95,
            "explanation": "Brief explanation of the query"
          }

          Make sure the SQL is syntactically correct and follows PostgreSQL conventions.`

        const result = yield* Effect.tryPromise({
          try: () =>
            generateText({
              model: openai(config.model),
              prompt,
              maxTokens: config.maxTokens ?? 1000,
              temperature: config.temperature ?? 0.1
            }),
          catch: (error) => new TextToSqlError(`SQL generation failed: ${error}`, error as Error)
        })

        try {
          const parsed = JSON.parse(result.text)
          return {
            sql: parsed.sql,
            confidence: parsed.confidence,
            explanation: parsed.explanation
          }
        } catch (error) {
          return yield* Effect.fail(
            new TextToSqlError(`Failed to parse AI response: ${error}`, error as Error)
          )
        }
      })

    const trainFromSchema = (ddl: string): Effect.Effect<void, TextToSqlError> =>
      Effect.gen(function*() {
        const embedding = yield* Effect.tryPromise({
          try: () =>
            embed({
              model: openai.embedding(config.embeddingModel),
              value: ddl
            }),
          catch: (error) => new TextToSqlError(`Failed to generate embedding: ${error}`, error as Error)
        })

        const vectorId = crypto.randomUUID()

        yield* qdrant.upsertVectors([{
          id: vectorId,
          vector: embedding.embedding,
          payload: {
            content: ddl,
            metadata: {
              type: "schema",
              timestamp: new Date().toISOString()
            }
          }
        }]).pipe(
          Effect.mapError((error) => new TextToSqlError(`Failed to store schema: ${error}`, error))
        )
      })

    const executeQuery = (sql: string): Effect.Effect<Array<any>, TextToSqlError> =>
      Effect.gen(function*() {
        const result = yield* postgres.query(sql).pipe(
          Effect.mapError((error) => new TextToSqlError(`Query execution failed: ${error}`, error))
        )
        return result.rows
      })

    return {
      generateSql,
      trainFromSchema,
      executeQuery
    }
  })

export const TextToSqlLive = (
  config: TextToSqlConfig
): Layer.Layer<TextToSqlService, TextToSqlError, PostgresService | QdrantService> =>
  Layer.effect(TextToSqlService, make(config))
