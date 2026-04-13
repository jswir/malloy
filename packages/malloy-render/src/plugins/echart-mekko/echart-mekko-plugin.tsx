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
import type {RecordCell} from '@/data_tree';
import type {Tag} from '@malloydata/malloy-tag';
import {CustomChart} from 'echarts/charts';
import {
  echarts,
  initChart,
  disposeChart,
  getChartSize,
  getBaseOption,
  formatNumber,
  deepMerge,
  parseEchartsPassthrough,
  resolveTheme,
  ECHART_COLORS,
} from '../echarts-common';

echarts.use([CustomChart]);

interface MekkoColumn {
  name: string;
  total: number;
  segments: {name: string; value: number}[];
}

function buildColumnsFlat(
  rows: RecordCell[],
  colField: Field,
  segField: Field,
  measureField: Field
): MekkoColumn[] {
  const colMap = new Map<string, Map<string, number>>();
  const colOrder: string[] = [];
  for (const row of rows) {
    const col = String(row.column(colField.name).value ?? '');
    const seg = String(row.column(segField.name).value ?? '');
    const val = (row.column(measureField.name).value as number) ?? 0;
    if (!colMap.has(col)) {
      colMap.set(col, new Map());
      colOrder.push(col);
    }
    const segments = colMap.get(col)!;
    segments.set(seg, (segments.get(seg) ?? 0) + val);
  }
  return colOrder.map(col => {
    const segments = colMap.get(col)!;
    const segArr = Array.from(segments.entries()).map(([name, value]) => ({
      name,
      value,
    }));
    const total = segArr.reduce((s, e) => s + e.value, 0);
    return {name: col, total, segments: segArr};
  });
}

function buildColumnsNested(
  rows: RecordCell[],
  colDimField: Field,
  colMeasureField: Field,
  nestField: Field
): MekkoColumn[] {
  return rows.map(row => {
    const name = String(row.column(colDimField.name).value ?? '');
    const total = (row.column(colMeasureField.name).value as number) ?? 0;
    const nestCell = row.column(nestField.name);
    const segments: {name: string; value: number}[] = [];
    if (nestCell.isRepeatedRecord()) {
      const nf = nestCell.field.fields;
      const segDim = nf.find(f => f.isString() || f.isTime() || f.isDate());
      const segMeasure = nf.find(f => f.isNumber());
      if (segDim && segMeasure) {
        for (const nRow of nestCell.rows) {
          segments.push({
            name: String(nRow.column(segDim.name).value ?? ''),
            value: (nRow.column(segMeasure.name).value as number) ?? 0,
          });
        }
      }
    }
    return {name, total, segments};
  });
}

