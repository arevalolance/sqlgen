import { Context, Effect, Layer } from "effect"
import { PostgresService } from "./providers/postgres.js"
import { QdrantService } from "./providers/qdrant.js"
import { TextToSqlService } from "./services/text-to-sql.js"

export class TrainingError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message)
    this.name = "TrainingError"
  }
}

export interface TrainingService {
  readonly trainFromDatabase: () => Effect.Effect<void, TrainingError>
  readonly trainFromDdl: (ddl: string) => Effect.Effect<void, TrainingError>
  readonly trainFromDdlArray: (ddls: Array<string>) => Effect.Effect<void, TrainingError>
}

export const TrainingService = Context.GenericTag<TrainingService>("TrainingService")

const make = (): Effect.Effect<
  TrainingService,
  TrainingError,
  PostgresService | QdrantService | TextToSqlService
> =>
  Effect.gen(function*() {
    const postgres = yield* PostgresService
    const qdrant = yield* QdrantService
    const textToSql = yield* TextToSqlService

    const trainFromDatabase = (): Effect.Effect<void, TrainingError> =>
      Effect.gen(function*() {
        yield* Effect.log("Starting database schema training...")

        const tables = yield* postgres.getSchema().pipe(
          Effect.mapError((error) => new TrainingError(`Failed to get schema: ${error}`, error))
        )

        yield* Effect.log(`Found ${tables.length} tables to train on`)

        const vectorSize = 1536
        yield* qdrant.createCollection(vectorSize).pipe(
          Effect.mapError((error) => new TrainingError(`Failed to create collection: ${error}`, error))
        )

        yield* Effect.forEach(tables, (table) =>
          Effect.gen(function*() {
            yield* Effect.log(`Training on table: ${table}`)
            const ddl = yield* postgres.getTableSchema(table).pipe(
              Effect.mapError((error) => new TrainingError(`Failed to get table schema: ${error}`, error))
            )

            yield* textToSql.trainFromSchema(ddl).pipe(
              Effect.mapError((error) => new TrainingError(`Failed to train schema: ${error}`, error))
            )
          }))

        yield* Effect.log("Database schema training completed")
      })

    const trainFromDdl = (ddl: string): Effect.Effect<void, TrainingError> =>
      Effect.gen(function*() {
        yield* Effect.log("Training from provided DDL...")

        const vectorSize = 1536
        yield* qdrant.createCollection(vectorSize).pipe(
          Effect.mapError((error) => new TrainingError(`Failed to create collection: ${error}`, error))
        )

        yield* textToSql.trainFromSchema(ddl).pipe(
          Effect.mapError((error) => new TrainingError(`Failed to train schema: ${error}`, error))
        )

        yield* Effect.log("DDL training completed")
      })

    const trainFromDdlArray = (ddls: Array<string>): Effect.Effect<void, TrainingError> =>
      Effect.gen(function*() {
        yield* Effect.log(`Training from ${ddls.length} DDL statements...`)

        const vectorSize = 1536
        yield* qdrant.createCollection(vectorSize).pipe(
          Effect.mapError((error) => new TrainingError(`Failed to create collection: ${error}`, error))
        )

        yield* Effect.forEach(ddls, (ddl, index) =>
          Effect.gen(function*() {
            yield* Effect.log(`Training DDL ${index + 1}/${ddls.length}`)
            yield* textToSql.trainFromSchema(ddl).pipe(
              Effect.mapError((error) => new TrainingError(`Failed to train schema: ${error}`, error))
            )
          }))

        yield* Effect.log("DDL array training completed")
      })

    return {
      trainFromDatabase,
      trainFromDdl,
      trainFromDdlArray
    }
  })

export const TrainingLive: Layer.Layer<TrainingService, TrainingError, PostgresService | QdrantService | TextToSqlService> =
  Layer.effect(TrainingService, make())

export const makeTrainingService = (): Effect.Effect<
  TrainingService,
  TrainingError,
  PostgresService | QdrantService | TextToSqlService
> => make()

export const train = makeTrainingService
