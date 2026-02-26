/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Meta} from '@storybook/html';
import script from './theme-presets.malloy?raw';
import {createLoader} from './util';
import {MalloyRenderer} from '../api/malloy-renderer';
import type {MalloyTheme} from '../component/theme';

// A warm, earthy custom theme
const warmTheme: MalloyTheme = {
  mode: 'light',
  fontFamily: 'Georgia, serif',
  background: '#faf7f2',
  tableBackground: '#faf7f2',
  tableHeaderBackground: '#f0ebe3',
  tableHeaderColor: '#5c4b37',
  tableBodyColor: '#6b5b4a',
  tableBorder: '1px solid #e0d5c5',
  tablePinnedBackground: '#f5efe6',
  tablePinnedBorder: '1px solid #d4c4ab',
  tableRowAlternateBackground: '#f7f2ea',
  dashboardBg: '#f5efe6',
  dashboardCardBg: '#faf7f2',
  dashboardTitleColor: '#8b7355',
  chartBackground: '#faf7f2',
  chartAxisLabelColor: '#8b7355',
  chartAxisTitleColor: '#8b7355',
  chartGridColor: '#e0d5c5',
  bigValueCardBg: '#faf7f2',
  bigValueCardBorder: '#e0d5c5',
  bigValueLabelColor: '#8b7355',
  colors: ['#c2703e', '#8b7355', '#a67b5b', '#6b8e7b', '#b8956a', '#7d6e5c'],
};

// A high-contrast accessibility theme
const highContrastTheme: MalloyTheme = {
  mode: 'dark',
  background: '#000000',
  tableBackground: '#000000',
  tableHeaderBackground: '#1a1a1a',
  tableHeaderColor: '#ffffff',
  tableBodyColor: '#e0e0e0',
  tableBorder: '1px solid #555555',
  tablePinnedBackground: '#111111',
  tablePinnedBorder: '1px solid #666666',
  tableRowAlternateBackground: '#0a0a0a',
  dashboardBg: '#000000',
  dashboardCardBg: '#111111',
  dashboardTitleColor: '#cccccc',
  chartBackground: '#111111',
  chartAxisLabelColor: '#cccccc',
  chartAxisTitleColor: '#cccccc',
  chartGridColor: '#444444',
  bigValueCardBg: '#111111',
  bigValueCardBorder: '#555555',
  bigValueLabelColor: '#cccccc',
  bigValueDeltaPositive: '#00ff88',
  bigValueDeltaNegative: '#ff4444',
  colors: ['#ffff00', '#00ffff', '#ff00ff', '#00ff00', '#ff8800', '#8888ff'],
};

function renderWithTheme(theme: MalloyTheme) {
  return (
    _args: Record<string, unknown>,
    context: {loaded: Record<string, unknown>}
  ) => {
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
// CUSTOM THEMES
// ============================================================

const meta: Meta = {
  title: 'Themes/Custom',
  loaders: [createLoader(script)],
};

export default meta;

// --- Warm Theme ---
export const WarmTable = {
  render: renderWithTheme(warmTheme),
  args: {source: 'products', view: 'theme_table'},
};

export const WarmBarChart = {
  render: renderWithTheme(warmTheme),
  args: {source: 'products', view: 'theme_bar_chart'},
};

export const WarmLineChart = {
  render: renderWithTheme(warmTheme),
  args: {source: 'products', view: 'theme_line_chart'},
};

export const WarmBigValue = {
  render: renderWithTheme(warmTheme),
  args: {source: 'products', view: 'theme_big_value'},
};

export const WarmDashboard = {
  render: renderWithTheme(warmTheme),
  args: {source: 'products', view: 'theme_dashboard'},
};

// --- High Contrast Theme ---
export const HighContrastTable = {
  render: renderWithTheme(highContrastTheme),
  args: {source: 'products', view: 'theme_table'},
};

export const HighContrastBarChart = {
  render: renderWithTheme(highContrastTheme),
  args: {source: 'products', view: 'theme_bar_chart'},
};

export const HighContrastBigValue = {
  render: renderWithTheme(highContrastTheme),
  args: {source: 'products', view: 'theme_big_value'},
};

export const HighContrastDashboard = {
  render: renderWithTheme(highContrastTheme),
  args: {source: 'products', view: 'theme_dashboard'},
};
