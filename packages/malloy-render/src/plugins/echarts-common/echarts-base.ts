/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as echarts from 'echarts/core';
import {SVGRenderer} from 'echarts/renderers';
import {
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  GridComponent,
  VisualMapComponent,
  DataZoomComponent,
  CalendarComponent,
} from 'echarts/components';
import type {Field} from '@/data_tree';

echarts.use([
  SVGRenderer,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  GridComponent,
  VisualMapComponent,
  DataZoomComponent,
  CalendarComponent,
]);

export {echarts};

export function initChart(
  container: HTMLElement,
  width: number,
  height: number
): echarts.ECharts {
  return echarts.init(container, null, {renderer: 'svg', width, height});
}

export function disposeChart(container: HTMLElement): void {
  const instance = echarts.getInstanceByDom(container);
  instance?.dispose();
}

export function getChartSize(field: Field): {width: number; height: number} {
  return field.isRoot() ? {height: 350, width: 500} : {height: 175, width: 250};
}

export function parseEchartsPassthrough(
  tag: {text(...at: string[]): string | undefined} | undefined,
  tagName: string
): Record<string, unknown> | undefined {
  const raw = tag?.text('echarts');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`${tagName}: invalid JSON in echarts pass-through: ${raw}`);
  }
}

export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = {...target};
  for (const key of Object.keys(source)) {
    const targetVal = target[key];
    const sourceVal = source[key];
    if (
      targetVal &&
      sourceVal &&
      typeof targetVal === 'object' &&
      typeof sourceVal === 'object' &&
      !Array.isArray(targetVal) &&
      !Array.isArray(sourceVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      );
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
}
