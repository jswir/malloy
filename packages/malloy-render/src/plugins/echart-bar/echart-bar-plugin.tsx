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
  mapToSeriesData,
  formatNumber,
  deepMerge,
  parseEchartsPassthrough,
  resolveTheme,
} from '../echarts-common';

echarts.use([BarChart]);

export const EchartBarPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_bar',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_bar',
      ownedPaths: [
        ['echart_bar'],
        ['echart_bar', 'orient'],
        ['echart_bar', 'stack'],
        ['echart_bar', 'colors'],
        ['echart_bar', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_bar');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Bar: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (
      field: Field,
      pluginOptions?: unknown
    ): DOMRenderPluginInstance => ({
      name: 'echart_bar',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Bar: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const dimFields = fields.filter(
          f => f.isString() || f.isTime() || f.isDate()
        );
        const measureFields = fields.filter(f => f.isNumber());
        if (dimFields.length === 0 || measureFields.length === 0) {
          throw new Error(
            'EChart Bar: requires at least 1 dimension and 1 measure'
          );
        }

        const categoryField = dimFields[0];
        const seriesField = dimFields.length > 1 ? dimFields[1] : undefined;

        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);

        const pluginTag = field.tag.tag('echart_bar');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));
        const isHorizontal = pluginTag?.text('orient') === 'horizontal';
        const isStack = pluginTag?.has('stack') ?? false;

        const sd = mapToSeriesData(
          data.rows,
          categoryField,
          seriesField,
          measureFields
        );

        const series = sd.seriesNames.map(name => ({
          type: 'bar' as const,
          name,
          data: sd.seriesValues.get(name),
          ...(isStack ? {stack: 'total'} : {}),
        }));

        const categoryAxis = {
          type: 'category' as const,
          data: sd.categories,
          axisLabel: {
            rotate: isHorizontal ? 0 : 30,
            overflow: 'truncate' as const,
            width: 80,
          },
        };
        const valueAxis = {
          type: 'value' as const,
          axisLabel: {formatter: (v: number) => formatNumber(v)},
        };

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          grid: {
            top: 30,
            bottom: isHorizontal ? 40 : 80,
            left: isHorizontal ? 100 : 70,
            right: 20,
          },
          xAxis: isHorizontal ? valueAxis : categoryAxis,
          yAxis: isHorizontal ? categoryAxis : valueAxis,
          legend: {
            show: sd.seriesNames.length > 1 && sd.seriesNames.length <= 10,
            top: 0,
            type: 'scroll',
          },
          series,
        };

        const passthrough = parseEchartsPassthrough(
          pluginTag,
          'echart_bar'
        );
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_bar', field}),
    }),
  };
