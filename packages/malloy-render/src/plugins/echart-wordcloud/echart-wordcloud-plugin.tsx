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
import 'echarts-wordcloud';
import {
  initChart,
  disposeChart,
  getChartSize,
  getBaseOption,
  mapToNameValue,
  deepMerge,
  parseEchartsPassthrough,
  resolveTheme,
} from '../echarts-common';

export const EchartWordcloudPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_wordcloud',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_wordcloud',
      ownedPaths: [
        ['echart_wordcloud'],
        ['echart_wordcloud', 'colors'],
        ['echart_wordcloud', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_wordcloud');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Word Cloud: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (field: Field, pluginOptions?: unknown): DOMRenderPluginInstance => ({
      name: 'echart_wordcloud',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Word Cloud: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const dimField = fields.find(
          f => f.isString() || f.isTime() || f.isDate()
        );
        const measureField = fields.find(f => f.isNumber());
        if (!dimField || !measureField) {
          throw new Error(
            'EChart Word Cloud: requires 1 dimension and 1 measure'
          );
        }

        const {width, height} = getChartSize(field);
        const chart = initChart(container, width, height);
        const chartData = mapToNameValue(data.rows, dimField, measureField);

        const pluginTag = field.tag.tag('echart_wordcloud');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          series: [
            {
              type: 'wordCloud',
              shape: 'circle',
              sizeRange: [12, 60],
              rotationRange: [-45, 45],
              rotationStep: 45,
              gridSize: 8,
              textStyle: {
                fontFamily:
                  'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                fontWeight: 'bold',
                color: () => {
                  const colors = [
                    '#4285F4',
                    '#EA4335',
                    '#FBBC04',
                    '#34A853',
                    '#FF6D01',
                    '#46BDC6',
                    '#7B61FF',
                  ];
                  return colors[Math.floor(Math.random() * colors.length)];
                },
              },
              data: chartData,
            },
          ],
        };

        const passthrough = parseEchartsPassthrough(
          pluginTag,
          'echart_wordcloud'
        );
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_wordcloud', field}),
    }),
  };
