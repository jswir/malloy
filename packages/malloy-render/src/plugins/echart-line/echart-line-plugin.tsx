/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  RenderPluginFactory,
  DOMRenderPluginInstance,
  RenderProps,
  RendererValidationSpec,
} from '@/api/plugin-types';
import {type Field, FieldType} from '@/data_tree';
import type {Tag} from '@malloydata/malloy-tag';
import {LineChart} from 'echarts/charts';
import {
  echarts,
  initChart,
  disposeChart,
  getChartSize,
  getBaseOption,
  mapToSeriesData,
  formatNumber,
  deepMerge,
  parseEchartsPassthrough,
  resolveTheme,
} from '../echarts-common';

echarts.use([LineChart]);

export const EchartLinePluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_line',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_line',
      ownedPaths: [
        ['echart_line'],
        ['echart_line', 'area'],
        ['echart_line', 'stack'],
        ['echart_line', 'smooth'],
        ['echart_line', 'colors'],
        ['echart_line', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_line');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Line: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (
      field: Field,
      pluginOptions?: unknown
    ): DOMRenderPluginInstance => ({
      name: 'echart_line',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Line: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const dimFields = fields.filter(
          f => f.isString() || f.isTime() || f.isDate()
        );
        const measureFields = fields.filter(f => f.isNumber());
        if (dimFields.length === 0 || measureFields.length === 0) {
          throw new Error(
            'EChart Line: requires at least 1 dimension and 1 measure'
          );
        }

        const categoryField = dimFields[0];
        const seriesField = dimFields.length > 1 ? dimFields[1] : undefined;

        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);

        const pluginTag = field.tag.tag('echart_line');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));
        const isArea = pluginTag?.has('area') ?? false;
        const isStack = pluginTag?.has('stack') ?? false;
        const isSmooth = pluginTag?.has('smooth') ?? false;

        const sd = mapToSeriesData(
          data.rows,
          categoryField,
          seriesField,
          measureFields
        );

        const series = sd.seriesNames.map(name => ({
          type: 'line' as const,
          name,
          data: sd.seriesValues.get(name),
          ...(isArea ? {areaStyle: {}} : {}),
          ...(isStack ? {stack: 'total'} : {}),
          ...(isSmooth ? {smooth: true} : {}),
        }));

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          grid: {top: 30, bottom: 80, left: 70, right: 20},
          xAxis: {
            type: 'category',
            data: sd.categories,
            axisLabel: {rotate: 30, overflow: 'truncate', width: 80},
          },
          yAxis: {
            type: 'value',
            axisLabel: {formatter: (v: number) => formatNumber(v)},
          },
          legend: {
            show: sd.seriesNames.length > 1 && sd.seriesNames.length <= 10,
            top: 0,
            type: 'scroll',
          },
          series,
        };

        const passthrough = parseEchartsPassthrough(
          pluginTag,
          'echart_line'
        );
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_line', field}),
    }),
  };
