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
import {TreeChart} from 'echarts/charts';
import {
  echarts,
  initChart,
  disposeChart,
  getChartSize,
  getBaseOption,
  mapToHierarchy,
  deepMerge,
  parseEchartsPassthrough,
  resolveTheme,
} from '../echarts-common';

echarts.use([TreeChart]);

export const EchartTreePluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_tree',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_tree',
      ownedPaths: [
        ['echart_tree'],
        ['echart_tree', 'orient'],
        ['echart_tree', 'colors'],
        ['echart_tree', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_tree');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Tree: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (field: Field, pluginOptions?: unknown): DOMRenderPluginInstance => ({
      name: 'echart_tree',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Tree: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const dimField = fields.find(
          f => f.isString() || f.isTime() || f.isDate()
        );
        const measureField = fields.find(f => f.isNumber());
        const nestField = fields.find(f => f.isNest?.());
        if (!dimField) {
          throw new Error('EChart Tree: requires at least 1 dimension');
        }

        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);

        const treeData = measureField
          ? mapToHierarchy(data.rows, dimField, measureField, nestField)
          : data.rows.map(row => ({
              name: String(row.column(dimField.name).value ?? ''),
              value: 0,
            }));

        const rootNode = {
          name: field.name,
          children: treeData,
        };

        const pluginTag = field.tag.tag('echart_tree');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));
        const orient = pluginTag?.text('orient') ?? 'LR';

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          series: [
            {
              type: 'tree',
              data: [rootNode],
              orient,
              label: {
                position: orient === 'LR' ? 'left' : 'top',
                verticalAlign: 'middle',
              },
              leaves: {label: {position: orient === 'LR' ? 'right' : 'bottom'}},
              expandAndCollapse: true,
              animationDuration: 400,
            },
          ],
        };

        const passthrough = parseEchartsPassthrough(pluginTag, 'echart_tree');
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_tree', field}),
    }),
  };
