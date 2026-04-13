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
import {ThemeRiverChart} from 'echarts/charts';
import {SingleAxisComponent} from 'echarts/components';
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

echarts.use([ThemeRiverChart, SingleAxisComponent]);

export const EchartRiverPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_river',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_river',
      ownedPaths: [
        ['echart_river'],
        ['echart_river', 'colors'],
        ['echart_river', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_river');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart River: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (field: Field, pluginOptions?: unknown): DOMRenderPluginInstance => ({
      name: 'echart_river',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart River: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const timeField = fields.find(
          f => f.isTime() || f.isDate() || f.isString()
        );
        const dimFields = fields.filter(
          f => (f.isString() || f.isTime() || f.isDate()) && f !== timeField
        );
        const measureField = fields.find(f => f.isNumber());
        if (!timeField || dimFields.length < 1 || !measureField) {
          throw new Error(
            'EChart River: requires 1 time dimension, 1 category dimension, and 1 measure'
          );
        }

        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);
        const categoryField = dimFields[0];

        const riverData: [string, number, string][] = data.rows.map(row => {
          const timeVal = row.column(timeField.name).value;
          const timeStr =
            timeVal instanceof Date
              ? timeVal.toISOString().slice(0, 10)
              : String(timeVal ?? '');
          return [
            timeStr,
            (row.column(measureField.name).value as number) ?? 0,
            String(row.column(categoryField.name).value ?? ''),
          ];
        });

        const pluginTag = field.tag.tag('echart_river');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          singleAxis: {type: 'time', bottom: 30},
          series: [
            {
              type: 'themeRiver',
              emphasis: {
                itemStyle: {shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.3)'},
              },
              data: riverData,
            },
          ],
        };

        const passthrough = parseEchartsPassthrough(pluginTag, 'echart_river');
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_river', field}),
    }),
  };
