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
import {GaugeChart} from 'echarts/charts';
import {
  echarts,
  initChart,
  disposeChart,
  getChartSize,
  getBaseOption,
  deepMerge,
  parseEchartsPassthrough,
  resolveTheme,
} from '../echarts-common';

echarts.use([GaugeChart]);

export const EchartGaugePluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_gauge',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_gauge',
      ownedPaths: [
        ['echart_gauge'],
        ['echart_gauge', 'min'],
        ['echart_gauge', 'max'],
        ['echart_gauge', 'colors'],
        ['echart_gauge', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_gauge');
      if (
        hasTag &&
        fieldType !== FieldType.RepeatedRecord &&
        fieldType !== FieldType.Record
      ) {
        throw new Error(
          'EChart Gauge: field must be a nested query or record.'
        );
      }
      return hasTag;
    },

    create: (field: Field, pluginOptions?: unknown): DOMRenderPluginInstance => ({
      name: 'echart_gauge',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        const dc = props.dataColumn;
        let measureValue = 0;
        let measureName = '';

        if (dc.isRepeatedRecord()) {
          const row = dc.rows[0];
          if (row) {
            const measureField = row.field.fields.find(f => f.isNumber());
            if (measureField) {
              measureValue =
                (row.column(measureField.name).value as number) ?? 0;
              measureName = measureField.name;
            }
          }
        } else if (dc.isRecord()) {
          const measureField = dc.field.fields.find(f => f.isNumber());
          if (measureField) {
            measureValue = (dc.column(measureField.name).value as number) ?? 0;
            measureName = measureField.name;
          }
        }

        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);

        const pluginTag = field.tag.tag('echart_gauge');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));
        const min = pluginTag?.numeric('min') ?? 0;
        const max = pluginTag?.numeric('max') ?? 100;

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          series: [
            {
              type: 'gauge',
              min,
              max,
              detail: {formatter: '{value}'},
              data: [{value: measureValue, name: measureName}],
            },
          ],
        };

        const passthrough = parseEchartsPassthrough(pluginTag, 'echart_gauge');
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_gauge', field}),
    }),
  };
