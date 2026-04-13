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
import {ParallelChart} from 'echarts/charts';
import {ParallelComponent} from 'echarts/components';
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

echarts.use([ParallelChart, ParallelComponent]);

export const EchartParallelPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_parallel',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_parallel',
      ownedPaths: [
        ['echart_parallel'],
        ['echart_parallel', 'colors'],
        ['echart_parallel', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_parallel');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Parallel: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (field: Field, pluginOptions?: unknown): DOMRenderPluginInstance => ({
      name: 'echart_parallel',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Parallel: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;

        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);

        const parallelAxis = fields.map((f, i) => ({
          dim: i,
          name: f.name,
          type: f.isNumber() ? ('value' as const) : ('category' as const),
          ...(f.isString()
            ? {
                data: Array.from(
                  new Set(
                    data.rows.map(r => String(r.column(f.name).value ?? ''))
                  )
                ),
              }
            : {}),
        }));

        const seriesData = data.rows.map(row =>
          fields.map(f => {
            const val = row.column(f.name).value;
            if (f.isNumber()) return (val as number) ?? 0;
            return String(val ?? '');
          })
        );

        const pluginTag = field.tag.tag('echart_parallel');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          parallelAxis,
          parallel: {left: 60, right: 40, bottom: 30, top: 30},
          series: [
            {
              type: 'parallel',
              lineStyle: {width: 1, opacity: 0.5},
              data: seriesData,
            },
          ],
        };

        const passthrough = parseEchartsPassthrough(
          pluginTag,
          'echart_parallel'
        );
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_parallel', field}),
    }),
  };