export const EchartMekkoPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
  {
    name: 'echart_mekko',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'echart_mekko',
      ownedPaths: [
        ['echart_mekko'],
        ['echart_mekko', 'labels'],
        ['echart_mekko', 'colors'],
        ['echart_mekko', 'echarts'],
      ],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('echart_mekko');
      if (hasTag && fieldType !== FieldType.RepeatedRecord) {
        throw new Error(
          'EChart Mekko: field must be a nested query (repeated record).'
        );
      }
      return hasTag;
    },

    create: (
      field: Field,
      pluginOptions?: unknown
    ): DOMRenderPluginInstance => ({
      name: 'echart_mekko',
      field,
      renderMode: 'dom',
      sizingStrategy: 'fixed',

      renderToDOM: (container: HTMLElement, props: RenderProps): void => {
        if (!props.dataColumn.isRepeatedRecord()) {
          throw new Error('EChart Mekko: data is not a repeated record');
        }
        const data = props.dataColumn;
        const fields = data.field.fields;
        const dimFields = fields.filter(
          f => f.isString() || f.isTime() || f.isDate()
        );
        const measureFields = fields.filter(f => f.isNumber());
        const nestField = fields.find(f => f.isNest?.());

        const pluginTag = field.tag.tag('echart_mekko');
        const theme = resolveTheme(pluginOptions, pluginTag?.text('colors'));
        const labelMode = pluginTag?.text('labels') ?? 'value';

        let columns: MekkoColumn[];
        if (nestField && dimFields.length >= 1 && measureFields.length >= 1) {
          columns = buildColumnsNested(
            data.rows,
            dimFields[0],
            measureFields[0],
            nestField
          );
        } else if (dimFields.length >= 2 && measureFields.length >= 1) {
          columns = buildColumnsFlat(
            data.rows,
            dimFields[0],
            dimFields[1],
            measureFields[0]
          );
        } else {
          throw new Error(
            'EChart Mekko: requires 2 dimensions + 1 measure, or 1 dimension + 1 measure + 1 nested query'
          );
        }

        const {width: chartWidth, height: chartHeight} = getChartSize(field);
        const chart = initChart(container, chartWidth, chartHeight);

        const grandTotal = columns.reduce((s, c) => s + c.total, 0);
        if (grandTotal === 0) {
          chart.setOption({...getBaseOption(theme)});
          return;
        }

        const allSegNames = new Set<string>();
        for (const col of columns) {
          for (const seg of col.segments) allSegNames.add(seg.name);
        }
        const segmentNames = Array.from(allSegNames);
        const colors = theme?.colors ?? ECHART_COLORS;
        const hasLegend = segmentNames.length > 1 && segmentNames.length <= 12;

        // Pre-compute data-space layout for each cell.
        // X-axis: 0..grandTotal (cumulative column widths)
        // Y-axis: 0..100 (percentage within each column, 0=top, 100=bottom)
        interface CellData {
          x0: number;
          x1: number;
          y0: number;
          y1: number;
          colName: string;
          segName: string;
          value: number;
          colTotal: number;
          segPct: number;
          colorIdx: number;
        }
        const cells: CellData[] = [];

        let xCursor = 0;
        for (const col of columns) {
          const colSegTotal = col.segments.reduce((s, e) => s + e.value, 0);
          let yCursor = 0;
          for (const seg of col.segments) {
            const segPct = colSegTotal > 0 ? seg.value / colSegTotal : 0;
            const segH = segPct * 100;
            cells.push({
              x0: xCursor,
              x1: xCursor + col.total,
              y0: yCursor,
              y1: yCursor + segH,
              colName: col.name,
              segName: seg.name,
              value: seg.value,
              colTotal: col.total,
              segPct,
              colorIdx: segmentNames.indexOf(seg.name) % colors.length,
            });
            yCursor += segH;
          }
          xCursor += col.total;
        }

        // Each data row encodes: [x0, x1, y0, y1, cellIndex]
        const renderData = cells.map((c, i) => [c.x0, c.x1, c.y0, c.y1, i]);

        // Build x-axis tick positions and labels (center of each column)
        const xTickPositions: number[] = [];
        const xTickLabels: string[] = [];
        let cumX = 0;
        for (const col of columns) {
          const mid = cumX + col.total / 2;
          xTickPositions.push(mid);
          const widthPct = ((col.total / grandTotal) * 100).toFixed(0);
          xTickLabels.push(`${col.name}\n${formatNumber(col.total)} (${widthPct}%)`);
          cumX += col.total;
        }

        const coordApi = (api: {
          coord: (val: number[]) => number[];
          size: (val: number[]) => number[];
        }) => api;

        const renderItem = (
          params: {dataIndex: number},
          api: unknown
        ): Record<string, unknown> => {
          const raw = renderData[params.dataIndex];
          if (!raw) return {type: 'group', children: []};
          const cell = cells[raw[4]];
          if (!cell) return {type: 'group', children: []};

          const a = coordApi(
            api as {
              coord: (val: number[]) => number[];
              size: (val: number[]) => number[];
            }
          );
          const topLeft = a.coord([cell.x0, cell.y0]);
          const bottomRight = a.coord([cell.x1, cell.y1]);

          const px = topLeft[0] + 1;
          const py = topLeft[1];
          const pw = Math.max(bottomRight[0] - topLeft[0] - 2, 0);
          const ph = Math.max(bottomRight[1] - topLeft[1], 0);

          const children: Record<string, unknown>[] = [
            {
              type: 'rect',
              shape: {x: px, y: py, width: pw, height: ph},
              style: {
                fill: colors[cell.colorIdx],
                stroke: '#fff',
                lineWidth: 1,
              },
            },
          ];

          if (labelMode !== 'none' && ph > 18 && pw > 30) {
            let text = cell.segName;
            if (labelMode === 'percent') {
              text += `\n${(cell.segPct * 100).toFixed(0)}%`;
            } else if (labelMode === 'both') {
              text += `\n${formatNumber(cell.value)} (${(cell.segPct * 100).toFixed(0)}%)`;
            } else {
              text += `\n${formatNumber(cell.value)}`;
            }
            children.push({
              type: 'text',
              style: {
                x: px + pw / 2,
                y: py + ph / 2,
                text,
                fill: '#fff',
                fontSize: 10,
                fontWeight: 'bold',
                textAlign: 'center',
                textVerticalAlign: 'middle',
                overflow: 'truncate',
                width: pw - 4,
              },
            });
          }

          return {type: 'group', children};
        };

        let option: Record<string, unknown> = {
          ...getBaseOption(theme),
          grid: {
            top: hasLegend ? 35 : 15,
            bottom: 55,
            left: 50,
            right: 15,
          },
          tooltip: {
            trigger: 'item',
            formatter: (params: {data: number[]}) => {
              const idx = params.data[4];
              const cell = cells[idx];
              if (!cell) return '';
              return `<b>${cell.colName}</b><br/>${cell.segName}: ${formatNumber(cell.value)} (${(cell.segPct * 100).toFixed(1)}%)`;
            },
          },
          legend: {
            show: hasLegend,
            top: 0,
            type: 'scroll',
            data: segmentNames.map((name, i) => ({
              name,
              itemStyle: {color: colors[i % colors.length]},
            })),
          },
          xAxis: {
            type: 'value',
            min: 0,
            max: grandTotal,
            axisLabel: {
              formatter: (_v: number, idx: number) =>
                idx < xTickLabels.length ? xTickLabels[idx] : '',
              interval: 0,
              customValues: xTickPositions,
              lineHeight: 14,
            },
            axisTick: {show: false},
            splitLine: {show: false},
            axisLine: {show: true, lineStyle: {color: '#ddd'}},
          },
          yAxis: {
            type: 'value',
            min: 0,
            max: 100,
            axisLabel: {formatter: (v: number) => `${v}%`},
            splitLine: {lineStyle: {color: '#f0f0f0'}},
            axisLine: {show: false},
            axisTick: {show: false},
          },
          series: [
            {
              type: 'custom',
              renderItem,
              data: renderData,
              encode: {x: [0, 1], y: [2, 3], tooltip: [4]},
            },
          ],
        };

        const passthrough = parseEchartsPassthrough(
          pluginTag,
          'echart_mekko'
        );
        if (passthrough) option = deepMerge(option, passthrough);

        chart.setOption(option);
      },

      cleanup: (container: HTMLElement): void => {
        disposeChart(container);
      },

      getMetadata: () => ({type: 'echart_mekko', field}),
    }),
  };
