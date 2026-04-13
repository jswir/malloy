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
import {SankeyChart} from 'echarts/charts';
import {
  echarts,
  initChart,
  disposeChart,
  getChartSize,
  getBaseOption,
  mapToLinks,
  deepMerge,
  parseEchartsPassthrough,
  resolveTheme,
} from '../echarts-common';

echarts.use([SankeyChart]);

export const EchartSankeyPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_sankey',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_sankey',
      ownedPaths: [
        ['echart_sankey'],
        ['echart_sankey', 'colors'],
        ['echart_sankey', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_sankey');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Sankey: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (field: Field, pluginOptions?: unknown): DOMRenderPluginInstance => ({
      name: 'echart_sankey',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Sankey: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const dimFields = fields.filter(
          f => f.isString() || f.isTime() || f.isDate()
        );
        const measureField = fields.find(f => f.isNumber());
        if (dimFields.length < 2 || !measureField) {
          throw new Error(
            'EChart Sankey: requires 2 dimensions (source, target) and 1 measure'
          );
        }

        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);
        const linkData = mapToLinks(
          data.rows,
          dimFields[0],
          dimFields[1],
          measureField
        );

        const pluginTag = field.tag.tag('echart_sankey');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          series: [
            {
              type: 'sankey',
              layout: 'none',
              emphasis: {focus: 'adjacency'},
              data: linkData.nodes,
              links: linkData.links,
              lineStyle: {color: 'gradient', curveness: 0.5},
            },
          ],
        };

        const passthrough = parseEchartsPassthrough(pluginTag, 'echart_sankey');
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_sankey', field}),
    }),
  };
