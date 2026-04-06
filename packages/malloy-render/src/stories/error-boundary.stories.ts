/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Meta, StoryObj} from '@storybook/html';
import {MalloyRenderer} from '../api/malloy-renderer';
import type * as Malloy from '@malloydata/malloy-interfaces';

/**
 * Stories that demonstrate render error handling.
 *
 * Before the fix: the red error box was blank (no message visible).
 * After the fix: the red error box shows a descriptive error message.
 */

function renderResult(result: Malloy.Result): HTMLElement {
  const parent = document.createElement('div');
  parent.style.padding = '20px';
  parent.style.maxWidth = '600px';

  const targetElement = document.createElement('div');
  parent.appendChild(targetElement);

  const renderer = new MalloyRenderer();
  const viz = renderer.createViz({
    onError: error => {
      console.log('Malloy render error:', error);
    },
  });
  viz.setResult(result);
  viz.render(targetElement);

  return parent;
}

const meta: Meta = {
  title: 'Error Handling/Error Boundary',
};

export default meta;

/**
 * A normal result that renders fine — baseline for comparison.
 */
export const WorkingTable: StoryObj = {
  render: () => {
    const result: Malloy.Result = {
      schema: {
        fields: [
          {
            kind: 'dimension',
            name: 'city',
            type: {kind: 'string_type'},
          },
          {
            kind: 'dimension',
            name: 'state',
            type: {kind: 'string_type'},
          },
        ],
      },
      data: {
        kind: 'array_cell',
        array_value: [
          {
            kind: 'record_cell',
            record_value: [
              {kind: 'string_cell', string_value: 'Seattle'},
              {kind: 'string_cell', string_value: 'WA'},
            ],
          },
          {
            kind: 'record_cell',
            record_value: [
              {kind: 'string_cell', string_value: 'Portland'},
              {kind: 'string_cell', string_value: 'OR'},
            ],
          },
        ],
      },
      connection_name: 'test',
    };
    return renderResult(result);
  },
};

/**
 * Schema says 3 fields but data only has 2 values per row.
 *
 * Before fix: empty red box, console shows
 *   "Cannot read properties of undefined (reading 'kind')"
 *
 * After fix: red box shows
 *   "Schema/data mismatch: field 'cost' (index 2) has no
 *    corresponding data value. Schema has 3 fields but
 *    record has 2 values."
 */
export const SchemaDataMismatch: StoryObj = {
  render: () => {
    const result: Malloy.Result = {
      schema: {
        fields: [
          {
            kind: 'dimension',
            name: 'medium',
            type: {kind: 'string_type'},
          },
          {
            kind: 'dimension',
            name: 'impressions',
            type: {kind: 'number_type', subtype: 'integer'},
          },
          {
            kind: 'dimension',
            name: 'cost',
            type: {kind: 'number_type', subtype: 'decimal'},
          },
        ],
      },
      data: {
        kind: 'array_cell',
        array_value: [
          {
            kind: 'record_cell',
            record_value: [
              {kind: 'string_cell', string_value: 'Linear'},
              {kind: 'number_cell', number_value: 1000, subtype: 'integer'},
              // missing third value — triggers the crash
            ],
          },
        ],
      },
      connection_name: 'test',
    };
    return renderResult(result);
  },
};

/**
 * Table with null dimension values — should render fine,
 * not crash. Mirrors the production query2.txt data pattern.
 */
export const NullDimensionValues: StoryObj = {
  render: () => {
    const result: Malloy.Result = {
      schema: {
        fields: [
          {
            kind: 'dimension',
            name: 'medium',
            type: {kind: 'string_type'},
          },
          {
            kind: 'dimension',
            name: 'total_cost',
            type: {kind: 'number_type', subtype: 'decimal'},
          },
        ],
      },
      data: {
        kind: 'array_cell',
        array_value: [
          {
            kind: 'record_cell',
            record_value: [
              {kind: 'string_cell', string_value: 'Linear Only'},
              {kind: 'number_cell', number_value: 99351743647.4, subtype: 'decimal'},
            ],
          },
          {
            kind: 'record_cell',
            record_value: [
              {kind: 'string_cell', string_value: 'Digital Only'},
              {kind: 'number_cell', number_value: 0, subtype: 'decimal'},
            ],
          },
          {
            kind: 'record_cell',
            record_value: [
              {kind: 'null_cell'},
              {kind: 'number_cell', number_value: 665350488863.277, subtype: 'decimal'},
            ],
          },
        ],
      },
      connection_name: 'test',
    };
    return renderResult(result);
  },
};
