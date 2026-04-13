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
import {FunnelChart} from 'echarts/charts';
import {
  echarts,
  initChart,
  disposeChart,
  getChartSize,
  getBaseOption,
  mapToNameValue,
  deepMerge,
  parseEchartsPassthrough,
  resolveTheme,
} from '../echarts-common';

echarts.use([FunnelChart]);

export const EchartFunnelPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_funnel',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_funnel',
      ownedPaths: [
        ['echart_funnel'],
        ['echart_funnel', 'colors'],
        ['echart_funnel', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_funnel');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Funnel: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (field: Field, pluginOptions?: unknown): DOMRenderPluginInstance => ({
      name: 'echart_funnel',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Funnel: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const dimField = fields.find(
          f => f.isString() || f.isTime() || f.isDate()
        );
        const measureField = fields.find(f => f.isNumber());
        if (!dimField || !measureField) {
          throw new Error(
            'EChart Funnel: requires at least 1 dimension and 1 measure'
          );
        }

        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);
        const chartData = mapToNameValue(data.rows, dimField, measureField);

        const pluginTag = field.tag.tag('echart_funnel');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          tooltip: {trigger: 'item', formatter: '{b}: {c} ({d}%)'},
          legend: {show: chartData.length <= 10, bottom: 0, type: 'scroll'},
          series: [
            {
              type: 'funnel',
              sort: 'descending',
              gap: 2,
              label: {show: true, position: 'inside'},
              data: chartData,
            },
          ],
        };

        const passthrough = parseEchartsPassthrough(pluginTag, 'echart_funnel');
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_funnel', field}),
    }),
  };
