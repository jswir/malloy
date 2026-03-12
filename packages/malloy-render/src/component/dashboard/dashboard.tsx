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
import {getFieldLabel} from '@/component/field-label-utils';

function DashboardItem(props: {
  field: Field;
  row: RecordCell;
  maxTableHeight: number | null;
  isMeasure?: boolean;
  spanOverride?: number;
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

  const title = getFieldLabel(props.field);
  const subtitle = props.field.tag.text('subtitle');
  const span = props.field.tag.numeric('span');

  const effectiveSpan = span ?? props.spanOverride;
  const gridColumnStyle: Record<string, string> = {};
  if (effectiveSpan) {
    gridColumnStyle['grid-column'] = `span ${effectiveSpan}`;
  }

  return (
    <div
      class="dashboard-item"
      classList={{
        'dashboard-item-measure': !!props.isMeasure,
        'dashboard-item-borderless': props.field.tag.has('borderless'),
      }}
      onClick={config.onClick ? handleClick : undefined}
      style={gridColumnStyle}
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
  const dashboardTag = field.tag.tag('dashboard');

  let maxTableHeight: number | null = 361;
  const maxTableHeightTag = dashboardTag?.tag('table', 'max_height');
  if (maxTableHeightTag?.text() === 'none') maxTableHeight = null;
  else if (maxTableHeightTag?.numeric())
    maxTableHeight = maxTableHeightTag!.numeric()!;

  const columns = dashboardTag?.numeric('columns');
  const gap = dashboardTag?.numeric('gap');

  const dashboardStyle = () => {
    const style: Record<string, string> = {};
    if (gap) style['--malloy-render--dashboard-gap'] = `${gap}px`;
    return style;
  };

  const getRowBodyStyle = () => {
    if (columns) return {'grid-template-columns': `repeat(${columns}, 1fr)`};
    return {'grid-template-columns': 'repeat(12, 1fr)'};
  };

  const getItemSpan = (f: Field) => {
    const explicit = f.tag.numeric('span');
    if (explicit) return explicit;
    if (f.isBasic() && f.wasCalculation()) return 3;
    if (f.isNest()) {
      const childCount = f.fields.filter(c => !c.isHidden()).length;
      if (childCount <= 3) return 4;
      if (childCount <= 5) return 6;
      return 8;
    }
    return 6;
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
      if (f.tag.has('break')) {
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
                              {getFieldLabel(d)}
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
                      <div class="dashboard-row-body" style={getRowBodyStyle()}>
                        <For each={group}>
                          {field => (
                            <DashboardItem
                              field={field}
                              row={props.data.rows[virtualRow.index]}
                              isMeasure={field.wasCalculation()}
                              maxTableHeight={maxTableHeight}
                              spanOverride={getItemSpan(field)}
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
                          {getFieldLabel(d)}
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
                  <div class="dashboard-row-body" style={getRowBodyStyle()}>
                    <For each={group}>
                      {field => (
                        <DashboardItem
                          field={field}
                          row={row}
                          isMeasure={field.wasCalculation()}
                          maxTableHeight={maxTableHeight}
                          spanOverride={getItemSpan(field)}
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
