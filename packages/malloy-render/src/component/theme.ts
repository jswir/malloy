/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Theme system for Malloy Renderer.
 *
 * Themes can be applied via:
 * 1. JS API: `new MalloyViz({ theme: 'dark' })` or `{ theme: { mode: 'dark', ... } }`
 * 2. Malloy tags: `## theme.mode=dark` (model-level) or `# theme.mode=dark` (view-level)
 * 3. CSS: override `--malloy-theme--*` variables on a parent element
 *
 * Priority order: local tag > model tag > JS theme > CSS variable default
 */

export interface MalloyTheme {
  mode?: 'light' | 'dark' | 'auto';

  // Global
  fontFamily?: string;
  background?: string;

  // Table
  tableRowHeight?: string;
  tableFontSize?: string;
  tableHeaderColor?: string;
  tableHeaderWeight?: string;
  tableBodyColor?: string;
  tableBodyWeight?: string;
  tableBorder?: string;
  tableBackground?: string;
  tableGutterSize?: string;
  tablePinnedBackground?: string;
  tablePinnedBorder?: string;
  tableHeaderBackground?: string;
  tableRowAlternateBackground?: string;

  // Dashboard
  dashboardBg?: string;
  dashboardCardBg?: string;
  dashboardCardRadius?: string;
  dashboardCardPadding?: string;
  dashboardTitleSize?: string;
  dashboardTitleWeight?: string;
  dashboardTitleColor?: string;
  dashboardValueSize?: string;

  // Chart
  chartAxisLabelColor?: string;
  chartAxisTitleColor?: string;
  chartGridColor?: string;
  chartBackground?: string;

  // Big Value
  bigValueCardBg?: string;
  bigValueCardBorder?: string;
  bigValueLabelColor?: string;
  bigValueDeltaPositive?: string;
  bigValueDeltaNegative?: string;
  bigValueDeltaNeutral?: string;

  // Color palette
  colorScheme?: string;
  colors?: string[];
}

export type ThemePreset = 'light' | 'dark' | 'midnight';

/**
 * All theme properties that map to CSS variables.
 * Each entry maps to:
 *   --malloy-theme--{kebab-case}  (default)
 *   --malloy-render--{kebab-case} (runtime override)
 */
export const THEME_CSS_PROPERTIES: (keyof MalloyTheme)[] = [
  // Global
  'fontFamily',
  'background',

  // Table
  'tableRowHeight',
  'tableFontSize',
  'tableHeaderColor',
  'tableHeaderWeight',
  'tableBodyColor',
  'tableBodyWeight',
  'tableBorder',
  'tableBackground',
  'tableGutterSize',
  'tablePinnedBackground',
  'tablePinnedBorder',
  'tableHeaderBackground',
  'tableRowAlternateBackground',

  // Dashboard
  'dashboardBg',
  'dashboardCardBg',
  'dashboardCardRadius',
  'dashboardCardPadding',
  'dashboardTitleSize',
  'dashboardTitleWeight',
  'dashboardTitleColor',
  'dashboardValueSize',

  // Chart
  'chartAxisLabelColor',
  'chartAxisTitleColor',
  'chartGridColor',
  'chartBackground',

  // Big Value
  'bigValueCardBg',
  'bigValueCardBorder',
  'bigValueLabelColor',
  'bigValueDeltaPositive',
  'bigValueDeltaNegative',
  'bigValueDeltaNeutral',
];

/**
 * Single source of truth for dark theme colors.
 * dark-mode.css must be kept in sync with these values.
 */
export const DARK_THEME: Partial<MalloyTheme> = {
  // Global
  background: '#141416',

  // Table
  tableBackground: '#1e1e20',
  tableBodyColor: '#d1d5db',
  tableHeaderColor: '#b0b5be',
  tableBodyWeight: '400',
  tableBorder: '1px solid #2d3038',
  tablePinnedBackground: '#252628',
  tablePinnedBorder: '1px solid #3a3d44',
  tableHeaderBackground: '#232427',
  tableRowAlternateBackground: '#232427',

  // Dashboard
  dashboardBg: '#141416',
  dashboardCardBg: '#1e1e20',
  dashboardTitleColor: '#9da1aa',

  // Chart
  chartBackground: '#1e1e20',
  chartAxisLabelColor: '#9da1aa',
  chartAxisTitleColor: '#9da1aa',
  chartGridColor: '#3a3d44',

  // Big Value
  bigValueCardBg: '#1e1e20',
  bigValueCardBorder: '#3a3d44',
  bigValueLabelColor: '#9da1aa',
  bigValueDeltaPositive: '#34d399',
  bigValueDeltaNegative: '#f87171',
  bigValueDeltaNeutral: '#6b7280',
};

/**
 * Midnight theme — a deeper, blue-tinted dark palette.
 */
export const MIDNIGHT_THEME: Partial<MalloyTheme> = {
  // Global
  background: '#0f172a',

  // Table
  tableBackground: '#1e293b',
  tableBodyColor: '#cbd5e1',
  tableHeaderColor: '#94a3b8',
  tableBodyWeight: '400',
  tableBorder: '1px solid #334155',
  tablePinnedBackground: '#1a2332',
  tablePinnedBorder: '1px solid #475569',
  tableHeaderBackground: '#172033',
  tableRowAlternateBackground: '#172033',

  // Dashboard
  dashboardBg: '#0f172a',
  dashboardCardBg: '#1e293b',
  dashboardTitleColor: '#94a3b8',

  // Chart
  chartBackground: '#1e293b',
  chartAxisLabelColor: '#94a3b8',
  chartAxisTitleColor: '#94a3b8',
  chartGridColor: '#334155',

  // Big Value
  bigValueCardBg: '#1e293b',
  bigValueCardBorder: '#334155',
  bigValueLabelColor: '#94a3b8',
  bigValueDeltaPositive: '#34d399',
  bigValueDeltaNegative: '#f87171',
  bigValueDeltaNeutral: '#64748b',
};

/**
 * Resolve a theme preset name or custom theme object into a MalloyTheme.
 */
export function resolveTheme(
  theme?: ThemePreset | MalloyTheme
): MalloyTheme | undefined {
  if (!theme) return undefined;
  if (typeof theme === 'string') {
    switch (theme) {
      case 'dark':
        return {mode: 'dark', ...DARK_THEME};
      case 'midnight':
        return {mode: 'dark', ...MIDNIGHT_THEME};
      case 'light':
        return {mode: 'light'};
      default:
        return undefined;
    }
  }
  return theme;
}

/**
 * Convert a camelCase property name to kebab-case.
 */
export function toKebabCase(prop: string): string {
  return prop.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
