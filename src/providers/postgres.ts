import { Context, Effect, Layer } from "effect"
import type { QueryResult } from "pg"
import { Pool } from "pg"

export class PostgresError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message)
    this.name = "PostgresError"
  }
}

export interface PostgresConfig {
  readonly host: string
  readonly port: number
  readonly database: string
  readonly user: string
  readonly password: string
  readonly ssl?: boolean
}

export interface PostgresService {
  readonly query: (sql: string, params?: Array<any>) => Effect.Effect<QueryResult<any>, PostgresError>
  readonly getSchema: () => Effect.Effect<Array<string>, PostgresError>
  readonly getTableSchema: (tableName: string) => Effect.Effect<string, PostgresError>
  readonly close: () => Effect.Effect<void, PostgresError>
}

export const PostgresService = Context.GenericTag<PostgresService>("PostgresService")

const make = (config: PostgresConfig): Effect.Effect<PostgresService, PostgresError> =>
  Effect.gen(function*() {
    const pool = yield* Effect.sync(() =>
      new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl
      })
    )

    const query = (sql: string, params?: Array<any>): Effect.Effect<QueryResult<any>, PostgresError> =>
      Effect.tryPromise({
        try: () => pool.query(sql, params),
        catch: (error) => new PostgresError(`Query failed: ${error}`, error as Error)
      })

    const getSchema = (): Effect.Effect<Array<string>, PostgresError> =>
      Effect.gen(function*() {
        const result = yield* query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        )
        return result.rows.map((row) => row.table_name)
      })

    const getTableSchema = (tableName: string): Effect.Effect<string, PostgresError> =>
      Effect.gen(function*() {
        const result = yield* query(
          `SELECT 
            column_name, 
            data_type, 
            is_nullable, 
            column_default 
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position`,
          [tableName]
        )

        const columns = result.rows.map((row) =>
          `${row.column_name} ${row.data_type}${row.is_nullable === "NO" ? " NOT NULL" : ""}${
            row.column_default ? ` DEFAULT ${row.column_default}` : ""
          }`
        ).join(", ")

        return `CREATE TABLE ${tableName} (${columns})`
      })

    const close = (): Effect.Effect<void, PostgresError> =>
      Effect.tryPromise({
        try: () => pool.end(),
        catch: (error) => new PostgresError(`Failed to close pool: ${error}`, error as Error)
      })

    return {
      query,
      getSchema,
      getTableSchema,
      close
    }
  })

export const PostgresLive = (config: PostgresConfig): Layer.Layer<PostgresService, PostgresError> =>
  Layer.effect(PostgresService, make(config))
