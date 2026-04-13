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
import {GraphChart} from 'echarts/charts';
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

echarts.use([GraphChart]);

export const EchartGraphPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_graph',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_graph',
      ownedPaths: [
        ['echart_graph'],
        ['echart_graph', 'colors'],
        ['echart_graph', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_graph');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Graph: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (field: Field, pluginOptions?: unknown): DOMRenderPluginInstance => ({
      name: 'echart_graph',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Graph: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const dimFields = fields.filter(
          f => f.isString() || f.isTime() || f.isDate()
        );
        const measureField = fields.find(f => f.isNumber());
        if (dimFields.length < 2) {
          throw new Error(
            'EChart Graph: requires at least 2 dimensions (source, target)'
          );
        }

        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);

        const dummyMeasure = measureField ?? dimFields[0];
        const linkData = mapToLinks(
          data.rows,
          dimFields[0],
          dimFields[1],
          dummyMeasure
        );

        const graphNodes = linkData.nodes.map(n => ({
          name: n.name,
          symbolSize: 20,
          label: {show: true},
        }));

        const graphLinks = measureField
          ? linkData.links
          : linkData.links.map(l => ({...l, value: 1}));

        const pluginTag = field.tag.tag('echart_graph');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          series: [
            {
              type: 'graph',
              layout: 'force',
              roam: true,
              force: {repulsion: 100, edgeLength: [50, 200]},
              data: graphNodes,
              links: graphLinks,
              emphasis: {focus: 'adjacency'},
              lineStyle: {color: 'source', curveness: 0.3},
            },
          ],
        };

        const passthrough = parseEchartsPassthrough(pluginTag, 'echart_graph');
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_graph', field}),
    }),
  };
