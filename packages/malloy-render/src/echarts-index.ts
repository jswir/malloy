/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {EchartPiePluginFactory} from './plugins/echart-pie/echart-pie-plugin';
import {EchartFunnelPluginFactory} from './plugins/echart-funnel/echart-funnel-plugin';
import {EchartGaugePluginFactory} from './plugins/echart-gauge/echart-gauge-plugin';
import {EchartRadarPluginFactory} from './plugins/echart-radar/echart-radar-plugin';
import {EchartHeatmapPluginFactory} from './plugins/echart-heatmap/echart-heatmap-plugin';
import {EchartTreemapPluginFactory} from './plugins/echart-treemap/echart-treemap-plugin';
import {EchartSunburstPluginFactory} from './plugins/echart-sunburst/echart-sunburst-plugin';
import {EchartSankeyPluginFactory} from './plugins/echart-sankey/echart-sankey-plugin';
import {EchartGraphPluginFactory} from './plugins/echart-graph/echart-graph-plugin';
import {EchartBoxplotPluginFactory} from './plugins/echart-boxplot/echart-boxplot-plugin';
import {EchartCandlestickPluginFactory} from './plugins/echart-candlestick/echart-candlestick-plugin';
import {EchartParallelPluginFactory} from './plugins/echart-parallel/echart-parallel-plugin';
import {EchartCalendarPluginFactory} from './plugins/echart-calendar/echart-calendar-plugin';
import {EchartTreePluginFactory} from './plugins/echart-tree/echart-tree-plugin';
import {EchartWaterfallPluginFactory} from './plugins/echart-waterfall/echart-waterfall-plugin';
import {EchartRiverPluginFactory} from './plugins/echart-river/echart-river-plugin';
import {EchartWordcloudPluginFactory} from './plugins/echart-wordcloud/echart-wordcloud-plugin';
import {EchartBarPluginFactory} from './plugins/echart-bar/echart-bar-plugin';
import {EchartLinePluginFactory} from './plugins/echart-line/echart-line-plugin';
import {EchartMekkoPluginFactory} from './plugins/echart-mekko/echart-mekko-plugin';

export const echartsPlugins = [
  EchartPiePluginFactory,
  EchartFunnelPluginFactory,
  EchartGaugePluginFactory,
  EchartRadarPluginFactory,
  EchartHeatmapPluginFactory,
  EchartTreemapPluginFactory,
  EchartSunburstPluginFactory,
  EchartSankeyPluginFactory,
  EchartGraphPluginFactory,
  EchartBoxplotPluginFactory,
  EchartCandlestickPluginFactory,
  EchartParallelPluginFactory,
  EchartCalendarPluginFactory,
  EchartTreePluginFactory,
  EchartWaterfallPluginFactory,
  EchartRiverPluginFactory,
  EchartWordcloudPluginFactory,
  EchartBarPluginFactory,
  EchartLinePluginFactory,
  EchartMekkoPluginFactory,
];

// Individual exports for consumers who only want a subset
export {EchartPiePluginFactory} from './plugins/echart-pie/echart-pie-plugin';
export {EchartFunnelPluginFactory} from './plugins/echart-funnel/echart-funnel-plugin';
export {EchartGaugePluginFactory} from './plugins/echart-gauge/echart-gauge-plugin';
export {EchartRadarPluginFactory} from './plugins/echart-radar/echart-radar-plugin';
export {EchartHeatmapPluginFactory} from './plugins/echart-heatmap/echart-heatmap-plugin';
export {EchartTreemapPluginFactory} from './plugins/echart-treemap/echart-treemap-plugin';
export {EchartSunburstPluginFactory} from './plugins/echart-sunburst/echart-sunburst-plugin';
export {EchartSankeyPluginFactory} from './plugins/echart-sankey/echart-sankey-plugin';
export {EchartGraphPluginFactory} from './plugins/echart-graph/echart-graph-plugin';
export {EchartBoxplotPluginFactory} from './plugins/echart-boxplot/echart-boxplot-plugin';
export {EchartCandlestickPluginFactory} from './plugins/echart-candlestick/echart-candlestick-plugin';
export {EchartParallelPluginFactory} from './plugins/echart-parallel/echart-parallel-plugin';
export {EchartCalendarPluginFactory} from './plugins/echart-calendar/echart-calendar-plugin';
export {EchartTreePluginFactory} from './plugins/echart-tree/echart-tree-plugin';
export {EchartWaterfallPluginFactory} from './plugins/echart-waterfall/echart-waterfall-plugin';
export {EchartRiverPluginFactory} from './plugins/echart-river/echart-river-plugin';
export {EchartWordcloudPluginFactory} from './plugins/echart-wordcloud/echart-wordcloud-plugin';
export {EchartBarPluginFactory} from './plugins/echart-bar/echart-bar-plugin';
export {EchartLinePluginFactory} from './plugins/echart-line/echart-line-plugin';
export {EchartMekkoPluginFactory} from './plugins/echart-mekko/echart-mekko-plugin';
