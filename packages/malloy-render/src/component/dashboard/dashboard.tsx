/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {For, Show} from 'solid-js';
import {applyRenderer} from '@/component/renderer/apply-renderer';
import type {Virtualizer} from '@tanstack/solid-virtual';
import {createVirtualizer} from '@tanstack/solid-virtual';
import type {Field, RecordCell, RecordOrRepeatedRecordCell} from '@/data_tree';
import {MalloyViz} from '@/api/malloy-viz';
import styles from './dashboard.css?raw';
import {useConfig} from '../render';
import type {DashboardNestConfig} from '@/component/tag-configs';

function DashboardItem(props: {
  field: Field;
  row: RecordCell;
  maxTableHeight: number | null;
  isMeasure?: boolean;
}) {
  const config = useConfig();
  const shouldVirtualizeTable = () => {
    if (config.dashboardConfig().disableVirtualization) return false;
    else if (props.maxTableHeight) return true;
    else return false;
  };
  const cell = props.row.column(props.field.name);
  const rendering = applyRenderer({
    dataColumn: cell,
    customProps: {
      table: {
        disableVirtualization: !shouldVirtualizeTable(),
        shouldFillWidth: true,
      },
    },
  });

  const handleClick = (evt: MouseEvent) => {
    if (config.onClick)
      config.onClick({
        field: props.field,
        displayValue:
          typeof rendering.renderValue !== 'function'
            ? rendering.renderValue
            : null,
        value: cell.value,
        fieldPath: props.field.path,
        isHeader: false,
        event: evt,
        type: 'dashboard-item',
      });
  };

  const itemStyle = {};
  if (rendering.renderAs === 'table' && props.maxTableHeight)
    itemStyle['max-height'] = `${props.maxTableHeight}px`;

  const title = props.field.getLabel();
  const subtitle = props.field.getSubtitle();

  return (
    <div
      class="dashboard-item"
      classList={{
        'dashboard-item-measure': !!props.isMeasure,
        'dashboard-item-borderless': props.field.isBorderless(),
      }}
      onClick={config.onClick ? handleClick : undefined}
    >
      <div class="dashboard-item-header">
        <div class="dashboard-item-title">{title}</div>
        <Show when={subtitle}>
          <div class="dashboard-item-subtitle">{subtitle}</div>
        </Show>
      </div>
      <div
        class="dashboard-item-value"
        classList={{
          'dashboard-item-value-measure': props.isMeasure,
        }}
        style={itemStyle}
      >
        {rendering.renderValue}
      </div>
    </div>
  );
}

