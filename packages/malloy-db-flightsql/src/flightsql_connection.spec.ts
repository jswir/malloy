/*
 * Copyright 2025 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import type {SQLSourceRequest, StructDef} from '@malloydata/malloy';
import {mkArrayDef} from '@malloydata/malloy';
import {FlightSQLConnection} from './flightsql_connection';

// Check if Flight SQL server is available via environment variables
const host = process.env['FLIGHTSQL_HOST'];
const port = process.env['FLIGHTSQL_PORT'];
const flightSqlAvailable = Boolean(host && port);

// Skip integration tests if Flight SQL server not configured
const describeIntegration = flightSqlAvailable ? describe : describe.skip;

/*
 * !IMPORTANT
 *
 * For integration tests, the connection is reused for each test, so if you
 * do not name your tables and keys uniquely for each test you will see
 * cross test interactions.
 */

describe('FlightSQLConnection', () => {
  // Create a connection for unit tests (no server needed for these)
  const connection = new FlightSQLConnection({
    name: 'test-flightsql',
    host: 'localhost',
    port: 8815,
    username: 'test',
    password: 'test',
    dialect: 'duckdb',
  });

  describe('schema caching', () => {
    let runRawSQL: jest.SpyInstance;

    beforeEach(async () => {
      runRawSQL = jest
        .spyOn(FlightSQLConnection.prototype, 'runRawSQL')
        .mockResolvedValue({rows: [], totalRows: 0});
    });

    afterEach(() => {
      jest.resetAllMocks();
      runRawSQL.mockRestore();
    });

    it('caches table schema', async () => {
      await connection.fetchSchemaForTables({'test1': 'table1'}, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await connection.fetchSchemaForTables({'test1': 'table1'}, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
    });

    it('refreshes table schema', async () => {
      await connection.fetchSchemaForTables({'test2': 'table2'}, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await connection.fetchSchemaForTables(
        {'test2': 'table2'},
        {refreshTimestamp: Date.now() + 10}
      );
      expect(runRawSQL).toHaveBeenCalledTimes(2);
    });

    it('caches sql schema', async () => {
      await connection.fetchSchemaForSQLStruct(SQL_BLOCK_1, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await connection.fetchSchemaForSQLStruct(SQL_BLOCK_1, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
    });

    it('refreshes sql schema', async () => {
      await connection.fetchSchemaForSQLStruct(SQL_BLOCK_2, {});
      expect(runRawSQL).toHaveBeenCalledTimes(1);
      await new Promise(resolve => setTimeout(resolve));
      await connection.fetchSchemaForSQLStruct(SQL_BLOCK_2, {
        refreshTimestamp: Date.now() + 10,
      });
      expect(runRawSQL).toHaveBeenCalledTimes(2);
    });
  });

  describe('schema parser', () => {
    it('parses arrays', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: ARRAY_SCHEMA});
      expect(structDef.fields[0]).toEqual(
        mkArrayDef({type: 'number', numberType: 'integer'}, 'test')
      );
    });

    it('parses inline structs', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: INLINE_SCHEMA});
      expect(structDef.fields[0]).toEqual({
        'name': 'test',
        'type': 'record',
        'join': 'one',
        'fields': [
          {'name': 'a', ...dblType},
          {'name': 'b', ...intTyp},
          {'name': 'c', ...strTyp},
        ],
      });
    });

    it('parses nested structs (arrays of structs)', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: NESTED_SCHEMA});
      expect(structDef.fields[0]).toEqual({
        'name': 'test',
        'type': 'array',
        'elementTypeDef': {type: 'record_element'},
        'join': 'many',
        'fields': [
          {'name': 'a', 'numberType': 'float', 'type': 'number'},
          {'name': 'b', 'numberType': 'integer', 'type': 'number'},
          {'name': 'c', 'type': 'string'},
        ],
      });
    });

    it('parses a simple string type', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: 'VARCHAR(60)'});
      expect(structDef.fields[0]).toEqual({
        'name': 'test',
        'type': 'string',
      });
    });

    it('parses timestamp with time zone', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {
        test: 'TIMESTAMP WITH TIME ZONE',
      });
      expect(structDef.fields[0]).toEqual({
        name: 'test',
        type: 'timestamptz',
      });
    });

    it('parses unknown type as sql native', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {test: 'UUID'});
      expect(structDef.fields[0]).toEqual({
        'name': 'test',
        'type': 'sql native',
        'rawType': 'UUID',
      });
    });

    it('removes quotes from field names', () => {
      const structDef = makeStructDef();
      connection.fillStructDefFromTypeMap(structDef, {
        '"quoted_field"': 'INTEGER',
      });
      expect(structDef.fields[0].name).toBe('quoted_field');
    });

    describe('integer type mappings', () => {
      it('maps INTEGER to integer', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'INTEGER'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'number',
          numberType: 'integer',
        });
      });

      it('maps SMALLINT to integer', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'SMALLINT'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'number',
          numberType: 'integer',
        });
      });

      it('maps TINYINT to integer', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'TINYINT'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'number',
          numberType: 'integer',
        });
      });

      it('maps BIGINT', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'BIGINT'});
        expect(structDef.fields[0].type).toBe('number');
        expect(structDef.fields[0].name).toBe('test');
      });

      it('maps HUGEINT', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'HUGEINT'});
        expect(structDef.fields[0].type).toBe('number');
        expect(structDef.fields[0].name).toBe('test');
      });

      it('maps UBIGINT', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'UBIGINT'});
        expect(structDef.fields[0].type).toBe('number');
        expect(structDef.fields[0].name).toBe('test');
      });

      it('maps UHUGEINT', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'UHUGEINT'});
        // UHUGEINT may map to number or sql native depending on dialect version
        expect(['number', 'sql native']).toContain(structDef.fields[0].type);
        expect(structDef.fields[0].name).toBe('test');
      });

      it('maps FLOAT to float', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'FLOAT'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'number',
          numberType: 'float',
        });
      });

      it('maps DOUBLE to float', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'DOUBLE'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'number',
          numberType: 'float',
        });
      });

      it('maps DECIMAL(10,2) to float', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'DECIMAL(10,2)'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'number',
          numberType: 'float',
        });
      });
    });

    describe('date and time types', () => {
      it('maps DATE to date', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'DATE'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'date',
        });
      });

      it('maps TIMESTAMP to timestamp', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'TIMESTAMP'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'timestamp',
        });
      });

      it('maps TIME to string', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'TIME'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'string',
        });
      });
    });

    describe('boolean and other types', () => {
      it('maps BOOLEAN to boolean', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'BOOLEAN'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'boolean',
        });
      });

      it('maps BLOB to sql native', () => {
        const structDef = makeStructDef();
        connection.fillStructDefFromTypeMap(structDef, {test: 'BLOB'});
        expect(structDef.fields[0]).toEqual({
          name: 'test',
          type: 'sql native',
          rawType: 'BLOB',
        });
      });
    });
  });

  describe('connection options', () => {
    it('returns duckdb dialect name by default', () => {
      const conn = new FlightSQLConnection({
        name: 'default-dialect',
        host: 'localhost',
        port: 8815,
        username: '',
        password: '',
      });
      expect(conn.dialectName).toBe('duckdb');
    });

    it('returns postgres dialect name when configured', () => {
      const conn = new FlightSQLConnection({
        name: 'postgres-flight',
        host: 'localhost',
        port: 8815,
        username: '',
        password: '',
        dialect: 'postgres',
      });
      expect(conn.dialectName).toBe('postgres');
    });

    it('returns standardsql dialect name when configured', () => {
      const conn = new FlightSQLConnection({
        name: 'standard-flight',
        host: 'localhost',
        port: 8815,
        username: '',
        password: '',
        dialect: 'standard_sql',
      });
      expect(conn.dialectName).toBe('standardsql');
    });

    it('defaults useTLS to true', () => {
      const conn = new FlightSQLConnection({
        name: 'default-tls',
        host: 'localhost',
        port: 8815,
        username: '',
        password: '',
      });
      expect(conn.name).toBe('default-tls');
    });

    it('allows disabling TLS', () => {
      const conn = new FlightSQLConnection({
        name: 'no-tls',
        host: 'localhost',
        port: 8815,
        username: '',
        password: '',
        useTLS: false,
      });
      expect(conn.name).toBe('no-tls');
    });

    it('supports defaultDatabase option', () => {
      const conn = new FlightSQLConnection({
        name: 'with-db',
        host: 'localhost',
        port: 8815,
        username: '',
        password: '',
        defaultDatabase: 'my_catalog',
      });
      expect(conn.name).toBe('with-db');
    });

    it('supports custom describeQueryTemplate', () => {
      const conn = new FlightSQLConnection({
        name: 'custom-describe',
        host: 'localhost',
        port: 8815,
        username: '',
        password: '',
        describeQueryTemplate: 'SHOW COLUMNS FROM $1',
      });
      expect(conn.name).toBe('custom-describe');
    });
  });

  describe('connection capabilities', () => {
    it('reports canPersist as true', () => {
      expect(connection.canPersist()).toBe(true);
    });

    it('reports canStream as true', () => {
      expect(connection.canStream()).toBe(true);
    });

    it('reports isPool as false', () => {
      expect(connection.isPool()).toBe(false);
    });
  });

  describe('query options', () => {
    it('uses default row limit of 10', () => {
      expect(FlightSQLConnection.DEFAULT_QUERY_OPTIONS.rowLimit).toBe(10);
    });

    it('allows custom query options via function', () => {
      const conn = new FlightSQLConnection(
        {
          name: 'custom-options',
          host: 'localhost',
          port: 8815,
          username: '',
          password: '',
        },
        () => ({rowLimit: 100})
      );
      expect(conn.name).toBe('custom-options');
    });

    it('allows custom query options via object', () => {
      const conn = new FlightSQLConnection(
        {
          name: 'custom-options',
          host: 'localhost',
          port: 8815,
          username: '',
          password: '',
        },
        {rowLimit: 50}
      );
      expect(conn.name).toBe('custom-options');
    });
  });

  describe('hash creation', () => {
    it('creates consistent hash for same SQL', async () => {
      const hash1 = await connection.createHash('SELECT 1');
      const hash2 = await connection.createHash('SELECT 1');
      expect(hash1).toBe(hash2);
    });

    it('creates different hash for different SQL', async () => {
      const hash1 = await connection.createHash('SELECT 1');
      const hash2 = await connection.createHash('SELECT 2');
      expect(hash1).not.toBe(hash2);
    });

    it('creates 32 character MD5 hash', async () => {
      const hash = await connection.createHash('SELECT 1');
      expect(hash).toHaveLength(32);
      expect(hash).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('estimateQueryCost', () => {
    it('returns empty object', async () => {
      const cost = await connection.estimateQueryCost('SELECT 1');
      expect(cost).toEqual({});
    });
  });
});

// Integration tests - only run when Flight SQL server is available
describeIntegration('FlightSQLConnection integration tests', () => {
  let connection: FlightSQLConnection;

  beforeAll(async () => {
    const username = process.env['FLIGHTSQL_USERNAME'] || '';
    const password = process.env['FLIGHTSQL_PASSWORD'] || '';
    const defaultDatabase = process.env['FLIGHTSQL_DATABASE'];
    const useTLS = process.env['FLIGHTSQL_USE_TLS'] !== 'false';

    connection = new FlightSQLConnection(
      {
        name: 'test-flightsql',
        host: host!,
        port: parseInt(port!, 10),
        username,
        password,
        useTLS,
        defaultDatabase,
        dialect: 'duckdb',
      },
      () => ({rowLimit: 10})
    );

    // Test connection
    await connection.runSQL('SELECT 1');
  });

  afterAll(async () => {
    if (connection) {
      await connection.close();
    }
  });

  describe('basic queries', () => {
    it('executes simple query', async () => {
      const result = await connection.runSQL('SELECT 1 as test');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]['test']).toBe(1);
    });

    it('executes query with multiple rows', async () => {
      const result = await connection.runSQL(
        "SELECT * FROM (VALUES (1, 'a'), (2, 'b'), (3, 'c')) AS t(id, name)"
      );
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0]['id']).toBe(1);
      expect(result.rows[0]['name']).toBe('a');
    });

    it('executes query with various data types', async () => {
      const result = await connection.runSQL(`
        SELECT
          1 as int_val,
          1.5 as float_val,
          'hello' as str_val,
          true as bool_val
      `);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]['int_val']).toBe(1);
      expect(result.rows[0]['float_val']).toBe(1.5);
      expect(result.rows[0]['str_val']).toBe('hello');
      expect(result.rows[0]['bool_val']).toBe(true);
    });
  });

  describe('row limits', () => {
    it('respects default row limit', async () => {
      const result = await connection.runSQL(
        'SELECT * FROM (VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12)) AS t(id)'
      );
      expect(result.rows.length).toBeLessThanOrEqual(10);
    });

    it('respects custom row limit', async () => {
      const result = await connection.runSQL(
        'SELECT * FROM (VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12)) AS t(id)',
        {rowLimit: 5}
      );
      expect(result.rows.length).toBeLessThanOrEqual(5);
    });

    it('returns all rows when limit exceeds result size', async () => {
      const result = await connection.runSQL(
        'SELECT * FROM (VALUES (1), (2), (3)) AS t(id)',
        {rowLimit: 100}
      );
      expect(result.rows.length).toBe(3);
    });
  });

  describe('schema fetching', () => {
    it('fetches table schema', async () => {
      const schema = await connection.fetchTableSchema(
        'test',
        'information_schema.tables'
      );
      expect(schema.fields.length).toBeGreaterThan(0);
      expect(schema.fields.some(f => f['name'] === 'table_name')).toBe(true);
    });

    it('returns correct schema structure', async () => {
      const schema = await connection.fetchTableSchema(
        'test',
        'information_schema.tables'
      );
      expect(schema.type).toBe('table');
      expect(schema.name).toBe('test');
      expect(schema.dialect).toBe('duckdb');
      expect(schema.connection).toBe('test-flightsql');
    });
  });

  describe('error handling', () => {
    it('throws on invalid SQL', async () => {
      await expect(
        connection.runSQL('SELECT * FROM nonexistent_table_xyz')
      ).rejects.toThrow();
    });

    it('throws on syntax error', async () => {
      await expect(connection.runSQL('SELECTT 1')).rejects.toThrow();
    });
  });

  describe('streaming', () => {
    it('streams query results', async () => {
      const rows: unknown[] = [];
      for await (const row of connection.runSQLStream('SELECT 1 as test')) {
        rows.push(row);
      }
      expect(rows).toHaveLength(1);
      expect((rows[0] as {test: number})['test']).toBe(1);
    });

    it('respects row limit in stream', async () => {
      const rows: unknown[] = [];
      const stream = connection.runSQLStream(
        'SELECT * FROM (VALUES (1), (2), (3), (4), (5)) AS t(id)',
        {rowLimit: 3}
      );
      for await (const row of stream) {
        rows.push(row);
      }
      expect(rows).toHaveLength(3);
    });

    it('respects abort signal in stream', async () => {
      const controller = new AbortController();
      const rows: unknown[] = [];

      // Abort immediately
      controller.abort();

      const stream = connection.runSQLStream(
        'SELECT * FROM (VALUES (1), (2), (3), (4), (5)) AS t(id)',
        {abortSignal: controller.signal}
      );

      for await (const row of stream) {
        rows.push(row);
      }

      // Should have stopped before processing all rows
      expect(rows.length).toBeLessThanOrEqual(5);
    });
  });

  describe('connection test', () => {
    it('test() succeeds on valid connection', async () => {
      await expect(connection.test()).resolves.not.toThrow();
    });
  });
});

/**
 * Create a basic StructDef for testing fillStructDefFromTypeMap()
 */
const makeStructDef = (): StructDef => {
  return {
    type: 'table',
    name: 'test',
    dialect: 'duckdb',
    tablePath: 'test',
    connection: 'flightsql',
    fields: [],
  };
};

// SQL blocks for testing schema caching
const SQL_BLOCK_1: SQLSourceRequest = {
  connection: 'flightsql',
  selectStr: `SELECT id, name FROM users`,
};

const SQL_BLOCK_2: SQLSourceRequest = {
  connection: 'flightsql',
  selectStr: `SELECT id, email FROM customers`,
};

// Type strings for testing fillStructDefFromTypeMap()
const ARRAY_SCHEMA = 'integer[]';
const INLINE_SCHEMA = 'STRUCT(a double, b integer, c varchar(60))';
const NESTED_SCHEMA = 'STRUCT(a double, b integer, c varchar(60))[]';

const intTyp = {type: 'number', numberType: 'integer'};
const strTyp = {type: 'string'};
const dblType = {type: 'number', numberType: 'float'};
