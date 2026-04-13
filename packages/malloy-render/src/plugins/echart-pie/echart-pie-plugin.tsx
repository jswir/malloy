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
import {PieChart} from 'echarts/charts';
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

echarts.use([PieChart]);

export const EchartPiePluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_pie',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_pie',
      ownedPaths: [
        ['echart_pie'],
        ['echart_pie', 'mode'],
        ['echart_pie', 'label'],
        ['echart_pie', 'colors'],
        ['echart_pie', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_pie');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Pie: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (field: Field, pluginOptions?: unknown): DOMRenderPluginInstance => ({
      name: 'echart_pie',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Pie: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const dimField = fields.find(
          f => f.isString() || f.isTime() || f.isDate()
        );
        const measureField = fields.find(f => f.isNumber());
        if (!dimField || !measureField) {
          throw new Error(
            'EChart Pie: requires at least 1 dimension and 1 measure'
          );
        }

        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);
        const chartData = mapToNameValue(data.rows, dimField, measureField);

        const pluginTag = field.tag.tag('echart_pie');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));
        const mode = pluginTag?.text('mode');
        const labelPos = pluginTag?.text('label') ?? 'outside';

        let radius: string | string[] = '70%';
        let roseType: boolean | string = false;
        if (mode === 'donut') radius = ['40%', '70%'];
        else if (mode === 'rose') {
          radius = ['20%', '70%'];
          roseType = 'radius';
        }

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          legend: {show: chartData.length <= 12, bottom: 0, type: 'scroll'},
          series: [
            {
              type: 'pie',
              radius,
              roseType: roseType || undefined,
              data: chartData,
              label: {show: labelPos !== 'none', position: labelPos},
              emphasis: {
                itemStyle: {shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)'},
              },
            },
          ],
        };

        const passthrough = parseEchartsPassthrough(pluginTag, 'echart_pie');
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_pie', field}),
    }),
  };
