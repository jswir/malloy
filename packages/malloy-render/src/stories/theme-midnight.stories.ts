/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Meta} from '@storybook/html';
import script from './theme-presets.malloy?raw';
import {createLoader} from './util';
import {MalloyRenderer} from '../api/malloy-renderer';

function renderWithMidnight(
  _args: Record<string, unknown>,
  context: {loaded: Record<string, unknown>}
) {
  const parent = document.createElement('div');
  parent.style.height = 'calc(100vh - 40px)';
  parent.style.position = 'relative';

  const targetElement = document.createElement('div');
  targetElement.style.height = '100%';
  targetElement.style.width = '100%';

  const renderer = new MalloyRenderer({theme: 'midnight'});
  const viz = renderer.createViz({
    onError: error => console.log('Malloy render error', error),
  });
  viz.setResult(context.loaded['result'] as never);
  viz.render(targetElement);

  parent.appendChild(targetElement);
  return parent;
}

const meta: Meta = {
  title: 'Themes/Midnight',
  render: renderWithMidnight,
  loaders: [createLoader(script)],
};

export default meta;

export const MidnightTable = {
  args: {source: 'products', view: 'theme_table'},
};

export const MidnightBarChart = {
  args: {source: 'products', view: 'theme_bar_chart'},
};

export const MidnightLineChart = {
  args: {source: 'products', view: 'theme_line_chart'},
};

export const MidnightBigValue = {
  args: {source: 'products', view: 'theme_big_value'},
};

export const MidnightDashboard = {
  args: {source: 'products', view: 'theme_dashboard'},
};

export const MidnightNestedTable = {
  args: {source: 'products', view: 'theme_nested_table'},
};

export const MidnightBigValueComparison = {
  args: {source: 'products', view: 'theme_big_value_comparison'},
};
