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
import {TreemapChart} from 'echarts/charts';
import {
  echarts,
  initChart,
  disposeChart,
  getChartSize,
  getBaseOption,
  mapToHierarchy,
  formatNumber,
  deepMerge,
  parseEchartsPassthrough,
  resolveTheme,
} from '../echarts-common';

echarts.use([TreemapChart]);

export const EchartTreemapPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_treemap',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_treemap',
      ownedPaths: [
        ['echart_treemap'],
        ['echart_treemap', 'colors'],
        ['echart_treemap', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_treemap');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Treemap: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (field: Field, pluginOptions?: unknown): DOMRenderPluginInstance => ({
      name: 'echart_treemap',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Treemap: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const dimField = fields.find(
          f => f.isString() || f.isTime() || f.isDate()
        );
        const measureField = fields.find(f => f.isNumber());
        const nestField = fields.find(f => f.isNest?.());
        if (!dimField || !measureField) {
          throw new Error(
            'EChart Treemap: requires at least 1 dimension and 1 measure'
          );
        }

        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);
        const treeData = mapToHierarchy(
          data.rows,
          dimField,
          measureField,
          nestField
        );

        const pluginTag = field.tag.tag('echart_treemap');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          series: [
            {
              type: 'treemap',
              data: treeData,
              leafDepth: nestField ? undefined : 1,
              label: {
                show: true,
                formatter: (params: {name: string; value: number}) =>
                  `${params.name}\n${formatNumber(params.value)}`,
              },
              breadcrumb: {show: true},
            },
          ],
        };

        const passthrough = parseEchartsPassthrough(
          pluginTag,
          'echart_treemap'
        );
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_treemap', field}),
    }),
  };
