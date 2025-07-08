import { Effect, Layer } from "effect"
import type { PostgresConfig } from "./providers/postgres.js"
import { PostgresLive } from "./providers/postgres.js"
import type { QdrantConfig } from "./providers/qdrant.js"
import { QdrantLive } from "./providers/qdrant.js"
import type { QueryPipelineConfig } from "./services/query-pipeline.js"
import { QueryPipelineLive, QueryPipelineService } from "./services/query-pipeline.js"
import type { TextToSqlConfig } from "./services/text-to-sql.js"
import { TextToSqlLive } from "./services/text-to-sql.js"
import { TrainingLive, TrainingService } from "./train.js"

export interface SqlGenConfig {
  readonly postgres: PostgresConfig
  readonly qdrant: QdrantConfig
  readonly textToSql: TextToSqlConfig
  readonly pipeline: QueryPipelineConfig
}

export class SqlGen {
  constructor(private config: SqlGenConfig) {}

  private get allLayers() {
    const baseLayer = Layer.mergeAll(
      PostgresLive(this.config.postgres),
      QdrantLive(this.config.qdrant)
    )

    const textToSqlLayer = Layer.provide(
      TextToSqlLive(this.config.textToSql),
      baseLayer
    )

    const serviceLayer = Layer.mergeAll(
      QueryPipelineLive(this.config.pipeline),
      TrainingLive
    )

    return Layer.provide(serviceLayer, Layer.mergeAll(textToSqlLayer, baseLayer))
  }

  ask(question: string) {
    return Effect.gen(function*() {
      const pipeline = yield* QueryPipelineService
      return yield* pipeline.askQuestion(question)
    }).pipe(Effect.provide(this.allLayers))
  }

  train() {
    return Effect.gen(function*() {
      const training = yield* TrainingService
      return training
    }).pipe(Effect.provide(this.allLayers))
  }

  trainFromDatabase() {
    return Effect.gen(function*() {
      const training = yield* TrainingService
      return yield* training.trainFromDatabase()
    }).pipe(Effect.provide(this.allLayers))
  }

  trainFromDdl(ddl: string) {
    return Effect.gen(function*() {
      const training = yield* TrainingService
      return yield* training.trainFromDdl(ddl)
    }).pipe(Effect.provide(this.allLayers))
  }

  trainFromDdlArray(ddls: Array<string>) {
    return Effect.gen(function*() {
      const training = yield* TrainingService
      return yield* training.trainFromDdlArray(ddls)
    }).pipe(Effect.provide(this.allLayers))
  }

  validateSql(sql: string) {
    return Effect.gen(function*() {
      const pipeline = yield* QueryPipelineService
      return yield* pipeline.validateSql(sql)
    }).pipe(Effect.provide(this.allLayers))
  }

  explainQuery(sql: string) {
    return Effect.gen(function*() {
      const pipeline = yield* QueryPipelineService
      return yield* pipeline.explainQuery(sql)
    }).pipe(Effect.provide(this.allLayers))
  }
}

export const createSqlGen = (config: SqlGenConfig): SqlGen => {
  return new SqlGen(config)
}

export * from "./providers/postgres.js"
export * from "./providers/qdrant.js"
export * from "./services/query-pipeline.js"
export * from "./services/text-to-sql.js"
export * from "./train.js"
