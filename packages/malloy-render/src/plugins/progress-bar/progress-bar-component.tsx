/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {createMemo} from 'solid-js';
import type {Cell, Field} from '@/data_tree';
import {renderNumberCell} from '@/component/render-numeric-field';
import type {
  ProgressBarSettings,
  ProgressBarVariant,
  ProgressBarFormat,
} from './progress-bar-settings';

/**
 * Props for the ProgressBarComponent
 */
export interface ProgressBarComponentProps {
  dataColumn: Cell;
  field: Field;
  settings: ProgressBarSettings;
}

/**
 * Get a sibling cell value from the parent record
 */
function getSiblingValue(cell: Cell, fieldName: string): unknown {
  const parent = cell.parent;
  if (parent && 'column' in parent) {
    const siblingCell = (parent as {column: (name: string) => Cell}).column(
      fieldName
    );
    return siblingCell?.value;
  }
  return undefined;
}

/**
 * Format a number value for display
 */
function formatValue(cell: Cell): string {
  if (cell.isNumber()) {
    return renderNumberCell(cell);
  }
  return String(cell.value ?? '');
}

/**
 * Progress Bar Component
 *
 * Renders a horizontal progress bar with label and value display.
 */
export function ProgressBarComponent(props: ProgressBarComponentProps) {
  // Get the numeric value
  const value = createMemo(() => {
    const val = props.dataColumn.value;
    return typeof val === 'number' ? val : 0;
  });

  // Get max value from max_field or static max
  const maxValue = createMemo(() => {
    if (props.settings.maxField) {
      const siblingVal = getSiblingValue(
        props.dataColumn,
        props.settings.maxField
      );
      if (typeof siblingVal === 'number') {
        return siblingVal;
      }
    }
    return props.settings.max;
  });

  // Calculate percentage based on spec logic
  const percentage = createMemo(() => {
    const val = value();
    const max = maxValue();

    if (props.settings.maxField) {
      // max_field present: percentage = value / max_field_value
      return max > 0 ? (val / max) * 100 : 0;
    } else if (val <= 1) {
      // Value <= 1: treat as ratio (0.75 -> 75%)
      return val * 100;
    } else {
      // Value > 1: treat as percentage directly
      return val;
    }
  });

  // Clamp percentage for bar width (0-100)
  const clampedPercentage = createMemo(() => {
    return Math.min(100, Math.max(0, percentage()));
  });

  // Determine format based on spec logic
  const effectiveFormat = createMemo((): ProgressBarFormat => {
    if (props.settings.format) {
      return props.settings.format;
    }
    // Auto-detect: count if max_field present, otherwise percent
    return props.settings.maxField ? 'count' : 'percent';
  });

  // Get variant (static or from variant_field)
  const variant = createMemo((): ProgressBarVariant => {
    if (props.settings.variantField) {
      const siblingVal = getSiblingValue(
        props.dataColumn,
        props.settings.variantField
      );
      if (
        typeof siblingVal === 'string' &&
        ['default', 'success', 'warning', 'error', 'neutral'].includes(
          siblingVal
        )
      ) {
        return siblingVal as ProgressBarVariant;
      }
    }
    return props.settings.variant;
  });

  // Format the display value
  const displayValue = createMemo(() => {
    const fmt = effectiveFormat();
    const val = value();
    const max = maxValue();

    switch (fmt) {
      case 'count':
        return `${val} of ${max}`;
      case 'value':
        return formatValue(props.dataColumn);
      case 'percent':
      default:
        return `${Math.round(percentage())}%`;
    }
  });

  // Get label
  const label = createMemo(() => {
    return props.settings.label || props.field.name;
  });

  return (
    <div class="malloy-progress-bar-container">
      <div class="malloy-progress-bar-header">
        <span class="malloy-progress-bar-label">{label()}</span>
        <span class="malloy-progress-bar-value">{displayValue()}</span>
      </div>
      <div class={`malloy-progress-bar malloy-progress-bar--${variant()}`}>
        <div
          class="malloy-progress-bar-fill"
          style={{width: `${clampedPercentage()}%`}}
        />
      </div>
    </div>
  );
}
