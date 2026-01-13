/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  RenderPluginFactory,
  RenderProps,
  SolidJSRenderPluginInstance,
} from '@/api/plugin-types';
import {type Field, FieldType} from '@/data_tree';
import type {Tag} from '@malloydata/malloy-tag';
import type {JSXElement} from 'solid-js';
import {ProgressBarComponent} from './progress-bar-component';
import {
  type ProgressBarSettings,
  type ProgressBarVariant,
  type ProgressBarFormat,
  defaultProgressBarSettings,
} from './progress-bar-settings';
import {MalloyViz} from '@/api/malloy-viz';
import styles from './progress-bar.css?raw';

/**
 * Metadata returned by the Progress Bar plugin
 */
interface ProgressBarPluginMetadata {
  type: 'progress_bar';
  field: Field;
  settings: ProgressBarSettings;
}

/**
 * Progress Bar plugin instance type
 */
export interface ProgressBarPluginInstance
  extends SolidJSRenderPluginInstance<ProgressBarPluginMetadata> {
  field: Field;
}

/**
 * Extract Progress Bar settings from field tags
 */
function getProgressBarSettings(field: Field): ProgressBarSettings {
  const tag = field.tag;
  const progressBarTag = tag.tag('progress_bar');

  // Get label from # label or # progress_bar { label=... }
  const label = tag.text('label') || progressBarTag?.text('label');

  // Get max_field
  const maxField = progressBarTag?.text('max_field');

  // Get static max value
  const maxText = progressBarTag?.text('max');
  const max = maxText ? parseFloat(maxText) : defaultProgressBarSettings.max;

  // Get format
  const formatText = progressBarTag?.text('format');
  const format: ProgressBarFormat | undefined =
    formatText === 'percent' ||
    formatText === 'count' ||
    formatText === 'value'
      ? formatText
      : undefined;

  // Get static variant
  const variantText = progressBarTag?.text('variant');
  const variant: ProgressBarVariant =
    variantText === 'default' ||
    variantText === 'success' ||
    variantText === 'warning' ||
    variantText === 'error' ||
    variantText === 'neutral'
      ? variantText
      : defaultProgressBarSettings.variant;

  // Get variant_field
  const variantField = progressBarTag?.text('variant_field');

  return {
    label,
    maxField,
    max: isNaN(max) ? defaultProgressBarSettings.max : max,
    format,
    variant,
    variantField,
  };
}

/**
 * Progress Bar Plugin Factory
 *
 * Renders a horizontal progress bar for numeric values.
 *
 * Usage in Malloy:
 *   # progress_bar
 *   aggregate: quota_attainment  -- 0.75 renders as 75%
 *
 * With max_field:
 *   # progress_bar { max_field=tables_total }
 *   select: tables_indexed
 *
 * With variant:
 *   # progress_bar { variant='success' }
 *   aggregate: completion_rate
 */
export const ProgressBarPluginFactory: RenderPluginFactory<ProgressBarPluginInstance> =
  {
    name: 'progress_bar',

    /**
     * Match Number fields with the # progress_bar annotation
     */
    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      return fieldTag.has('progress_bar') && fieldType === FieldType.Number;
    },

    /**
     * Create a Progress Bar plugin instance
     */
    create: (field: Field): ProgressBarPluginInstance => {
      const settings = getProgressBarSettings(field);

      const pluginInstance: ProgressBarPluginInstance = {
        name: 'progress_bar',
        field,
        renderMode: 'solidjs',
        sizingStrategy: 'fill',

        /**
         * Render the Progress Bar component
         */
        renderComponent: (props: RenderProps): JSXElement => {
          // Add stylesheet
          MalloyViz.addStylesheet(styles);

          return (
            <ProgressBarComponent
              dataColumn={props.dataColumn}
              field={props.field}
              settings={settings}
            />
          );
        },

        /**
         * Return metadata about this plugin instance
         */
        getMetadata: (): ProgressBarPluginMetadata => ({
          type: 'progress_bar',
          field,
          settings,
        }),
      };

      return pluginInstance;
    },
  };
