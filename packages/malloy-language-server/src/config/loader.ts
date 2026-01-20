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

import * as fs from 'fs/promises';
import * as path from 'path';
import {MalloyConfig, DEFAULT_CONFIG} from './types';

/** Possible config file names, in order of precedence */
const CONFIG_FILE_NAMES = ['malloy-config.json', '.malloy/config.json'];

/**
 * Resolve environment variable references in a string.
 * Supports ${VAR_NAME} syntax.
 */
function resolveEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, varName) => {
    return process.env[varName] || '';
  });
}

/**
 * Recursively resolve environment variables in a config object.
 */
function resolveConfigEnvVars<T>(obj: T): T {
  if (typeof obj === 'string') {
    return resolveEnvVars(obj) as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => resolveConfigEnvVars(item)) as T;
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveConfigEnvVars(value);
    }
    return result as T;
  }
  return obj;
}

/**
 * Try to load a config file from the given path.
 */
async function tryLoadConfigFile(filePath: string): Promise<MalloyConfig | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return resolveConfigEnvVars(parsed);
  } catch {
    return null;
  }
}

/**
 * Load configuration from the workspace.
 * Searches for config files in order of precedence and merges with defaults.
 *
 * @param workspaceRoot The root directory of the workspace (as file:// URI or path)
 */
export async function loadConfig(workspaceRoot?: string): Promise<MalloyConfig> {
  // If no workspace root, just return defaults
  if (!workspaceRoot) {
    return DEFAULT_CONFIG;
  }

  // Convert file:// URI to path if needed
  let rootPath = workspaceRoot;
  if (workspaceRoot.startsWith('file://')) {
    rootPath = new URL(workspaceRoot).pathname;
  }

  // Try to find and load a config file
  for (const configFileName of CONFIG_FILE_NAMES) {
    const configPath = path.join(rootPath, configFileName);
    const config = await tryLoadConfigFile(configPath);
    if (config) {
      // Merge with defaults
      return mergeConfig(DEFAULT_CONFIG, config);
    }
  }

  // No config file found, return defaults
  return DEFAULT_CONFIG;
}

/**
 * Deep merge two config objects.
 * Named connections from overrides completely replace defaults (no deep merge).
 * Only DuckDB config is deep-merged for backwards compatibility.
 */
function mergeConfig(defaults: MalloyConfig, overrides: MalloyConfig): MalloyConfig {
  const mergedConnections = {
    ...defaults.connections,
    ...overrides.connections,
  };

  // Deep merge only the duckdb config for backwards compatibility
  if (defaults.connections?.duckdb || overrides.connections?.duckdb) {
    mergedConnections.duckdb = {
      ...defaults.connections?.duckdb,
      ...overrides.connections?.duckdb,
    };
  }

  return {
    connections: mergedConnections,
  };
}
