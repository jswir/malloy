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
import {BarChart} from 'echarts/charts';
import {
  echarts,
  initChart,
  disposeChart,
  getChartSize,
  getBaseOption,
  deepMerge,
  parseEchartsPassthrough,
  formatNumber,
  ECHART_COLORS,
  resolveTheme,
} from '../echarts-common';

echarts.use([BarChart]);

export const EchartWaterfallPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_waterfall',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_waterfall',
      ownedPaths: [
        ['echart_waterfall'],
        ['echart_waterfall', 'show_total'],
        ['echart_waterfall', 'colors'],
        ['echart_waterfall', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_waterfall');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Waterfall: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (field: Field, pluginOptions?: unknown): DOMRenderPluginInstance => ({
      name: 'echart_waterfall',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Waterfall: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const dimField = fields.find(
          f => f.isString() || f.isTime() || f.isDate()
        );
        const measureField = fields.find(f => f.isNumber());
        if (!dimField || !measureField) {
          throw new Error(
            'EChart Waterfall: requires 1 dimension and 1 measure'
          );
        }

        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);

        const pluginTag = field.tag.tag('echart_waterfall');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));
        const showTotal = pluginTag?.text('show_total') === 'true';

        const categories: string[] = [];
        const values: number[] = [];
        for (const row of data.rows) {
          categories.push(String(row.column(dimField.name).value ?? ''));
          values.push((row.column(measureField.name).value as number) ?? 0);
        }

        // Build waterfall stacked bars: transparent base + visible bar
        const baseData: number[] = [];
        const posData: (number | string)[] = [];
        const negData: (number | string)[] = [];
        let cumulative = 0;

        for (const val of values) {
          if (val >= 0) {
            baseData.push(cumulative);
            posData.push(val);
            negData.push('-');
          } else {
            baseData.push(cumulative + val);
            posData.push('-');
            negData.push(Math.abs(val));
          }
          cumulative += val;
        }

        if (showTotal) {
          categories.push('Total');
          baseData.push(0);
          posData.push(cumulative >= 0 ? cumulative : '-');
          negData.push(cumulative < 0 ? Math.abs(cumulative) : '-');
        }

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          grid: {top: 20, bottom: 80, left: 70, right: 20},
          xAxis: {
            type: 'category',
            data: categories,
            axisLabel: {rotate: 30, overflow: 'truncate', width: 80},
          },
          yAxis: {
            type: 'value',
            axisLabel: {
              formatter: (v: number) => formatNumber(v),
            },
          },
          series: [
            {
              type: 'bar',
              stack: 'waterfall',
              silent: true,
              itemStyle: {color: 'transparent'},
              data: baseData,
            },
            {
              type: 'bar',
              stack: 'waterfall',
              name: 'Increase',
              itemStyle: {color: ECHART_COLORS[3]},
              data: posData,
            },
            {
              type: 'bar',
              stack: 'waterfall',
              name: 'Decrease',
              itemStyle: {color: ECHART_COLORS[1]},
              data: negData,
            },
          ],
        };

        const passthrough = parseEchartsPassthrough(
          pluginTag,
          'echart_waterfall'
        );
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_waterfall', field}),
    }),
  };
