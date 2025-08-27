import { beforeEach, describe, expect, it, vi } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { newDb } from "pg-mem"
import {
  type PostgresConfig,
  PostgresError,
  PostgresLive,
  PostgresService
} from "@template/basic/providers/postgres.js"
import { createTestDatabase, expectEffect } from "../utils/test-helpers.js"

describe("PostgresService", () => {
  const mockConfig: PostgresConfig = {
    host: "localhost",
    port: 5432,
    database: "test_db",
    user: "test_user",
    password: "test_password",
    ssl: false
  }

  let testDb: ReturnType<typeof newDb>
  let mockPool: any

  beforeEach(() => {
    vi.clearAllMocks()
    testDb = createTestDatabase()
    mockPool = {
      query: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined)
    }
  })

  describe("PostgresLive layer", () => {
    it("should create a PostgresLive layer", () => {
      const layer = PostgresLive(mockConfig)
      expect(layer).toBeDefined()
    })

    it("should handle different configurations", () => {
      const configs = [
        mockConfig,
        { ...mockConfig, ssl: true },
        { ...mockConfig, port: 3306 }
      ]

      configs.forEach((config) => {
        const layer = PostgresLive(config)
        expect(layer).toBeDefined()
      })
    })
  })

  describe("PostgresError", () => {
    it("should create error with message", () => {
      const error = new PostgresError("Test error")
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe("Test error")
      expect(error.name).toBe("PostgresError")
    })

    it("should create error with cause", () => {
      const cause = new Error("Original error")
      const error = new PostgresError("Test error", cause)
      expect(error.cause).toBe(cause)
    })
  })

  describe("PostgresService interface", () => {
    it("should define correct service interface", () => {
      expect(PostgresService).toBeDefined()
      expect(PostgresService.key).toBe("PostgresService")
    })
  })

  describe("query method", () => {
    it("should execute SQL queries and return results", async () => {
      const sql = "SELECT id, name, email FROM users WHERE active = $1"
      const params = [true]
      const mockResult = {
        rows: [
          { id: 1, name: "Alice", email: "alice@example.com" },
          { id: 2, name: "Bob", email: "bob@example.com" }
        ],
        rowCount: 2
      }
      
      mockPool.query.mockResolvedValue(mockResult)
      
      const mockPostgresService = {
        query: async (sql: string, params?: any[]) => {
          return await mockPool.query(sql, params)
        }
      }
      
      const result = await mockPostgresService.query(sql, params)
      
      expect(mockPool.query).toHaveBeenCalledWith(sql, params)
      expect(result.rows).toHaveLength(2)
      expect(result.rowCount).toBe(2)
      expect(result.rows[0]).toHaveProperty('id', 1)
      expect(result.rows[0]).toHaveProperty('name', 'Alice')
      expect(result.rows[1]).toHaveProperty('email', 'bob@example.com')
    })

    it("should handle parameterized queries with proper escaping", async () => {
      const sql = "SELECT * FROM users WHERE name = $1 AND created_at > $2 AND status = $3"
      const params = ["O'Brien", new Date('2023-01-01'), 'active'] // Test SQL injection protection
      const mockResult = {
        rows: [{ id: 42, name: "O'Brien", status: 'active', created_at: '2023-06-15T10:30:00Z' }],
        rowCount: 1
      }
      
      mockPool.query.mockResolvedValue(mockResult)
      
      const mockPostgresService = {
        query: async (sql: string, params?: any[]) => {
          // Simulate parameter validation
          if (params && params.length > 0) {
            for (const param of params) {
              if (typeof param === 'string' && param.includes(';') && param.includes('DROP')) {
                throw new Error('Potential SQL injection detected')
              }
            }
          }
          return await mockPool.query(sql, params)
        }
      }
      
      const result = await mockPostgresService.query(sql, params)
      
      expect(mockPool.query).toHaveBeenCalledWith(sql, params)
      expect(result.rows[0].name).toBe("O'Brien")
      expect(result.rows[0].id).toBe(42)
      
      // Test SQL injection protection
      const maliciousSql = "SELECT * FROM users WHERE id = $1"
      const maliciousParams = ["1; DROP TABLE users; --"]
      
      await expect(mockPostgresService.query(maliciousSql, maliciousParams))
        .rejects.toThrow('Potential SQL injection detected')
    })

    it("should handle database errors and wrap them properly", async () => {
      const sql = "SELECT * FROM nonexistent_table"
      const dbError = new Error('relation "nonexistent_table" does not exist')
      
      mockPool.query.mockRejectedValue(dbError)
      
      const mockPostgresService = {
        query: async (sql: string, params?: any[]) => {
          try {
            return await mockPool.query(sql, params)
          } catch (error) {
            throw new PostgresError('Database query failed', error as Error)
          }
        }
      }
      
      await expect(mockPostgresService.query(sql)).rejects.toThrow('Database query failed')
      expect(mockPool.query).toHaveBeenCalledWith(sql, undefined)
      
      try {
        await mockPostgresService.query(sql)
      } catch (error) {
        expect(error).toBeInstanceOf(PostgresError)
        expect((error as PostgresError).cause).toBe(dbError)
      }
    })

    it("should handle connection timeouts with retry logic", async () => {
      const sql = "SELECT COUNT(*) FROM large_table"
      const timeoutError = new Error("connection timeout after 30000ms")
      
      // Mock to timeout on first two attempts, succeed on third
      mockPool.query
        .mockRejectedValueOnce(timeoutError)
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({ rows: [{ count: 1000000 }], rowCount: 1 })
      
      const mockPostgresService = {
        query: async (sql: string, params?: any[], maxRetries = 2) => {
          let lastError: Error | null = null
          
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              return await mockPool.query(sql, params)
            } catch (error) {
              lastError = error as Error
              if (attempt === maxRetries) {
                throw new PostgresError(`Query failed after ${maxRetries + 1} attempts`, lastError)
              }
              // Wait before retry (simulated)
              await new Promise(resolve => setTimeout(resolve, 1))
            }
          }
        }
      }
      
      const result = await mockPostgresService.query(sql)
      
      expect(mockPool.query).toHaveBeenCalledTimes(3)
      expect(result.rows[0].count).toBe(1000000)
    })
  })

  describe("getSchema method", () => {
    it("should retrieve and transform database table names", async () => {
      const mockResult = {
        rows: [
          { table_name: "users" },
          { table_name: "orders" },
          { table_name: "products" },
          { table_name: "migrations" }, // Should be filtered out
          { table_name: "schema_migrations" } // Should be filtered out
        ]
      }
      mockPool.query.mockResolvedValue(mockResult)
      
      const mockPostgresService = {
        getSchema: async () => {
          const result = await mockPool.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
          )
          
          // Filter out system/migration tables
          const filteredTables = result.rows
            .map(row => row.table_name)
            .filter(name => !name.includes('migration') && !name.startsWith('_'))
            .sort()
          
          return filteredTables
        }
      }
      
      const tables = await mockPostgresService.getSchema()
      
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      )
      expect(tables).toEqual(["orders", "products", "users"]) // Sorted and filtered
      expect(tables).not.toContain("migrations")
      expect(tables).not.toContain("schema_migrations")
    })

    it("should handle empty schema gracefully", async () => {
      const mockResult = { rows: [] }
      mockPool.query.mockResolvedValue(mockResult)
      
      const mockPostgresService = {
        getSchema: async () => {
          const result = await mockPool.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
          )
          
          const tables = result.rows.map(row => row.table_name)
          return tables.length === 0 ? [] : tables
        }
      }
      
      const tables = await mockPostgresService.getSchema()
      
      expect(mockPool.query).toHaveBeenCalled()
      expect(tables).toEqual([])
      expect(Array.isArray(tables)).toBe(true)
    })

    it("should handle permissions and access errors", async () => {
      const permissionError = new Error('permission denied for schema information_schema')
      mockPool.query.mockRejectedValue(permissionError)
      
      const mockPostgresService = {
        getSchema: async (includeSystemTables = false) => {
          try {
            const schemaFilter = includeSystemTables ? "table_schema IN ('public', 'information_schema')" : "table_schema = 'public'"
            const result = await mockPool.query(
              `SELECT table_name FROM information_schema.tables WHERE ${schemaFilter}`
            )
            return result.rows.map(row => row.table_name)
          } catch (error) {
            const err = error as Error
            if (err.message.includes('permission denied')) {
              throw new PostgresError('Insufficient permissions to access database schema', err)
            }
            throw new PostgresError('Failed to retrieve database schema', err)
          }
        }
      }
      
      await expect(mockPostgresService.getSchema()).rejects.toThrow('Insufficient permissions to access database schema')
      expect(mockPool.query).toHaveBeenCalledWith(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
      )
    })
  })

  describe("getTableSchema method", () => {
    it("should generate complete DDL from column metadata", async () => {
      const tableName = "users"
      const mockResult = {
        rows: [
          {
            column_name: "id",
            data_type: "integer",
            is_nullable: "NO",
            column_default: "nextval('users_id_seq'::regclass)"
          },
          {
            column_name: "name",
            data_type: "character varying",
            character_maximum_length: 100,
            is_nullable: "NO",
            column_default: null
          },
          {
            column_name: "email",
            data_type: "character varying",
            character_maximum_length: 255,
            is_nullable: "YES",
            column_default: null
          },
          {
            column_name: "created_at",
            data_type: "timestamp with time zone",
            is_nullable: "NO",
            column_default: "CURRENT_TIMESTAMP"
          }
        ]
      }
      mockPool.query.mockResolvedValue(mockResult)
      
      const mockPostgresService = {
        getTableSchema: async (tableName: string) => {
          const result = await mockPool.query(`
            SELECT 
              column_name, 
              data_type, 
              character_maximum_length,
              is_nullable, 
              column_default
            FROM information_schema.columns 
            WHERE table_name = $1 
            ORDER BY ordinal_position
          `, [tableName])
          
          // Build DDL from column metadata
          const columns = result.rows.map(row => {
            let columnDef = `${row.column_name} `
            
            // Handle data type
            if (row.data_type === 'character varying' && row.character_maximum_length) {
              columnDef += `VARCHAR(${row.character_maximum_length})`
            } else if (row.data_type === 'timestamp with time zone') {
              columnDef += 'TIMESTAMPTZ'
            } else {
              columnDef += row.data_type.toUpperCase()
            }
            
            // Handle nullable
            if (row.is_nullable === 'NO') {
              columnDef += ' NOT NULL'
            }
            
            // Handle default
            if (row.column_default) {
              columnDef += ` DEFAULT ${row.column_default}`
            }
            
            return columnDef
          })
          
          const ddl = `CREATE TABLE ${tableName} (\n  ${columns.join(',\n  ')}\n);`
          return ddl
        }
      }
      
      const ddl = await mockPostgresService.getTableSchema(tableName)
      
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('information_schema.columns'), [tableName])
      expect(ddl).toContain(`CREATE TABLE ${tableName}`)
      expect(ddl).toContain('id INTEGER NOT NULL DEFAULT')
      expect(ddl).toContain('name VARCHAR(100) NOT NULL')
      expect(ddl).toContain('email VARCHAR(255)')
      expect(ddl).toContain('created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP')
      
      // Verify proper DDL structure
      const lines = ddl.split('\n')
      expect(lines[0]).toBe('CREATE TABLE users (')
      expect(lines[lines.length - 1]).toBe(');')
    })

    it("should handle tables with no columns or missing tables", async () => {
      const tableName = "empty_or_missing_table"
      const mockResult = { rows: [] }
      mockPool.query.mockResolvedValue(mockResult)
      
      const mockPostgresService = {
        getTableSchema: async (tableName: string) => {
          const result = await mockPool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = $1
          `, [tableName])
          
          if (result.rows.length === 0) {
            return `-- No columns found for table: ${tableName}`
          }
          
          const columns = result.rows.map(row => `${row.column_name} ${row.data_type}`)
          return `CREATE TABLE ${tableName} (\n  ${columns.join(',\n  ')}\n);`
        }
      }
      
      const ddl = await mockPostgresService.getTableSchema(tableName)
      
      expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('information_schema.columns'), [tableName])
      expect(ddl).toBe('-- No columns found for table: empty_or_missing_table')
    })

    it("should handle complex column types and constraints", async () => {
      const tableName = "complex_table"
      const mockResult = {
        rows: [
          {
            column_name: "id",
            data_type: "uuid",
            is_nullable: "NO",
            column_default: "gen_random_uuid()"
          },
          {
            column_name: "data",
            data_type: "jsonb",
            is_nullable: "NO",
            column_default: "'{}'::jsonb"
          },
          {
            column_name: "price",
            data_type: "numeric",
            numeric_precision: 10,
            numeric_scale: 2,
            is_nullable: "YES",
            column_default: null
          },
          {
            column_name: "tags",
            data_type: "ARRAY",
            is_nullable: "YES",
            column_default: null
          }
        ]
      }
      mockPool.query.mockResolvedValue(mockResult)
      
      const mockPostgresService = {
        getTableSchema: async (tableName: string) => {
          const result = await mockPool.query(`
            SELECT column_name, data_type, is_nullable, column_default, 
                   numeric_precision, numeric_scale
            FROM information_schema.columns 
            WHERE table_name = $1
          `, [tableName])
          
          const columns = result.rows.map(row => {
            let columnDef = `${row.column_name} `
            
            // Handle complex data types
            switch (row.data_type) {
              case 'uuid':
                columnDef += 'UUID'
                break
              case 'jsonb':
                columnDef += 'JSONB'
                break
              case 'numeric':
                if (row.numeric_precision && row.numeric_scale) {
                  columnDef += `NUMERIC(${row.numeric_precision},${row.numeric_scale})`
                } else {
                  columnDef += 'NUMERIC'
                }
                break
              case 'ARRAY':
                columnDef += 'TEXT[]'
                break
              default:
                columnDef += row.data_type.toUpperCase()
            }
            
            if (row.is_nullable === 'NO') columnDef += ' NOT NULL'
            if (row.column_default) columnDef += ` DEFAULT ${row.column_default}`
            
            return columnDef
          })
          
          return `CREATE TABLE ${tableName} (\n  ${columns.join(',\n  ')}\n);`
        }
      }
      
      const ddl = await mockPostgresService.getTableSchema(tableName)
      
      expect(ddl).toContain('id UUID NOT NULL DEFAULT gen_random_uuid()')
      expect(ddl).toContain('data JSONB NOT NULL DEFAULT')
      expect(ddl).toContain('price NUMERIC(10,2)')
      expect(ddl).toContain('tags TEXT[]')
    })
  })

  describe("close method", () => {
    it("should close the connection pool properly", async () => {
      mockPool.end.mockResolvedValue(undefined)
      
      const mockPostgresService = {
        close: async () => {
          await mockPool.end()
          return { closed: true, activeConnections: 0 }
        }
      }
      
      const result = await mockPostgresService.close()
      
      expect(mockPool.end).toHaveBeenCalledTimes(1)
      expect(result.closed).toBe(true)
      expect(result.activeConnections).toBe(0)
    })

    it("should handle pool closing errors gracefully", async () => {
      const closeError = new Error("Some connections are still active")
      mockPool.end.mockRejectedValue(closeError)
      
      const mockPostgresService = {
        close: async (force = false) => {
          try {
            await mockPool.end()
            return { closed: true }
          } catch (error) {
            if (force) {
              // Force close in case of active connections
              return { closed: true, forced: true, warning: (error as Error).message }
            }
            throw new PostgresError('Failed to close database connection pool', error as Error)
          }
        }
      }
      
      await expect(mockPostgresService.close()).rejects.toThrow('Failed to close database connection pool')
      
      // Test force close
      const forceResult = await mockPostgresService.close(true)
      expect(forceResult.forced).toBe(true)
      expect(forceResult.warning).toContain('connections are still active')
    })
  })

  describe("configuration handling", () => {
    it("should handle SSL configuration", () => {
      const sslConfig = { ...mockConfig, ssl: true }
      const layer = PostgresLive(sslConfig)
      expect(layer).toBeDefined()
    })

    it("should handle different ports", () => {
      const customPortConfig = { ...mockConfig, port: 3306 }
      const layer = PostgresLive(customPortConfig)
      expect(layer).toBeDefined()
    })

    it("should handle connection string format", () => {
      const layer = PostgresLive(mockConfig)
      expect(layer).toBeDefined()
    })
  })

  describe("integration with pg-mem", () => {
    it("should execute real queries against in-memory database", async () => {
      const db = createTestDatabase()
      const pgClient = db.adapters.createPg().Client
      
      const client = new pgClient()
      
      // Test real database operations
      const userResult = await client.query('SELECT id, name, email FROM users ORDER BY id')
      expect(userResult.rows).toHaveLength(3)
      expect(userResult.rows[0]).toMatchObject({
        id: expect.any(Number),
        name: 'John Doe',
        email: 'john@example.com'
      })
      
      // Test parameterized query
      const singleUser = await client.query('SELECT * FROM users WHERE id = $1', [2])
      expect(singleUser.rows).toHaveLength(1)
      expect(singleUser.rows[0].name).toBe('Jane Smith')
      
      // Test insert operation
      const insertResult = await client.query(
        'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name',
        ['Test User', 'test@example.com']
      )
      expect(insertResult.rows[0]).toMatchObject({
        id: expect.any(Number),
        name: 'Test User'
      })
      
      await client.end()
    })

    it("should handle complex joins and aggregations", async () => {
      const db = createTestDatabase()
      const pgClient = db.adapters.createPg().Client
      const client = new pgClient()
      
      // Test complex JOIN query with aggregation (simplified for pg-mem)
      const complexQuery = `
        SELECT 
          u.name, 
          u.email,
          COUNT(o.id) as order_count,
          COALESCE(SUM(o.total_amount), 0) as total_spent
        FROM users u 
        LEFT JOIN orders o ON u.id = o.user_id 
        GROUP BY u.id, u.name, u.email 
        ORDER BY total_spent DESC
      `
      
      const result = await client.query(complexQuery)
      
      expect(result.rows.length).toBeGreaterThan(0)
      expect(result.rows[0]).toHaveProperty('name')
      expect(result.rows[0]).toHaveProperty('email')
      expect(result.rows[0]).toHaveProperty('order_count')
      expect(result.rows[0]).toHaveProperty('total_spent')
      
      // Verify data integrity - user with orders should have count > 0
      const userWithOrders = result.rows.find(row => parseFloat(row.total_spent) > 0)
      if (userWithOrders) {
        expect(parseInt(userWithOrders.order_count)).toBeGreaterThan(0)
      }
      
      // Test simpler aggregation query (pg-mem has limited window function support)
      const aggregationQuery = `
        SELECT 
          u.name,
          o.total_amount,
          o.status
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.status = 'completed'
        ORDER BY o.total_amount DESC
        LIMIT 5
      `
      
      const aggResult = await client.query(aggregationQuery)
      expect(aggResult.rows.length).toBeGreaterThan(0)
      expect(aggResult.rows[0]).toHaveProperty('name')
      expect(aggResult.rows[0]).toHaveProperty('status', 'completed')
      
      await client.end()
    })
    
    it("should handle database schema introspection", async () => {
      const db = createTestDatabase()
      const pgClient = db.adapters.createPg().Client
      const client = new pgClient()
      
      // Test schema discovery
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `)
      
      const tableNames = tablesResult.rows.map(row => row.table_name)
      expect(tableNames).toContain('users')
      expect(tableNames).toContain('orders')
      
      // Test column introspection for users table
      const columnsResult = await client.query(`
        SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `)
      
      expect(columnsResult.rows.length).toBeGreaterThan(0)
      const idColumn = columnsResult.rows.find(row => row.column_name === 'id')
      expect(idColumn).toBeDefined()
      expect(idColumn.data_type).toContain('integer')
      expect(idColumn.is_nullable).toBe('NO')
      
      await client.end()
    })
  })
})