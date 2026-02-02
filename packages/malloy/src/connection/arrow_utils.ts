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
 * Utilities for converting Apache Arrow data structures to vanilla JavaScript.
 * These utilities are used by connections that receive Arrow data, such as
 * DuckDB WASM and Arrow Flight SQL connections.
 *
 * Note: This module uses duck-typing for Arrow types to avoid requiring
 * apache-arrow as a direct dependency of @malloydata/malloy. Consuming
 * packages should have apache-arrow as their own dependency.
 */

import type {QueryDataRow} from '../model/malloy_types';

/**
 * Duck-typed interface for Arrow StructRow.
 * Matches the structure returned by apache-arrow's StructRow.
 */
export interface ArrowStructRow {
  toJSON(): Record<string, unknown>;
}

/**
 * Duck-typed interface for Arrow Table.
 * Matches the structure returned by apache-arrow's Table.
 */
export interface ArrowTable {
  toArray(): ArrowStructRow[];
  readonly numRows: number;
}

/**
 * Check if a value is iterable (but not a string or array).
 */
const isIterable = (x: object): x is Iterable<unknown> => Symbol.iterator in x;

/**
 * Arrow's toJSON() doesn't really do what we'd expect, since
 * it still includes Arrow objects like DecimalBigNums and Vectors,
 * so we need this function to unwrap those.
 *
 * @param value Element from an Arrow StructRow.
 * @returns Vanilla JavaScript value
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const unwrapArrow = (value: unknown): any => {
  if (value === null) {
    return value;
  } else if (value instanceof Date) {
    return value;
  } else if (typeof value === 'bigint') {
    return Number(value);
  } else if (typeof value === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = value as Record<string | symbol, any>;
    // DecimalBigNums appear as Uint32Arrays, but can be identified
    // because they have a Symbol.toPrimitive method
    if (obj[Symbol.toPrimitive]) {
      // There seems to be a bug in [Symbol.toPrimitive]("number") so
      // convert to string first and then to number.
      return Number(obj[Symbol.toPrimitive]());
    } else if (Array.isArray(value)) {
      return value.map(unwrapArrow);
    } else if (isIterable(value)) {
      // Catch Arrow Vector objects
      return [...value].map(unwrapArrow);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: Record<string | symbol, any> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          result[key] = unwrapArrow(obj[key]);
        }
      }
      return result;
    }
  }
  return value;
};

/**
 * Process a single Arrow result row into a Malloy QueryDataRow.
 * Unfortunately simply calling JSON.parse(JSON.stringify(row)) even
 * winds up converting DecimalBigNums to strings instead of numbers.
 * For some reason a custom replacer only sees DecimalBigNums as
 * strings, as well.
 *
 * @param row An Arrow StructRow (or any object with a toJSON method)
 * @returns A Malloy QueryDataRow with vanilla JavaScript values
 */
export const unwrapArrowRow = (row: ArrowStructRow): QueryDataRow => {
  return unwrapArrow(row.toJSON());
};

/**
 * Process an Arrow Table into an array of Malloy QueryDataRows.
 *
 * @param table An Arrow Table
 * @returns Array of Malloy QueryDataRows with vanilla JavaScript values
 */
export const unwrapArrowTable = (table: ArrowTable): QueryDataRow[] => {
  return table.toArray().map(unwrapArrowRow);
};