export function Dashboard(props: {
  data: RecordOrRepeatedRecordCell;
  scrollEl?: HTMLElement;
}) {
  MalloyViz.addStylesheet(styles);
  const field = props.data.field;
  const dashConfig = field.getTagConfig<DashboardNestConfig>();

  // resolveDashboardTags always returns a config; 361 fallback is a safety net
  // for unexpected undefined. Preserve null (means "no limit, no virtualization").
  const maxTableHeight =
    dashConfig !== undefined ? dashConfig.maxTableHeight : 361;
  const columns = dashConfig?.columns;
  const gap = dashConfig?.gap;
  const gapPx = gap ?? 16;

  const dashboardStyle = () => {
    const style: Record<string, string> = {};
    if (gap !== undefined) style['--malloy-render--dashboard-gap'] = `${gap}px`;
    return style;
  };

  const useGrid = (() => {
    if (columns !== undefined || gap !== undefined) return true;
    return field.fields.some(
      f =>
        !f.isHidden() &&
        !(f.isBasic() && f.wasDimension()) &&
        (f.getSpan() !== undefined || f.hasBreak())
    );
  })();

  const getColumnsStyle = () => {
    if (columns === undefined) return {};
    return {'grid-template-columns': `repeat(${columns}, 1fr)`};
  };

  // Minimum container width for columns mode: 120px per column + gaps
  const columnsMinWidth = columns !== undefined
    ? columns * 120 + (columns - 1) * gapPx
    : 0;

  // Compute the effective span for a field
  const computeSpan = (f: Field): number => {
    const explicit = f.getSpan();
    if (explicit !== undefined) return explicit;
    if (f.isBasic() && f.wasCalculation()) return 3;
    if (f.isNest()) {
      const visibleChildren = f.fields.filter(c => !c.isHidden());
      const weight = visibleChildren.reduce(
        (sum, c) => sum + (c.isNest() ? 3 : 1),
        0
      );
      if (weight <= 3) return 4;
      if (weight <= 5) return 6;
      if (weight <= 8) return 8;
      return 12;
    }
    return 6;
  };

  // Compute per-row grid config from the items' spans
  const getRowConfig = (group: Field[]) => {
    const spans = group.map(f => computeSpan(f));
    const totalSpan = spans.reduce((a, b) => a + b, 0);

    // Fractional template preserves proportions.
    // When totalSpan < 12, use percentage caps so items don't stretch to fill.
    const frTemplate = totalSpan >= 12
      ? spans.map(s => `${s}fr`).join(' ')
      : spans.map(s => `minmax(0, ${((s / 12) * 100).toFixed(1)}%)`).join(' ');

    // Minimum width per item based on content type
    const minWidths = group.map(f => {
      if (f.isBasic() && f.wasCalculation()) return 120;
      return 200;
    });
    const minRowWidth = minWidths.reduce((a, b) => a + b, 0)
      + (group.length - 1) * gapPx;

    const collapseClass = minRowWidth <= 400 ? 'row-collapse-sm'
      : minRowWidth <= 600 ? 'row-collapse-md'
      : 'row-collapse-lg';

    return {frTemplate, collapseClass};
  };

  const getRowStyle = (group: Field[]) => {
    if (!useGrid) return {};
    if (columns !== undefined) return getColumnsStyle();
    return {'grid-template-columns': getRowConfig(group).frTemplate};
  };

  const getRowClassList = (group: Field[]) => {
    const classes: Record<string, boolean> = {
      'dashboard-grid': useGrid,
      'dashboard-columns': columns !== undefined,
    };
    if (useGrid && columns === undefined) {
      classes[getRowConfig(group).collapseClass] = true;
    }
    if (columns !== undefined) {
      // Bucket the columns collapse threshold
      const cls = columnsMinWidth <= 400 ? 'row-collapse-sm'
        : columnsMinWidth <= 600 ? 'row-collapse-md'
        : 'row-collapse-lg';
      classes[cls] = true;
    }
    return classes;
  };

  const dimensions = () =>
    field.fields.filter(f => {
      return !f.isHidden() && f.isBasic() && f.wasDimension();
    });

  const nonDimensions = () => {
    const measureFields: Field[] = [];
    const otherFields: Field[] = [];

    for (const f of field.fields) {
      if (f.isHidden()) continue;
      if (f.isBasic() && f.wasCalculation()) {
        measureFields.push(f);
      } else if (!f.isBasic() || !f.wasDimension()) otherFields.push(f);
    }
    return [...measureFields, ...otherFields];
  };

  const nonDimensionsGrouped = () => {
    const group: Field[][] = [[]];
    for (const f of nonDimensions()) {
      if (f.hasBreak()) {
        group.push([]);
      }
      const lastGroup = group.at(-1)!;
      lastGroup.push(f);
    }
    return group;
  };

  let scrollEl!: HTMLElement;
  if (props.scrollEl) scrollEl = props.scrollEl;
  const shouldVirtualize = () =>
    !useConfig().dashboardConfig().disableVirtualization;
  let virtualizer: Virtualizer<HTMLElement, Element> | undefined;
  if (shouldVirtualize()) {
    virtualizer = createVirtualizer({
      count: props.data.rows.length,
      getScrollElement: () => scrollEl,
      estimateSize: () => 192,
    });
  }
  const items = virtualizer?.getVirtualItems();

  return (
    <div
      class="malloy-dashboard"
      style={dashboardStyle()}
      ref={el => {
        if (!props.scrollEl) scrollEl = el;
      }}
    >
      <Show when={shouldVirtualize()}>
        <div
          style={{
            height: virtualizer!.getTotalSize() + 'px',
            width: '100%',
            position: 'relative',
          }}
        >
          <div
            style={{
              'height': 'fit-content',
              'width': '100%',
              'padding-top': `${items![0]?.start ?? 0}px`,
            }}
          >
            <For each={items}>
              {virtualRow => (
                <div
                  class="dashboard-row"
                  data-index={virtualRow.index}
                  ref={el =>
                    queueMicrotask(() => virtualizer!.measureElement(el))
                  }
                >
                  <div class="dashboard-row-header">
                    <div class="dashboard-row-header-dimension-list">
                      <For each={dimensions()}>
                        {d => (
                          <div class="dashboard-dimension-wrapper">
                            <div class="dashboard-dimension-name">
                              {d.getLabel()}
                            </div>
                            <div class="dashboard-dimension-value">
                              {
                                applyRenderer({
                                  dataColumn: props.data.rows[
                                    virtualRow.index
                                  ].column(d.name),
                                }).renderValue
                              }
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                    <div class="dashboard-row-header-separator" />
                  </div>
                  <For each={nonDimensionsGrouped()}>
                    {group => (
                      <div
                        class="dashboard-row-body"
                        classList={getRowClassList(group)}
                        style={getRowStyle(group)}
                      >
                        <For each={group}>
                          {field => (
                            <DashboardItem
                              field={field}
                              row={props.data.rows[virtualRow.index]}
                              isMeasure={field.wasCalculation()}
                              maxTableHeight={maxTableHeight}
                            />
                          )}
                        </For>
                      </div>
                    )}
                  </For>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
      <Show when={!shouldVirtualize()}>
        <For each={props.data.rows}>
          {row => (
            <div class="dashboard-row">
              <div class="dashboard-row-header">
                <div class="dashboard-row-header-dimension-list">
                  <For each={dimensions()}>
                    {d => (
                      <div class="dashboard-dimension-wrapper">
                        <div class="dashboard-dimension-name">
                          {d.getLabel()}
                        </div>
                        <div class="dashboard-dimension-value">
                          {
                            applyRenderer({
                              dataColumn: row.column(d.name),
                            }).renderValue
                          }
                        </div>
                      </div>
                    )}
                  </For>
                </div>
                <div class="dashboard-row-header-separator" />
              </div>
              <For each={nonDimensionsGrouped()}>
                {group => (
                  <div
                    class="dashboard-row-body"
                    classList={getRowClassList(group)}
                    style={getRowStyle(group)}
                  >
                    <For each={group}>
                      {field => (
                        <DashboardItem
                          field={field}
                          row={row}
                          isMeasure={field.wasCalculation()}
                          maxTableHeight={maxTableHeight}
                        />
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
