/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export const ECHART_COLORS = [
  '#4285F4',
  '#EA4335',
  '#FBBC04',
  '#34A853',
  '#FF6D01',
  '#46BDC6',
  '#7B61FF',
  '#F538A0',
  '#185ABC',
  '#B31412',
];

const DEFAULT_FONT =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export interface EchartThemeOptions {
  colors?: string[];
  fontFamily?: string;
  fontSize?: number;
  backgroundColor?: string;
}

export function resolveTheme(
  pluginOptions?: unknown,
  tagColors?: string
): EchartThemeOptions {
  const opts = (pluginOptions ?? {}) as Record<string, unknown>;
  const theme: EchartThemeOptions = {};
  const colorsVal = opts['colors'];
  if (colorsVal && Array.isArray(colorsVal)) theme.colors = colorsVal;
  const fontVal = opts['fontFamily'];
  if (typeof fontVal === 'string') theme.fontFamily = fontVal;
  const sizeVal = opts['fontSize'];
  if (typeof sizeVal === 'number') theme.fontSize = sizeVal;
  const bgVal = opts['backgroundColor'];
  if (typeof bgVal === 'string') theme.backgroundColor = bgVal;
  if (tagColors) {
    theme.colors = tagColors.split(',').map(c => c.trim());
  }
  return theme;
}

export function getBaseOption(theme?: EchartThemeOptions): Record<string, unknown> {
  return {
    color: theme?.colors ?? ECHART_COLORS,
    backgroundColor: theme?.backgroundColor ?? 'transparent',
    textStyle: {
      fontFamily: theme?.fontFamily ?? DEFAULT_FONT,
      fontSize: theme?.fontSize ?? 12,
    },
    tooltip: {
      trigger: 'item',
      confine: true,
    },
    animation: true,
    animationDuration: 300,
  };
}
