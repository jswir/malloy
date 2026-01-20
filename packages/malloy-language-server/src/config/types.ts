/*
 * Copyright 2023 Google LLC
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

/**
 * Configuration for a DuckDB connection.
 */
export interface DuckDBConfig {
  /** Path to DuckDB database file or ":memory:" for in-memory database */
  databasePath?: string;
  /** Working directory for relative paths */
  workingDirectory?: string;
  /** Additional DuckDB extensions to load */
  additionalExtensions?: string[];
  /** MotherDuck authentication token */
  motherDuckToken?: string;
}

/**
 * Configuration for a Publisher connection (Credible-managed).
 */
export interface PublisherConfig {
  /** Connection type identifier */
  type: 'publisher';
  /** Full URI to the connection endpoint */
  connectionUri: string;
  /** Access token for authentication */
  accessToken: string;
}

/**
 * Named connection configuration.
 * Can be either a Publisher connection or other types in the future.
 */
export type NamedConnectionConfig = PublisherConfig;

/**
 * Connection configurations - supports both legacy and named formats.
 *
 * Legacy format (for DuckDB):
 * ```json
 * { "connections": { "duckdb": { "databasePath": ":memory:" } } }
 * ```
 *
 * Named format (from cred export-connections):
 * ```json
 * { "connections": { "my_conn": { "type": "publisher", "connectionUri": "...", "accessToken": "..." } } }
 * ```
 */
export interface ConnectionsConfig {
  /** Legacy DuckDB configuration */
  duckdb?: DuckDBConfig;
  /** Named connections (Publisher, etc.) - any key that's not 'duckdb' */
  [connectionName: string]: DuckDBConfig | NamedConnectionConfig | undefined;
}

/**
 * Root configuration structure for malloy-config.json.
 */
export interface MalloyConfig {
  /** Connection configurations */
  connections?: ConnectionsConfig;
}

/**
 * Check if a connection config is a Publisher connection.
 */
export function isPublisherConfig(
  config: DuckDBConfig | NamedConnectionConfig | undefined
): config is PublisherConfig {
  return (
    config !== undefined &&
    'type' in config &&
    config.type === 'publisher' &&
    'connectionUri' in config
  );
}

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: MalloyConfig = {
  connections: {
    duckdb: {
      databasePath: ':memory:',
      workingDirectory: '.',
    },
  },
};
