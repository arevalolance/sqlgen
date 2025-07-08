import type { SqlGenConfig } from "../src/index.js"

export interface EnvConfig {
  // OpenAI Configuration
  OPENAI_API_KEY: string
  OPENAI_MODEL: string
  OPENAI_EMBEDDING_MODEL: string
  OPENAI_MAX_TOKENS: number
  OPENAI_TEMPERATURE: number

  // Database Configuration
  DATABASE_URL?: string
  DATABASE_HOST?: string
  DATABASE_PORT?: number
  DATABASE_NAME?: string
  DATABASE_USER?: string
  DATABASE_PASSWORD?: string
  DATABASE_SSL?: boolean

  // Qdrant Configuration
  QDRANT_URL: string
  QDRANT_COLLECTION_NAME: string
  QDRANT_API_KEY?: string

  // Pipeline Configuration
  PIPELINE_MIN_CONFIDENCE: number
  PIPELINE_DRY_RUN: boolean
  PIPELINE_MAX_RETRIES: number

  // Logging Configuration
  LOG_LEVEL: string
  DEBUG_MODE: boolean
}

function validateEnvVar(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue
  return value.toLowerCase() === 'true'
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue
  const parsed = Number(value)
  if (isNaN(parsed)) return defaultValue
  return parsed
}

export function loadEnvConfig(): EnvConfig {
  return {
    // OpenAI Configuration
    OPENAI_API_KEY: validateEnvVar('OPENAI_API_KEY', process.env.OPENAI_API_KEY),
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4',
    OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    OPENAI_MAX_TOKENS: parseNumber(process.env.OPENAI_MAX_TOKENS, 1000),
    OPENAI_TEMPERATURE: parseNumber(process.env.OPENAI_TEMPERATURE, 0.1),

    // Database Configuration
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_HOST: process.env.DATABASE_HOST || 'localhost',
    DATABASE_PORT: parseNumber(process.env.DATABASE_PORT, 5432),
    DATABASE_NAME: process.env.DATABASE_NAME,
    DATABASE_USER: process.env.DATABASE_USER,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
    DATABASE_SSL: parseBoolean(process.env.DATABASE_SSL, false),

    // Qdrant Configuration
    QDRANT_URL: process.env.QDRANT_URL || 'http://localhost:6333',
    QDRANT_COLLECTION_NAME: process.env.QDRANT_COLLECTION_NAME || 'sql_schemas',
    QDRANT_API_KEY: process.env.QDRANT_API_KEY,

    // Pipeline Configuration
    PIPELINE_MIN_CONFIDENCE: parseNumber(process.env.PIPELINE_MIN_CONFIDENCE, 0.7),
    PIPELINE_DRY_RUN: parseBoolean(process.env.PIPELINE_DRY_RUN, false),
    PIPELINE_MAX_RETRIES: parseNumber(process.env.PIPELINE_MAX_RETRIES, 3),

    // Logging Configuration
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    DEBUG_MODE: parseBoolean(process.env.DEBUG_MODE, false)
  }
}

export function createSqlGenConfig(envConfig: EnvConfig): SqlGenConfig {
  // Determine postgres config from environment
  let postgresConfig
  if (envConfig.DATABASE_URL) {
    // Parse DATABASE_URL
    const url = new URL(envConfig.DATABASE_URL)
    postgresConfig = {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1), // Remove leading /
      user: url.username,
      password: url.password,
      ssl: envConfig.DATABASE_SSL || false
    }
  } else {
    // Use individual environment variables
    postgresConfig = {
      host: envConfig.DATABASE_HOST || 'localhost',
      port: envConfig.DATABASE_PORT || 5432,
      database: validateEnvVar('DATABASE_NAME', envConfig.DATABASE_NAME),
      user: validateEnvVar('DATABASE_USER', envConfig.DATABASE_USER),
      password: validateEnvVar('DATABASE_PASSWORD', envConfig.DATABASE_PASSWORD),
      ssl: envConfig.DATABASE_SSL || false
    }
  }

  return {
    postgres: postgresConfig,
    qdrant: {
      url: envConfig.QDRANT_URL,
      collectionName: envConfig.QDRANT_COLLECTION_NAME,
      apiKey: envConfig.QDRANT_API_KEY
    },
    textToSql: {
      model: envConfig.OPENAI_MODEL,
      embeddingModel: envConfig.OPENAI_EMBEDDING_MODEL,
      maxTokens: envConfig.OPENAI_MAX_TOKENS,
      temperature: envConfig.OPENAI_TEMPERATURE
    },
    pipeline: {
      minConfidence: envConfig.PIPELINE_MIN_CONFIDENCE,
      dryRun: envConfig.PIPELINE_DRY_RUN,
      maxRetries: envConfig.PIPELINE_MAX_RETRIES
    }
  }
}

export function setupEnvironment(): SqlGenConfig {
  console.log('🔧 Loading environment configuration...')
  
  const envConfig = loadEnvConfig()
  
  if (envConfig.DEBUG_MODE) {
    console.log('📊 Environment configuration loaded:', {
      model: envConfig.OPENAI_MODEL,
      database: envConfig.DATABASE_URL ? '[URL]' : `${envConfig.DATABASE_HOST}:${envConfig.DATABASE_PORT}/${envConfig.DATABASE_NAME}`,
      qdrant: envConfig.QDRANT_URL,
      collection: envConfig.QDRANT_COLLECTION_NAME
    })
  }
  
  return createSqlGenConfig(envConfig)
}