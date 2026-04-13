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
import {RadarChart} from 'echarts/charts';
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

echarts.use([RadarChart]);

export const EchartRadarPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_radar',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_radar',
      ownedPaths: [
        ['echart_radar'],
        ['echart_radar', 'colors'],
        ['echart_radar', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_radar');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Radar: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (field: Field, pluginOptions?: unknown): DOMRenderPluginInstance => ({
      name: 'echart_radar',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Radar: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const dimField = fields.find(
          f => f.isString() || f.isTime() || f.isDate()
        );
        const measureFields = fields.filter(f => f.isNumber());
        if (!dimField || measureFields.length === 0) {
          throw new Error(
            'EChart Radar: requires 1 dimension and at least 1 measure'
          );
        }

        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);

        const indicator = measureFields.map(mf => {
          let maxVal = 0;
          for (const row of data.rows) {
            const v = (row.column(mf.name).value as number) ?? 0;
            if (v > maxVal) maxVal = v;
          }
          return {name: mf.name, max: maxVal * 1.2 || 100};
        });

        const seriesData = data.rows.map(row => ({
          name: String(row.column(dimField.name).value ?? ''),
          value: measureFields.map(
            mf => (row.column(mf.name).value as number) ?? 0
          ),
        }));

        const pluginTag = field.tag.tag('echart_radar');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          legend: {
            show: seriesData.length <= 10,
            bottom: 0,
            type: 'scroll',
          },
          radar: {indicator},
          series: [
            {
              type: 'radar',
              data: seriesData,
            },
          ],
        };

        const passthrough = parseEchartsPassthrough(pluginTag, 'echart_radar');
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_radar', field}),
    }),
  };
