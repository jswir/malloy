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
import {CandlestickChart} from 'echarts/charts';
import {
  echarts,
  initChart,
  disposeChart,
  getChartSize,
  getBaseOption,
  deepMerge,
  parseEchartsPassthrough,
  formatNumber,
  resolveTheme,
} from '../echarts-common';

echarts.use([CandlestickChart]);

export const EchartCandlestickPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_candlestick',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_candlestick',
      ownedPaths: [
        ['echart_candlestick'],
        ['echart_candlestick', 'colors'],
        ['echart_candlestick', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_candlestick');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Candlestick: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (field: Field, pluginOptions?: unknown): DOMRenderPluginInstance => ({
      name: 'echart_candlestick',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Candlestick: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const dateField = fields.find(
          f => f.isTime() || f.isDate() || f.isString()
        );
        const measureFields = fields.filter(f => f.isNumber());
        if (!dateField || measureFields.length < 4) {
          throw new Error(
            'EChart Candlestick: requires 1 date dimension and 4 measures (open, close, low, high)'
          );
        }

        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);

        const categories: string[] = [];
        const ohlcData: number[][] = [];

        for (const row of data.rows) {
          const dateVal = row.column(dateField.name).value;
          categories.push(
            dateVal instanceof Date
              ? dateVal.toLocaleDateString()
              : String(dateVal ?? '')
          );
          ohlcData.push(
            measureFields
              .slice(0, 4)
              .map(mf => (row.column(mf.name).value as number) ?? 0)
          );
        }

        const pluginTag = field.tag.tag('echart_candlestick');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));

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
            scale: true,
            axisLabel: {formatter: (v: number) => formatNumber(v)},
          },
          dataZoom: [{type: 'inside', start: 0, end: 100}],
          series: [{type: 'candlestick', data: ohlcData}],
        };

        const passthrough = parseEchartsPassthrough(
          pluginTag,
          'echart_candlestick'
        );
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_candlestick', field}),
    }),
  };
