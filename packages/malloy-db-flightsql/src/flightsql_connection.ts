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

import * as crypto from 'crypto';
import type {
  MalloyQueryData,
  PersistSQLResults,
  PooledConnection,
  QueryDataRow,
  QueryOptionsReader,
  QueryRunStats,
  RunSQLOptions,
  SQLSourceDef,
  SQLSourceRequest,
  StreamingConnection,
  StructDef,
  TableSourceDef,
  TestableConnection,
} from '@malloydata/malloy';
import {DuckDBDialect, mkFieldDef, sqlKey} from '@malloydata/malloy';
import {BaseConnection} from '@malloydata/malloy/connection';
import {Client} from '@lancedb/arrow-flight-sql-client';

/**
 * SQL dialect used by the Flight SQL server.
 * - 'duckdb': DuckDB dialect (GizmoSQL, DuckDB Flight SQL)
 * - 'postgres': PostgreSQL dialect
 * - 'standard_sql': Standard SQL (for other servers)
 */
export type FlightSQLDialect = 'duckdb' | 'postgres' | 'standard_sql';

export interface FlightSQLConnectionOptions {
  /** Connection name */
  name: string;
  /** Host address of the Flight SQL server */
  host: string;
  /** Port number of the Flight SQL server */
  port: number;
  /** Username for authentication */
  username: string;
  /** Password for authentication */
  password: string;
  /** Use TLS encryption (default: true) */
  useTLS?: boolean;
  /** SQL dialect used by the server (default: 'duckdb') */
  dialect?: FlightSQLDialect;
  /** Default database/catalog to use (for GizmoSQL, this sets the catalog context) */
  defaultDatabase?: string;
  /** Custom DESCRIBE query template (use $1 for table/query placeholder) */
  describeQueryTemplate?: string;
}

interface FlightSQLQueryOptions {
  rowLimit: number;
}

const unquoteName = (name: string) => {
  const match = /^"(.*)"$/.exec(name);
  if (match) {
    return match[1].replace('""', '"');
  }
  return name;
};

