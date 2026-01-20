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

import type {Connection, LookupConnection} from '@malloydata/malloy';
import {DuckDBConnection} from '@malloydata/db-duckdb';
import {PublisherConnection} from '@malloydata/db-publisher';
import type {MalloyConfig, DuckDBConfig} from './config';
import {isPublisherConfig} from './config';

/**
 * Manages database connections for the language server.
 * Implements LookupConnection to provide connections for schema resolution.
 * Supports DuckDB (local) and Publisher (Credible-managed) connections.
 */
export class ConnectionManager implements LookupConnection<Connection> {
  private connections = new Map<string, Connection>();
  private pendingConnections = new Map<string, Promise<Connection>>();
  private defaultConnectionName: string;

  constructor(
    private config: MalloyConfig,
    private workspaceRoot?: string
  ) {
    // Determine the default connection name
    // If there are Publisher connections, use the first one as default
    // Otherwise, fall back to duckdb
    const connectionNames = this.getConnectionNames();
    const publisherConnections = connectionNames.filter(
      name => name !== 'duckdb'
    );
    this.defaultConnectionName =
      publisherConnections.length > 0 ? publisherConnections[0] : 'duckdb';
  }

  /**
   * Look up a connection by name.
   * If no name is provided, returns the default connection.
   */
  async lookupConnection(connectionName?: string): Promise<Connection> {
    const name = connectionName || this.defaultConnectionName;

    // Check if we already have this connection
    const existing = this.connections.get(name);
    if (existing) {
      return existing;
    }

    // Check if there's a pending connection creation
    const pending = this.pendingConnections.get(name);
    if (pending) {
      return pending;
    }

    // Create the connection (and track the promise to avoid duplicate creation)
    const connectionPromise = this.createConnection(name);
    this.pendingConnections.set(name, connectionPromise);

    try {
      const connection = await connectionPromise;
      this.connections.set(name, connection);
      return connection;
    } finally {
      this.pendingConnections.delete(name);
    }
  }

  /**
   * Create a new connection based on the name and configuration.
   */
  private async createConnection(name: string): Promise<Connection> {
    const connectionConfig = this.config.connections?.[name];

    // Check if this is a Publisher connection
    if (isPublisherConfig(connectionConfig)) {
      return this.createPublisherConnection(name, connectionConfig);
    }

    // Check for legacy DuckDB config or default connection
    if (name === 'duckdb' || name === 'default') {
      return this.createDuckDBConnection();
    }

    // Unknown connection - check if there's a named config that's not Publisher
    if (connectionConfig && !isPublisherConfig(connectionConfig)) {
      // Treat as DuckDB config
      return this.createDuckDBConnection(connectionConfig as DuckDBConfig);
    }

    // Unknown connection type - default to DuckDB
    console.warn(`Unknown connection name: ${name}, defaulting to DuckDB`);
    return this.createDuckDBConnection();
  }

  /**
   * Create a Publisher connection using Credible's remote connection API.
   */
  private async createPublisherConnection(
    name: string,
    config: {connectionUri: string; accessToken: string}
  ): Promise<Connection> {
    console.error(`Creating Publisher connection: ${name}`);
    try {
      const connection = await PublisherConnection.create(name, {
        connectionUri: config.connectionUri,
        accessToken: config.accessToken,
      });
      console.error(`Publisher connection created: ${name}`);
      return connection;
    } catch (error) {
      console.error(`Failed to create Publisher connection ${name}:`, error);
      throw error;
    }
  }

  /**
   * Create a DuckDB connection using the configuration.
   */
  private createDuckDBConnection(overrideConfig?: DuckDBConfig): DuckDBConnection {
    const duckdbConfig = overrideConfig || this.config.connections?.duckdb;

    // Resolve working directory
    let workingDirectory = duckdbConfig?.workingDirectory || '.';
    if (this.workspaceRoot && workingDirectory === '.') {
      // Convert file:// URI to path if needed
      if (this.workspaceRoot.startsWith('file://')) {
        workingDirectory = new URL(this.workspaceRoot).pathname;
      } else {
        workingDirectory = this.workspaceRoot;
      }
    }

    return new DuckDBConnection({
      name: 'duckdb',
      databasePath: duckdbConfig?.databasePath || ':memory:',
      workingDirectory,
      additionalExtensions: duckdbConfig?.additionalExtensions,
      motherDuckToken: duckdbConfig?.motherDuckToken,
    });
  }

  /**
   * Close all connections and clean up resources.
   */
  async dispose(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const connection of this.connections.values()) {
      closePromises.push(connection.close());
    }

    await Promise.all(closePromises);
    this.connections.clear();
  }

  /**
   * Get a list of available connection names.
   */
  getConnectionNames(): string[] {
    const names: string[] = [];

    if (this.config.connections) {
      for (const [name, config] of Object.entries(this.config.connections)) {
        if (config !== undefined) {
          names.push(name);
        }
      }
    }

    // Always include duckdb as a fallback if not already present
    if (!names.includes('duckdb')) {
      names.push('duckdb');
    }

    return names;
  }
}
