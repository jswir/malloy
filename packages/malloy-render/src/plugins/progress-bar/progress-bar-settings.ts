/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {JSONSchemaObject} from '@/api/json-schema-types';

/**
 * Display format for the progress value
 */
export type ProgressBarFormat = 'percent' | 'count' | 'value';

/**
 * Color variant for the progress bar
 */
export type ProgressBarVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'neutral';

/**
 * Settings for the Progress Bar plugin
 */
export interface ProgressBarSettings extends Record<string, unknown> {
  /** Display label (from # label or # progress_bar { label=... }) */
  label?: string;
  /** Field name containing the maximum/target value */
  maxField?: string;
  /** Static maximum value (defaults to 100) */
  max: number;
  /** How to display the value */
  format?: ProgressBarFormat;
  /** Static color variant */
  variant: ProgressBarVariant;
  /** Field name to determine variant dynamically */
  variantField?: string;
}

/**
 * Default settings for the Progress Bar plugin
 */
export const defaultProgressBarSettings: ProgressBarSettings = {
  max: 100,
  variant: 'default',
};

/**
 * JSON Schema for Progress Bar settings
 */
export const progressBarSettingsSchema: JSONSchemaObject = {
  type: 'object',
  properties: {
    label: {
      type: 'string',
      description: 'Display label above the progress bar',
    },
    max_field: {
      type: 'string',
      description: 'Field name containing the maximum/target value',
    },
    max: {
      type: 'number',
      default: 100,
      description: 'Static maximum value (use max_field for dynamic)',
    },
    format: {
      type: 'string',
      enum: ['percent', 'count', 'value'],
      description:
        "How to display the value: 'percent' (75%), 'count' (4 of 7), or 'value' (raw)",
    },
    variant: {
      type: 'string',
      enum: ['default', 'success', 'warning', 'error', 'neutral'],
      default: 'default',
      description: 'Color variant for the progress bar',
    },
    variant_field: {
      type: 'string',
      description: 'Field name to determine variant dynamically',
    },
  },
};

/**
 * Type for the settings schema
 */
export type IProgressBarSettingsSchema = typeof progressBarSettingsSchema;