export class FlightSQLConnection
  extends BaseConnection
  implements TestableConnection, PersistSQLResults, StreamingConnection
{
  public readonly name: string;

  private host: string;
  private port: number;
  private username: string;
  private password: string;
  private useTLS: boolean;
  private flightDialect: FlightSQLDialect;
  private defaultDatabase?: string;
  private describeQueryTemplate?: string;

  private client: Client | null = null;
  private isSetup: Promise<void> | undefined;
  private setupError: Error | undefined;

  private readonly dialect = new DuckDBDialect();
  private queryOptions?: QueryOptionsReader;

  static DEFAULT_QUERY_OPTIONS: FlightSQLQueryOptions = {
    rowLimit: 10,
  };

  constructor(
    options: FlightSQLConnectionOptions,
    queryOptions?: QueryOptionsReader
  ) {
    super();
    this.name = options.name;
    this.host = options.host;
    this.port = options.port;
    this.username = options.username;
    this.password = options.password;
    this.useTLS = options.useTLS ?? true;
    this.flightDialect = options.dialect ?? 'duckdb';
    this.defaultDatabase = options.defaultDatabase;
    this.describeQueryTemplate = options.describeQueryTemplate;
    this.queryOptions = queryOptions;
  }

  get dialectName(): string {
    // Return the dialect name based on the configured Flight SQL dialect
    switch (this.flightDialect) {
      case 'duckdb':
        return 'duckdb';
      case 'postgres':
        return 'postgres';
      case 'standard_sql':
        return 'standardsql';
      default:
        return 'duckdb';
    }
  }

  protected readQueryOptions(): FlightSQLQueryOptions {
    const options = FlightSQLConnection.DEFAULT_QUERY_OPTIONS;
    if (this.queryOptions) {
      if (this.queryOptions instanceof Function) {
        return {...options, ...this.queryOptions()};
      } else {
        return {...options, ...this.queryOptions};
      }
    }
    return options;
  }

  public isPool(): this is PooledConnection {
    return false;
  }

  public canPersist(): this is PersistSQLResults {
    return true;
  }

  public canStream(): this is StreamingConnection {
    return true;
  }

  private async getClient(): Promise<Client> {
    if (!this.client) {
      this.client = await Client.connect({
        host: `${this.host}:${this.port}`,
        username: this.username,
        password: this.password,
        insecure: !this.useTLS,
        defaultDatabase: this.defaultDatabase,
      });
    }
    return this.client;
  }

  protected async setup(): Promise<void> {
    if (this.setupError) {
      throw this.setupError;
    }

    const doSetup = async () => {
      try {
        await this.getClient();
      } catch (error) {
        this.setupError = error as Error;
        throw error;
      }
    };

    if (!this.isSetup) {
      this.isSetup = doSetup();
    }
    await this.isSetup;
  }

  /**
   * Execute a query and return rows.
   */
  protected async runFlightQuery(
    sql: string
  ): Promise<{rows: QueryDataRow[]; totalRows: number}> {
    const client = await this.getClient();

    try {
      // Execute the query using Flight SQL
      const result = await client.query(sql);

      // Get results as plain JS objects
      const rows = (await result.collectToObjects()) as QueryDataRow[];

      return {rows, totalRows: rows.length};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Flight SQL query failed: ${message}`);
    }
  }

  public async runRawSQL(
    sql: string
  ): Promise<{rows: QueryDataRow[]; totalRows: number}> {
    await this.setup();
    return this.runFlightQuery(sql);
  }

  public async runSQL(
    sql: string,
    options: RunSQLOptions = {}
  ): Promise<MalloyQueryData> {
    const defaultOptions = this.readQueryOptions();
    const rowLimit = options.rowLimit ?? defaultOptions.rowLimit;

    const statements = sql.split('-- hack: split on this');

    while (statements.length > 1) {
      await this.runRawSQL(statements[0]);
      statements.shift();
    }

    const retVal = await this.runRawSQL(statements[0]);
    let result = retVal.rows;
    if (result.length > rowLimit) {
      result = result.slice(0, rowLimit);
    }
    return {rows: result, totalRows: result.length};
  }

  public async *runSQLStream(
    sql: string,
    {rowLimit, abortSignal}: RunSQLOptions = {}
  ): AsyncIterableIterator<QueryDataRow> {
    const defaultOptions = this.readQueryOptions();
    rowLimit ??= defaultOptions.rowLimit;
    await this.setup();

    const statements = sql.split('-- hack: split on this');

    while (statements.length > 1) {
      await this.runFlightQuery(statements[0]);
      statements.shift();
    }

    const result = await this.runFlightQuery(statements[0]);
    let index = 0;

    for (const row of result.rows) {
      if (
        (rowLimit !== undefined && index >= rowLimit) ||
        abortSignal?.aborted
      ) {
        break;
      }
      index++;
      yield row;
    }
  }

  async fetchSelectSchema(
    sqlRef: SQLSourceRequest
  ): Promise<SQLSourceDef | string> {
    const sqlDef: SQLSourceDef = {
      type: 'sql_select',
      ...sqlRef,
      dialect: this.dialectName,
      fields: [],
      name: sqlKey(sqlRef.connection, sqlRef.selectStr),
    };

    const describeQuery =
      this.describeQueryTemplate?.replace('$1', `(${sqlRef.selectStr})`) ??
      `DESCRIBE SELECT * FROM (${sqlRef.selectStr})`;

    await this.schemaFromQuery(describeQuery, sqlDef);
    return sqlDef;
  }

  fillStructDefFromTypeMap(
    structDef: StructDef,
    typeMap: {[name: string]: string}
  ) {
    for (const fieldName in typeMap) {
      // Remove quotes from field name
      const name = unquoteName(fieldName);
      const dbType = typeMap[fieldName];
      const malloyType = this.dialect.parseDuckDBType(dbType);
      structDef.fields.push(mkFieldDef(malloyType, name));
    }
  }

  private async schemaFromQuery(
    infoQuery: string,
    structDef: StructDef
  ): Promise<void> {
    const typeMap: {[key: string]: string} = {};

    const result = await this.runRawSQL(infoQuery);
    for (const row of result.rows) {
      typeMap[row['column_name'] as string] = row['column_type'] as string;
    }
    this.fillStructDefFromTypeMap(structDef, typeMap);
  }

  async fetchTableSchema(
    tableKey: string,
    tablePath: string
  ): Promise<TableSourceDef> {
    const structDef: TableSourceDef = {
      type: 'table',
      name: tableKey,
      dialect: this.dialectName,
      tablePath,
      connection: this.name,
      fields: [],
    };

    const quotedTablePath = tablePath.match(/[:*/]/)
      ? `'${tablePath}'`
      : tablePath;

    const infoQuery =
      this.describeQueryTemplate?.replace('$1', quotedTablePath) ??
      `DESCRIBE SELECT * FROM ${quotedTablePath}`;

    await this.schemaFromQuery(infoQuery, structDef);
    return structDef;
  }

  public async test(): Promise<void> {
    await this.runRawSQL('SELECT 1');
  }

  public async estimateQueryCost(_: string): Promise<QueryRunStats> {
    return {};
  }

  async createHash(sqlCommand: string): Promise<string> {
    return crypto.createHash('md5').update(sqlCommand).digest('hex');
  }

  public async manifestTemporaryTable(sqlCommand: string): Promise<string> {
    const hash = await this.createHash(sqlCommand);
    const tableName = `tt${hash}`;

    const cmd = `CREATE TEMPORARY TABLE IF NOT EXISTS ${tableName} AS (${sqlCommand});`;
    await this.runRawSQL(cmd);
    return tableName;
  }

  public async close(): Promise<void> {
    // The @lancedb/arrow-flight-sql-client Client doesn't have a close method
    // Just null out our reference
    this.client = null;
  }
}
