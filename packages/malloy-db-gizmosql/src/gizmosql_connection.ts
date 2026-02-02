/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
import {Type} from 'apache-arrow';
import type {Schema, Field, DataType, StructRow} from 'apache-arrow';

// ----------------------------------------------------------------------------
// Arrow value unwrapping functions (adapted from DuckDB WASM)
// These convert Arrow values to vanilla JS using schema type information.
// ----------------------------------------------------------------------------

/**
 * Convert an Arrow value to vanilla JS using the Arrow DataType.
 */
function unwrapValue(value: unknown, fieldType: DataType): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children = (fieldType as any).children as Field[] | null;

  switch (fieldType.typeId) {
    case Type.Decimal:
      return unwrapDecimal(value, fieldType);

    case Type.Date:
    case Type.Timestamp:
      if (typeof value === 'number') {
        return new Date(value);
      }
      if (value instanceof Date) {
        return value;
      }
      return unwrapPrimitive(value);

    case Type.List:
    case Type.FixedSizeList:
      if (children && children.length > 0) {
        return unwrapArray(value, children[0].type);
      }
      return unwrapPrimitive(value);

    case Type.Struct:
      if (children && children.length > 0) {
        return unwrapStruct(value, children);
      }
      return unwrapPrimitive(value);

    case Type.Map:
      if (children && children.length > 0) {
        return unwrapArray(value, children[0].type);
      }
      return unwrapPrimitive(value);

    default:
      return unwrapPrimitive(value);
  }
}

function unwrapDecimal(value: unknown, fieldType: DataType): number | string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scale = (fieldType as any).scale ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = value as any;

  if (!obj || !obj[Symbol.toPrimitive]) {
    return value as number;
  }

  const raw = obj[Symbol.toPrimitive]();

  if (typeof raw === 'bigint') {
    const absRaw = raw < BigInt(0) ? -raw : raw;
    if (absRaw > BigInt(Number.MAX_SAFE_INTEGER)) {
      return formatBigDecimal(raw, scale);
    }
    if (scale > 0) {
      return Number(raw) / 10 ** scale;
    }
    return Number(raw);
  }

  if (typeof raw === 'string') {
    const absStr = raw.startsWith('-') ? raw.slice(1) : raw;
    if (absStr.length > 15) {
      return formatBigDecimalFromString(raw, scale);
    }
  }

  const num = Number(raw);
  return scale > 0 ? num / 10 ** scale : num;
}

function unwrapArray(value: unknown, elementType: DataType): unknown[] {
  const arr = Array.isArray(value) ? value : [...(value as Iterable<unknown>)];
  return arr.map(v => unwrapValue(v, elementType));
}

function unwrapStruct(
  value: unknown,
  children: Field[]
): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = value as any;
  const result: Record<string, unknown> = {};
  for (const field of children) {
    result[field.name] = unwrapValue(obj[field.name], field.type);
  }
  return result;
}

function unwrapPrimitive(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (typeof value === 'bigint') return safeNumber(value);
  if (typeof value !== 'object' || value === null) return value;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = value as any;
  if (obj[Symbol.toPrimitive]) {
    return safeNumber(obj[Symbol.toPrimitive]());
  }
  return value;
}

function safeNumber(value: number | bigint | string): number | string {
  if (typeof value === 'number') {
    return value;
  }
  const num = Number(value);
  if (
    Number.isSafeInteger(num) ||
    (Number.isFinite(num) && !Number.isInteger(num))
  ) {
    return num;
  }
  return String(value);
}

function formatBigDecimal(raw: bigint, scale: number): string {
  const isNegative = raw < BigInt(0);
  const str = (isNegative ? -raw : raw).toString();
  return formatDecimalString(str, scale, isNegative);
}

function formatBigDecimalFromString(raw: string, scale: number): string {
  const isNegative = raw.startsWith('-');
  const str = isNegative ? raw.slice(1) : raw;
  return formatDecimalString(str, scale, isNegative);
}

function formatDecimalString(
  str: string,
  scale: number,
  isNegative: boolean
): string {
  let result: string;
  if (scale <= 0) {
    result = str;
  } else if (scale >= str.length) {
    result = '0.' + '0'.repeat(scale - str.length) + str;
  } else {
    result = str.slice(0, -scale) + '.' + str.slice(-scale);
  }
  return isNegative ? '-' + result : result;
}

