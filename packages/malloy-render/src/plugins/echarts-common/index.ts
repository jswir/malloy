/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export {
  echarts,
  initChart,
  disposeChart,
  getChartSize,
  parseEchartsPassthrough,
  deepMerge,
} from './echarts-base';
export {
  ECHART_COLORS,
  getBaseOption,
  resolveTheme,
} from './echarts-theme';
export type {EchartThemeOptions} from './echarts-theme';
export {
  mapToNameValue,
  mapToDataset,
  mapToHierarchy,
  mapToLinks,
  mapToSeriesData,
} from './echarts-data-mapper';
export type {
  NameValueItem,
  TreeNode,
  LinkData,
  SeriesData,
} from './echarts-data-mapper';
export {formatNumber} from './echarts-tooltip';
