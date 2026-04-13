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
import {BoxplotChart} from 'echarts/charts';
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

echarts.use([BoxplotChart]);

export const EchartBoxplotPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_boxplot',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_boxplot',
      ownedPaths: [
        ['echart_boxplot'],
        ['echart_boxplot', 'colors'],
        ['echart_boxplot', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_boxplot');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Boxplot: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (field: Field, pluginOptions?: unknown): DOMRenderPluginInstance => ({
      name: 'echart_boxplot',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Boxplot: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const dimField = fields.find(
          f => f.isString() || f.isTime() || f.isDate()
        );
        const measureFields = fields.filter(f => f.isNumber());
        if (!dimField || measureFields.length < 5) {
          throw new Error(
            'EChart Boxplot: requires 1 dimension and 5 measures (min, q1, median, q3, max)'
          );
        }

        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);

        const categories: string[] = [];
        const boxData: number[][] = [];

        for (const row of data.rows) {
          categories.push(String(row.column(dimField.name).value ?? ''));
          boxData.push(
            measureFields
              .slice(0, 5)
              .map(mf => (row.column(mf.name).value as number) ?? 0)
          );
        }

        const pluginTag = field.tag.tag('echart_boxplot');
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
            axisLabel: {formatter: (v: number) => formatNumber(v)},
          },
          series: [{type: 'boxplot', data: boxData}],
        };

        const passthrough = parseEchartsPassthrough(
          pluginTag,
          'echart_boxplot'
        );
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_boxplot', field}),
    }),
  };