/**
 * Process a single Arrow result row into a Malloy QueryDataRow.
 */
function unwrapRow(row: StructRow, schema: Schema): QueryDataRow {
  const json = row.toJSON();
  const result: QueryDataRow = {};
  for (const field of schema.fields) {
    result[field.name] = unwrapValue(
      json[field.name],
      field.type
    ) as QueryDataRow[string];
  }
  return result;
}

export interface GizmoSQLConnectionOptions {
  /** Connection name */
  name: string;
  /** Host address of the GizmoSQL server */
  host: string;
  /** Port number of the GizmoSQL server */
  port: number;
  /** Username for authentication (use empty string for unauthenticated servers) */
  username: string;
  /** Password for authentication (use empty string for unauthenticated servers) */
  password: string;
  /** Use TLS encryption (default: true) */
  useTLS?: boolean;
  /** Default database/catalog to use */
  defaultDatabase?: string;
}

interface GizmoSQLQueryOptions {
  rowLimit: number;
}

const unquoteName = (name: string) => {
  const match = /^"(.*)"$/.exec(name);
  if (match) {
    return match[1].replace('""', '"');
  }
  return name;
};

export class GizmoSQLConnection
  extends BaseConnection
  implements TestableConnection, PersistSQLResults, StreamingConnection
{
  public readonly name: string;

  private host: string;
  private port: number;
  private username: string;
  private password: string;
  private useTLS: boolean;
  private defaultDatabase?: string;

  private client: Client | null = null;
  private isSetup: Promise<void> | undefined;
  private setupError: Error | undefined;

  private readonly dialect = new DuckDBDialect();
  private queryOptions?: QueryOptionsReader;

  static DEFAULT_QUERY_OPTIONS: GizmoSQLQueryOptions = {
    rowLimit: 10,
  };

  constructor(
    options: GizmoSQLConnectionOptions,
    queryOptions?: QueryOptionsReader
  ) {
    super();
    this.name = options.name;
    this.host = options.host;
    this.port = options.port;
    this.username = options.username;
    this.password = options.password;
    this.useTLS = options.useTLS ?? true;
    this.defaultDatabase = options.defaultDatabase;
    this.queryOptions = queryOptions;
  }

  get dialectName(): string {
    return 'duckdb';
  }

  protected readQueryOptions(): GizmoSQLQueryOptions {
    const options = GizmoSQLConnection.DEFAULT_QUERY_OPTIONS;
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
  protected async runGizmoQuery(
    sql: string
  ): Promise<{rows: QueryDataRow[]; totalRows: number}> {
    const client = await this.getClient();

    try {
      // Execute the query using Flight SQL
      const result = await client.query(sql);

      // Get Arrow batches and unwrap them with schema-aware processing
      // This properly handles Decimal types with scale
      const batches = await result.collectToArrow();
      const rows: QueryDataRow[] = [];

      for (const batch of batches) {
        for (let i = 0; i < batch.numRows; i++) {
          const row = batch.get(i);
          if (row) {
            rows.push(unwrapRow(row as unknown as StructRow, batch.schema));
          }
        }
      }

      return {rows, totalRows: rows.length};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`GizmoSQL query failed: ${message}`);
    }
  }

  public async runRawSQL(
    sql: string
  ): Promise<{rows: QueryDataRow[]; totalRows: number}> {
    await this.setup();
    return this.runGizmoQuery(sql);
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
      await this.runGizmoQuery(statements[0]);
      statements.shift();
    }

    // Use true streaming via toArrowStream() instead of collecting all results
    const client = await this.getClient();
    const result = await client.query(statements[0]);
    let index = 0;

    // Stream Arrow record batches as they arrive
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const batch of result.toArrowStream() as AsyncIterable<any>) {
      if (abortSignal?.aborted) {
        break;
      }

      for (let i = 0; i < batch.numRows; i++) {
        if (
          (rowLimit !== undefined && index >= rowLimit) ||
          abortSignal?.aborted
        ) {
          return;
        }
        const row = batch.get(i);
        if (row) {
          yield unwrapRow(row as unknown as StructRow, batch.schema);
          index++;
        }
      }
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

    const describeQuery = `DESCRIBE SELECT * FROM (${sqlRef.selectStr})`;

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

    const infoQuery = `DESCRIBE SELECT * FROM ${quotedTablePath}`;

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
