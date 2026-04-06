/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {getDataTree} from './data_tree';
import type * as Malloy from '@malloydata/malloy-interfaces';

/**
 * Build a minimal Malloy Result for testing.
 * All fields are string dimensions for simplicity.
 */
function makeStringResult(
  fieldNames: string[],
  rows: (string | null)[][]
): Malloy.Result {
  const fields: Malloy.FieldInfoWithDimension[] = fieldNames.map(name => ({
    kind: 'dimension' as const,
    name,
    type: {kind: 'string_type' as const},
  }));

  const dataRows: Malloy.DataWithRecordCell[] = rows.map(row => ({
    kind: 'record_cell' as const,
    record_value: row.map(
      (v): Malloy.Cell =>
        v === null
          ? {kind: 'null_cell' as const}
          : {kind: 'string_cell' as const, string_value: v}
    ),
  }));

  return {
    schema: {fields},
    data: {kind: 'array_cell' as const, array_value: dataRows},
    connection_name: 'test',
  };
}

describe('RecordCell.column()', () => {
  test('returns the cell for a valid field name', () => {
    const result = makeStringResult(['city', 'state'], [['Seattle', 'WA']]);
    const tree = getDataTree(result);
    const row = tree.rows[0];
    const cell = row.column('city');
    expect(cell).toBeDefined();
    expect(cell.field.name).toBe('city');
  });

  test('throws a descriptive error for a missing field name', () => {
    const result = makeStringResult(['city', 'state'], [['Seattle', 'WA']]);
    const tree = getDataTree(result);
    const row = tree.rows[0];
    expect(() => row.column('nonexistent')).toThrow(
      /No cell found for field 'nonexistent'/
    );
    expect(() => row.column('nonexistent')).toThrow(/Available cells:/);
  });

  test('handles rows with null dimension values without crashing', () => {
    const result = makeStringResult(
      ['medium', 'channel'],
      [
        ['Linear', 'TV'],
        [null, 'Digital'], // null dimension — should still create a cell
      ]
    );
    const tree = getDataTree(result);

    // Both rows should have cells for all fields, including the null one
    for (const row of tree.rows) {
      const mediumCell = row.column('medium');
      expect(mediumCell).toBeDefined();
      expect(mediumCell.field.name).toBe('medium');

      const channelCell = row.column('channel');
      expect(channelCell).toBeDefined();
      expect(channelCell.field.name).toBe('channel');
    }
  });

  test('error message lists available cell names', () => {
    const result = makeStringResult(
      ['alpha', 'beta', 'gamma'],
      [['a', 'b', 'c']]
    );
    const tree = getDataTree(result);
    const row = tree.rows[0];
    try {
      row.column('missing');
      fail('should have thrown');
    } catch (e: unknown) {
      const msg = (e as Error).message;
      expect(msg).toContain('alpha');
      expect(msg).toContain('beta');
      expect(msg).toContain('gamma');
    }
  });
});

describe('schema/data mismatch', () => {
  test('data with fewer values than schema fields', () => {
    // Simulate a result where record_value has 2 entries but schema has 3 fields.
    // This is the kind of mismatch that causes the "Cannot read 'field'" crash.
    const result: Malloy.Result = {
      schema: {
        fields: [
          {
            kind: 'dimension' as const,
            name: 'a',
            type: {kind: 'string_type' as const},
          },
          {
            kind: 'dimension' as const,
            name: 'b',
            type: {kind: 'string_type' as const},
          },
          {
            kind: 'dimension' as const,
            name: 'c',
            type: {kind: 'string_type' as const},
          },
        ],
      },
      data: {
        kind: 'array_cell' as const,
        array_value: [
          {
            kind: 'record_cell' as const,
            record_value: [
              {kind: 'string_cell' as const, string_value: 'x'},
              {kind: 'string_cell' as const, string_value: 'y'},
              // missing third value — record_value[2] is undefined
            ],
          },
        ],
      },
      connection_name: 'test',
    };

    // The tree construction may crash or the column lookup may crash.
    // Either way, the error should be descriptive, not
    // "Cannot read properties of undefined (reading 'field')".
    let caughtError: Error | undefined;
    try {
      const tree = getDataTree(result);
      const row = tree.rows[0];
      // 'a' and 'b' should work fine
      expect(row.column('a').field.name).toBe('a');
      expect(row.column('b').field.name).toBe('b');
      // 'c' — created from undefined cell data — should either:
      //   (a) have been handled during construction, or
      //   (b) throw a clear error from column()
      row.column('c');
    } catch (e) {
      caughtError = e as Error;
    }

    if (caughtError) {
      // The error should NOT be the unhelpful generic message
      expect(caughtError.message).not.toMatch(
        /Cannot read properties of undefined/
      );
    }
  });
});
