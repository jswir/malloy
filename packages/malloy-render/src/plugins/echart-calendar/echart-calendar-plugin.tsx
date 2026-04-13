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
  getBaseOption,
  deepMerge,
  parseEchartsPassthrough,
  resolveTheme,
} from '../echarts-common';

echarts.use([HeatmapChart]);

export const EchartCalendarPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_calendar',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_calendar',
      ownedPaths: [
        ['echart_calendar'],
        ['echart_calendar', 'colors'],
        ['echart_calendar', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_calendar');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Calendar: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (field: Field, pluginOptions?: unknown): DOMRenderPluginInstance => ({
      name: 'echart_calendar',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Calendar: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const dateField = fields.find(f => f.isTime() || f.isDate());
        const measureField = fields.find(f => f.isNumber());
        if (!dateField || !measureField) {
          throw new Error(
            'EChart Calendar: requires 1 date dimension and 1 measure'
          );
        }

        const width = field.isRoot() ? 700 : 400;
        const height = field.isRoot() ? 250 : 150;
        const chart = initChart(container, width, height);

        let minDate = '';
        let maxDate = '';
        let minVal = Infinity;
        let maxVal = -Infinity;
        const calendarData: [string, number][] = [];

        for (const row of data.rows) {
          const dateVal = row.column(dateField.name).value;
          const dateStr =
            dateVal instanceof Date
              ? dateVal.toISOString().slice(0, 10)
              : String(dateVal ?? '');
          const val = (row.column(measureField.name).value as number) ?? 0;
          calendarData.push([dateStr, val]);
          if (!minDate || dateStr < minDate) minDate = dateStr;
          if (!maxDate || dateStr > maxDate) maxDate = dateStr;
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }

        const pluginTag = field.tag.tag('echart_calendar');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          calendar: {
            range: [minDate, maxDate],
            cellSize: ['auto', 15],
            top: 30,
            left: 50,
            right: 30,
          },
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
              coordinateSystem: 'calendar',
              data: calendarData,
            },
          ],
        };

        const passthrough = parseEchartsPassthrough(
          pluginTag,
          'echart_calendar'
        );
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_calendar', field}),
    }),
  };
