import { Context, Effect, Layer } from "effect"
import { PostgresService } from "../providers/postgres.js"
import { TextToSqlService } from "./text-to-sql.js"

export class QueryPipelineError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message)
    this.name = "QueryPipelineError"
  }
}

export interface QueryResult {
  readonly question: string
  readonly sql: string
  readonly confidence: number
  readonly explanation: string
  readonly results: Array<any>
  readonly executionTime: number
}

export interface QueryPipelineConfig {
  readonly minConfidence: number
  readonly dryRun: boolean
  readonly maxRetries: number
}

export interface QueryPipelineService {
  readonly askQuestion: (question: string) => Effect.Effect<QueryResult, QueryPipelineError>
  readonly validateSql: (sql: string) => Effect.Effect<boolean, QueryPipelineError>
  readonly explainQuery: (sql: string) => Effect.Effect<Array<any>, QueryPipelineError>
}

export const QueryPipelineService = Context.GenericTag<QueryPipelineService>("QueryPipelineService")

const make = (
  config: QueryPipelineConfig
): Effect.Effect<QueryPipelineService, QueryPipelineError, TextToSqlService | PostgresService> =>
  Effect.gen(function*() {
    const textToSql = yield* TextToSqlService
    const postgres = yield* PostgresService

    const validateSql = (sql: string): Effect.Effect<boolean, QueryPipelineError> =>
      Effect.gen(function*() {
        try {
          yield* postgres.query(`EXPLAIN ${sql}`).pipe(
            Effect.mapError((error) => new QueryPipelineError(`SQL validation failed: ${error}`, error))
          )
          return true
        } catch {
          return false
        }
      })

    const explainQuery = (sql: string): Effect.Effect<Array<any>, QueryPipelineError> =>
      Effect.gen(function*() {
        const result = yield* postgres.query(`EXPLAIN ANALYZE ${sql}`).pipe(
          Effect.mapError((error) => new QueryPipelineError(`Query explanation failed: ${error}`, error))
        )
        return result.rows
      })

    const askQuestion = (question: string): Effect.Effect<QueryResult, QueryPipelineError> =>
      Effect.gen(function*() {
        yield* Effect.log(`Processing question: ${question}`)

        const startTime = Date.now()

        const sqlResult = yield* textToSql.generateSql(question).pipe(
          Effect.mapError((error) => new QueryPipelineError(`SQL generation failed: ${error}`, error))
        )

        if (sqlResult.confidence < config.minConfidence) {
          return yield* Effect.fail(
            new QueryPipelineError(
              `Generated SQL has low confidence: ${sqlResult.confidence}. Minimum required: ${config.minConfidence}`
            )
          )
        }

        const isValid = yield* validateSql(sqlResult.sql)
        if (!isValid) {
          return yield* Effect.fail(
            new QueryPipelineError(`Generated SQL is invalid: ${sqlResult.sql}`)
          )
        }

        let results: Array<any> = []
        if (!config.dryRun) {
          results = yield* textToSql.executeQuery(sqlResult.sql).pipe(
            Effect.mapError((error) => new QueryPipelineError(`Query execution failed: ${error}`, error))
          )
        }

        const executionTime = Date.now() - startTime

        yield* Effect.log(`Question processed in ${executionTime}ms`)

        return {
          question,
          sql: sqlResult.sql,
          confidence: sqlResult.confidence,
          explanation: sqlResult.explanation,
          results,
          executionTime
        }
      })

    return {
      askQuestion,
      validateSql,
      explainQuery
    }
  })

export const QueryPipelineLive = (
  config: QueryPipelineConfig
): Layer.Layer<QueryPipelineService, QueryPipelineError, TextToSqlService | PostgresService> =>
  Layer.effect(QueryPipelineService, make(config))
