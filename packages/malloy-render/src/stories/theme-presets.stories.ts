/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Meta} from '@storybook/html';
import script from './theme-presets.malloy?raw';
import {createLoader} from './util';
import {MalloyRenderer} from '../api/malloy-renderer';
import type {ThemePreset, MalloyTheme} from '../component/theme';

function renderWithTheme(theme: ThemePreset | MalloyTheme) {
  return (_args: Record<string, unknown>, context: {loaded: Record<string, unknown>}) => {
    const parent = document.createElement('div');
    parent.style.height = 'calc(100vh - 40px)';
    parent.style.position = 'relative';

    const targetElement = document.createElement('div');
    targetElement.style.height = '100%';
    targetElement.style.width = '100%';

    const renderer = new MalloyRenderer({theme});
    const viz = renderer.createViz({
      onError: error => console.log('Malloy render error', error),
    });
    viz.setResult(context.loaded['result'] as never);
    viz.render(targetElement);

    parent.appendChild(targetElement);
    return parent;
  };
}

// ============================================================
// DARK THEME
// ============================================================

const darkMeta: Meta = {
  title: 'Themes/Dark',
  render: renderWithTheme('dark'),
  loaders: [createLoader(script)],
};

export default darkMeta;

export const DarkTable = {
  args: {source: 'products', view: 'theme_table'},
};

export const DarkBarChart = {
  args: {source: 'products', view: 'theme_bar_chart'},
};

export const DarkLineChart = {
  args: {source: 'products', view: 'theme_line_chart'},
};

export const DarkBigValue = {
  args: {source: 'products', view: 'theme_big_value'},
};

export const DarkDashboard = {
  args: {source: 'products', view: 'theme_dashboard'},
};

export const DarkNestedTable = {
  args: {source: 'products', view: 'theme_nested_table'},
};

export const DarkBigValueComparison = {
  args: {source: 'products', view: 'theme_big_value_comparison'},
};

export const DarkStackedBar = {
  args: {source: 'products', view: 'theme_stacked_bar'},
};
