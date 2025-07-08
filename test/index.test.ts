import { beforeEach, describe, expect, it } from "@effect/vitest"
import { createSqlGen, SqlGen, type SqlGenConfig } from "@template/basic/index.js"
import { testConfigs, testDDLs } from "./utils/fixtures.js"

describe("SqlGen", () => {
  let testConfig: SqlGenConfig

  beforeEach(() => {
    testConfig = testConfigs.minimal
  })

  describe("constructor", () => {
    it("should create SqlGen instance with configuration", () => {
      const sqlGen = new SqlGen(testConfig)
      expect(sqlGen).toBeInstanceOf(SqlGen)
    })

    it("should accept different configurations", () => {
      const prodSqlGen = new SqlGen(testConfigs.production)
      const minimalSqlGen = new SqlGen(testConfigs.minimal)

      expect(prodSqlGen).toBeInstanceOf(SqlGen)
      expect(minimalSqlGen).toBeInstanceOf(SqlGen)
    })
  })

  describe("createSqlGen factory", () => {
    it("should create SqlGen instance via factory function", () => {
      const sqlGen = createSqlGen(testConfig)
      expect(sqlGen).toBeInstanceOf(SqlGen)
    })
  })

  describe("ask", () => {
    it("should return an Effect", () => {
      const sqlGen = new SqlGen(testConfig)
      const question = "Show me all users"
      const effect = sqlGen.ask(question)

      expect(typeof effect).toBe("object")
      expect("pipe" in effect).toBe(true)
    })
  })

  describe("train", () => {
    it("should return an Effect", () => {
      const sqlGen = new SqlGen(testConfig)
      const effect = sqlGen.train()

      expect(typeof effect).toBe("object")
      expect("pipe" in effect).toBe(true)
    })
  })

  describe("trainFromDatabase", () => {
    it("should return an Effect", () => {
      const sqlGen = new SqlGen(testConfig)
      const effect = sqlGen.trainFromDatabase()

      expect(typeof effect).toBe("object")
      expect("pipe" in effect).toBe(true)
    })
  })

  describe("trainFromDdl", () => {
    it("should return an Effect", () => {
      const sqlGen = new SqlGen(testConfig)
      const ddl = testDDLs.users
      const effect = sqlGen.trainFromDdl(ddl)

      expect(typeof effect).toBe("object")
      expect("pipe" in effect).toBe(true)
    })

    it("should handle different DDL types", () => {
      const sqlGen = new SqlGen(testConfig)
      const ddls = [testDDLs.users, testDDLs.orders, testDDLs.products]

      ddls.forEach((ddl) => {
        const effect = sqlGen.trainFromDdl(ddl)
        expect(typeof effect).toBe("object")
        expect("pipe" in effect).toBe(true)
      })
    })
  })

  describe("trainFromDdlArray", () => {
    it("should return an Effect", () => {
      const sqlGen = new SqlGen(testConfig)
      const ddls = [testDDLs.users, testDDLs.orders, testDDLs.products]
      const effect = sqlGen.trainFromDdlArray(ddls)

      expect(typeof effect).toBe("object")
      expect("pipe" in effect).toBe(true)
    })

    it("should handle empty arrays", () => {
      const sqlGen = new SqlGen(testConfig)
      const effect = sqlGen.trainFromDdlArray([])

      expect(typeof effect).toBe("object")
      expect("pipe" in effect).toBe(true)
    })
  })

  describe("validateSql", () => {
    it("should return an Effect", () => {
      const sqlGen = new SqlGen(testConfig)
      const sql = "SELECT * FROM users"
      const effect = sqlGen.validateSql(sql)

      expect(typeof effect).toBe("object")
      expect("pipe" in effect).toBe(true)
    })
  })

  describe("explainQuery", () => {
    it("should return an Effect", () => {
      const sqlGen = new SqlGen(testConfig)
      const sql = "SELECT * FROM users"
      const effect = sqlGen.explainQuery(sql)

      expect(typeof effect).toBe("object")
      expect("pipe" in effect).toBe(true)
    })
  })

  describe("layer composition", () => {
    it("should compose all layers correctly", () => {
      const sqlGen = new SqlGen(testConfig)

      // Access the private method for testing
      const layers = (sqlGen as any).allLayers
      expect(layers).toBeDefined()
    })

    it("should handle different configurations", () => {
      const configs = [testConfigs.minimal, testConfigs.production]

      configs.forEach((config) => {
        const sqlGen = new SqlGen(config)
        const layers = (sqlGen as any).allLayers
        expect(layers).toBeDefined()
      })
    })
  })

  describe("configuration validation", () => {
    it("should accept valid configurations", () => {
      expect(() => new SqlGen(testConfigs.minimal)).not.toThrow()
      expect(() => new SqlGen(testConfigs.production)).not.toThrow()
    })

    it("should create instance with custom config", () => {
      const customConfig = {
        ...testConfig,
        pipeline: {
          ...testConfig.pipeline,
          minConfidence: 0.9
        }
      }

      const sqlGen = new SqlGen(customConfig)
      expect(sqlGen).toBeInstanceOf(SqlGen)
    })
  })

  describe("method signatures", () => {
    it("should have correct method signatures", () => {
      const sqlGen = new SqlGen(testConfig)

      expect(typeof sqlGen.ask).toBe("function")
      expect(typeof sqlGen.train).toBe("function")
      expect(typeof sqlGen.trainFromDatabase).toBe("function")
      expect(typeof sqlGen.trainFromDdl).toBe("function")
      expect(typeof sqlGen.trainFromDdlArray).toBe("function")
      expect(typeof sqlGen.validateSql).toBe("function")
      expect(typeof sqlGen.explainQuery).toBe("function")
    })
  })
})
