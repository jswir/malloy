/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Meta} from '@storybook/html';
import script from './theme-model-example.malloy?raw';
import {createLoader} from './util';
import {MalloyRenderer} from '../api/malloy-renderer';

// This story demonstrates model-level theming via Malloy tags.
// The .malloy file uses `## theme.mode=dark` at the source level,
// so ALL views inherit dark mode automatically — no JS API needed.

const meta: Meta = {
  title: 'Themes/Model-Level Dark',
  render: (_args, context) => {
    const parent = document.createElement('div');
    parent.style.height = 'calc(100vh - 40px)';
    parent.style.position = 'relative';

    const targetElement = document.createElement('div');
    targetElement.style.height = '100%';
    targetElement.style.width = '100%';

    // No theme passed here — theme comes from the ## tags in the .malloy file
    const renderer = new MalloyRenderer();
    const viz = renderer.createViz({
      onError: error => console.log('Malloy render error', error),
    });
    viz.setResult(context.loaded['result'] as never);
    viz.render(targetElement);

    parent.appendChild(targetElement);
    return parent;
  },
  loaders: [createLoader(script)],
};

export default meta;

// All of these inherit `## theme.mode=dark` from the source level

export const DarkTable = {
  args: {source: 'products', view: 'sales_table'},
};

export const DarkBarChart = {
  args: {source: 'products', view: 'revenue_by_category'},
};

export const DarkLineChart = {
  args: {source: 'products', view: 'revenue_over_time'},
};

export const DarkDashboard = {
  args: {source: 'products', view: 'category_overview'},
};

// This view overrides the model theme with `# theme.mode=light`
export const LightOverride = {
  args: {source: 'products', view: 'light_override_table'},
};
