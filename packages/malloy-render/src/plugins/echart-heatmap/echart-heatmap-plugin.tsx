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
import {HeatmapChart} from 'echarts/charts';
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

echarts.use([HeatmapChart]);

export const EchartHeatmapPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_heatmap',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_heatmap',
      ownedPaths: [
        ['echart_heatmap'],
        ['echart_heatmap', 'colors'],
        ['echart_heatmap', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_heatmap');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Heatmap: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (field: Field, pluginOptions?: unknown): DOMRenderPluginInstance => ({
      name: 'echart_heatmap',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Heatmap: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const dimFields = fields.filter(
          f => f.isString() || f.isTime() || f.isDate()
        );
        const measureField = fields.find(f => f.isNumber());
        if (dimFields.length < 2 || !measureField) {
          throw new Error(
            'EChart Heatmap: requires 2 dimensions and 1 measure'
          );
        }

        const xField = dimFields[0];
        const yField = dimFields[1];
        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);

        const xCategories = new Set<string>();
        const yCategories = new Set<string>();
        let minVal = Infinity;
        let maxVal = -Infinity;

        const heatData: [number, number, number][] = [];
        for (const row of data.rows) {
          const xVal = String(row.column(xField.name).value ?? '');
          const yVal = String(row.column(yField.name).value ?? '');
          const val = (row.column(measureField.name).value as number) ?? 0;
          xCategories.add(xVal);
          yCategories.add(yVal);
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
          heatData.push([
            Array.from(xCategories).indexOf(xVal),
            Array.from(yCategories).indexOf(yVal),
            val,
          ]);
        }

        const xCats = Array.from(xCategories);
        const yCats = Array.from(yCategories);

        // Re-index after final category arrays
        const reindexed = data.rows.map(row => {
          const xVal = String(row.column(xField.name).value ?? '');
          const yVal = String(row.column(yField.name).value ?? '');
          const val = (row.column(measureField.name).value as number) ?? 0;
          return [xCats.indexOf(xVal), yCats.indexOf(yVal), val] as [
            number,
            number,
            number,
          ];
        });

        const pluginTag = field.tag.tag('echart_heatmap');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          tooltip: {position: 'top'},
          grid: {top: 10, bottom: 60, left: 80, right: 40},
          xAxis: {type: 'category', data: xCats, splitArea: {show: true}},
          yAxis: {type: 'category', data: yCats, splitArea: {show: true}},
          visualMap: {
            min: minVal,
            max: maxVal,
            calculable: true,
            orient: 'horizontal',
            bottom: 0,
            left: 'center',
          },
          series: [
            {
              type: 'heatmap',
              data: reindexed,
              label: {show: reindexed.length <= 100},
            },
          ],
        };

        const passthrough = parseEchartsPassthrough(
          pluginTag,
          'echart_heatmap'
        );
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_heatmap', field}),
    }),
  };
