/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Meta} from '@storybook/html';
import script from './theme-presets.malloy?raw';
import {createLoader} from './util';
import {MalloyRenderer} from '../api/malloy-renderer';

function renderWithLight(
  _args: Record<string, unknown>,
  context: {loaded: Record<string, unknown>}
) {
  const parent = document.createElement('div');
  parent.style.height = 'calc(100vh - 40px)';
  parent.style.position = 'relative';

  const targetElement = document.createElement('div');
  targetElement.style.height = '100%';
  targetElement.style.width = '100%';

  // Explicitly set light theme (overrides auto-detection)
  const renderer = new MalloyRenderer({theme: 'light'});
  const viz = renderer.createViz({
    onError: error => console.log('Malloy render error', error),
  });
  viz.setResult(context.loaded['result'] as never);
  viz.render(targetElement);

  parent.appendChild(targetElement);
  return parent;
}

const meta: Meta = {
  title: 'Themes/Light (Explicit)',
  render: renderWithLight,
  loaders: [createLoader(script)],
};

export default meta;

export const LightTable = {
  args: {source: 'products', view: 'theme_table'},
};

export const LightBarChart = {
  args: {source: 'products', view: 'theme_bar_chart'},
};

export const LightLineChart = {
  args: {source: 'products', view: 'theme_line_chart'},
};

export const LightBigValue = {
  args: {source: 'products', view: 'theme_big_value'},
};

export const LightDashboard = {
  args: {source: 'products', view: 'theme_dashboard'},
};
