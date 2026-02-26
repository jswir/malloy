/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Tag} from '@malloydata/malloy-tag';
import type {Accessor, Setter} from 'solid-js';
import {
  Show,
  createContext,
  createMemo,
  createSignal,
  useContext,
  ErrorBoundary,
} from 'solid-js';
import {getResultMetadata} from './render-result-metadata';
import {MalloyViz} from '@/api/malloy-viz';
import styles from './render.css?raw';
import darkModeStyles from './dark-mode.css?raw';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used as a directive in JSX
import {resize} from './util';
import {applyRenderer} from '@/component/renderer/apply-renderer';
import type {
  DashboardConfig,
  DrillData,
  MalloyClickEventPayload,
  TableConfig,
  VegaConfigHandler,
} from './types';
export type {DrillData} from './types';
import type * as Malloy from '@malloydata/malloy-interfaces';
import {getDataTree} from '../data_tree';
import {ResultContext} from './result-context';
import {ErrorMessage} from './error-message/error-message';
import type {RenderFieldMetadata} from '../render-field-metadata';
import {THEME_CSS_PROPERTIES, toKebabCase} from './theme';
import type {MalloyTheme} from './theme';

export type MalloyRenderProps = {
  result?: Malloy.Result;
  element: HTMLElement;
  scrollEl?: HTMLElement;
  modalElement?: HTMLElement;
  theme?: MalloyTheme;
  onClick?: (payload: MalloyClickEventPayload) => void;
  onDrill?: (drillData: DrillData) => void;
  onError?: (error: Error) => void;
  vegaConfigOverride?: VegaConfigHandler;
  tableConfig?: Partial<TableConfig>;
  dashboardConfig?: Partial<DashboardConfig>;
  renderFieldMetadata: RenderFieldMetadata;
  useVegaInterpreter?: boolean;
};

const ConfigContext = createContext<{
  tableConfig: Accessor<TableConfig>;
  dashboardConfig: Accessor<DashboardConfig>;
  onClick?: (payload: MalloyClickEventPayload) => void;
  onDrill?: (drillData: DrillData) => void;
  vegaConfigOverride?: VegaConfigHandler;
  modalElement?: HTMLElement;
}>();

export const useConfig = () => {
  const config = useContext(ConfigContext);
  if (!config)
    throw new Error(
      'ConfigContext missing a value; did you provide a ConfigProvider?'
    );
  return config;
};

export function MalloyRender(props: MalloyRenderProps) {
  MalloyViz.addStylesheet(styles);
  MalloyViz.addStylesheet(darkModeStyles);
  const tableConfig: Accessor<TableConfig> = () =>
    Object.assign(
      {
        disableVirtualization: false,
        rowLimit: Infinity,
        shouldFillWidth: false,
        enableDrill: false,
      },
      props.tableConfig
    );

  const dashboardConfig: Accessor<DashboardConfig> = () =>
    Object.assign(
      {
        disableVirtualization: false,
      },
      props.dashboardConfig
    );

  return (
    <ErrorBoundary
      fallback={errorProps => {
        const message = () => errorProps.error?.message ?? errorProps;
        props?.onError?.(errorProps);
        return <ErrorMessage message={message()} />;
      }}
    >
      <Show when={props.result}>
        <ConfigContext.Provider
          value={{
            onClick: props.onClick,
            onDrill: props.onDrill,
            vegaConfigOverride: props.vegaConfigOverride,
            tableConfig,
            dashboardConfig,
            modalElement: props.modalElement,
          }}
        >
          <MalloyRenderInner
            result={props.result!}
            element={props.element}
            scrollEl={props.scrollEl}
            theme={props.theme}
            vegaConfigOverride={props.vegaConfigOverride}
            renderFieldMetadata={props.renderFieldMetadata}
            useVegaInterpreter={props.useVegaInterpreter}
          />
        </ConfigContext.Provider>
      </Show>
    </ErrorBoundary>
  );
}
// Prevent charts from growing unbounded as they autofill
const CHART_SIZE_BUFFER = 4;
export function MalloyRenderInner(props: {
  result: Malloy.Result;
  element: HTMLElement;
  scrollEl?: HTMLElement;
  theme?: MalloyTheme;
  vegaConfigOverride?: VegaConfigHandler;
  renderFieldMetadata: RenderFieldMetadata;
  useVegaInterpreter?: boolean;
}) {
  const [parentSize, setParentSize] = createSignal({
    width: 0,
    height: 0,
  });

  // This is where chart rendering happens for now
  // If size in fill mode, easiest thing would be to just recalculate entire thing
  // This is expensive but we can optimize later to make size responsive
  const rootCell = createMemo(() => {
    return getDataTree(props.result, props.renderFieldMetadata);
  });

  const tags = () => {
    const modelTag = rootCell().field.modelTag;
    const resultTag = rootCell().field.tag;
    const modelTheme = modelTag.tag('theme');
    const localTheme = resultTag.tag('theme');
    return {
      modelTag,
      resultTag,
      modelTheme,
      localTheme,
    };
  };

  const isDarkMode = () => {
    const localMode = tags().localTheme?.text('mode');
    const modelMode = tags().modelTheme?.text('mode');
    const jsMode = props.theme?.mode;
    const mode = localMode ?? modelMode ?? jsMode ?? 'auto';

    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    // mode === 'auto': detect system preference
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  };

  const metadata = createMemo(() => {
    // TODO Do we even need this anymore...
    const resultMetadata = getResultMetadata(rootCell().field, {
      renderFieldMetadata: props.renderFieldMetadata,
      getVegaConfigOverride: props.vegaConfigOverride,
      parentSize: {
        width: parentSize().width - CHART_SIZE_BUFFER,
        height: parentSize().height - CHART_SIZE_BUFFER,
      },
      useVegaInterpreter: props.useVegaInterpreter,
    });

    // Set theme info on metadata so plugins can access it
    resultMetadata.isDarkMode = isDarkMode();
    const modelThemeTag = tags().modelTheme;
    const colorScheme =
      props.theme?.colorScheme ?? modelThemeTag?.text('colorScheme');
    const colors =
      props.theme?.colors ?? modelThemeTag?.textArray('colors');
    if (colorScheme || colors) {
      resultMetadata.themeColors = {
        colorScheme: colorScheme ?? undefined,
        colors: colors ?? undefined,
      };
    }

    // Collect style overrides from plugins
    const styleOverrides: Record<string, string> = {};
    props.renderFieldMetadata?.getAllFields().forEach(field => {
      const plugins =
        props.renderFieldMetadata?.getPluginsForField(field.key) ?? [];
      plugins.forEach(plugin => {
        plugin.beforeRender?.(resultMetadata, {
          renderFieldMetadata: props.renderFieldMetadata,
          getVegaConfigOverride: props.vegaConfigOverride,
          parentSize: {
            width: parentSize().width - CHART_SIZE_BUFFER,
            height: parentSize().height - CHART_SIZE_BUFFER,
          },
          useVegaInterpreter: props.useVegaInterpreter,
        });

        // Collect style overrides from plugin
        if (plugin.getStyleOverrides) {
          Object.assign(styleOverrides, plugin.getStyleOverrides());
        }
      });
    });

    resultMetadata.styleOverrides = styleOverrides;

    return resultMetadata;
  });

  // hack to block resize events when we're in fixed mode.
  // TODO as part of plugin system, move sizing strategy into data_tree metadata creation
  const _setParentSize: Setter<{width: number; height: number}> = value => {
    if (metadata().sizingStrategy === 'fixed') return;

    const newSize = typeof value === 'function' ? value(parentSize()) : value;

    setParentSize({
      width: newSize.width - CHART_SIZE_BUFFER,
      height: newSize.height - CHART_SIZE_BUFFER,
    });
  };

  const style = () => {
    const baseStyles = generateThemeStyle(
      tags().modelTheme,
      tags().localTheme,
      props.theme
    );
    const overrideStyles = Object.entries(metadata().styleOverrides)
      .map(([key, value]) => `${key}: ${value};`)
      .join('\n');
    return baseStyles + overrideStyles;
  };

  const rendering = () => {
    const data = rootCell();

    // Hack to force re-render on resize, since stored in metadata. Would be better to make direct dependency to size
    metadata();

    return applyRenderer({
      dataColumn: data,
      tag: data.field.tag,
      customProps: {
        table: {
          scrollEl: props.scrollEl,
        },
        dashboard: {
          scrollEl: props.scrollEl,
        },
      },
    });
  };

  const showRendering = () => {
    if (metadata().sizingStrategy === 'fixed') return true;
    if (
      metadata().sizingStrategy === 'fill' &&
      parentSize().width > 0 &&
      parentSize().height > 0
    ) {
      return true;
    }
    return false;
  };

  return (
    <div
      class="malloy-render"
      classList={{'malloy-dark': isDarkMode()}}
      style={style()}
      use:resize={[parentSize, _setParentSize]}
    >
      <Show when={showRendering()}>
        <ResultContext.Provider value={metadata}>
          {rendering().renderValue}
        </ResultContext.Provider>
        <Show when={metadata().store.store.showCopiedModal}>
          <div class="malloy-copied-modal">Copied query to clipboard!</div>
        </Show>
      </Show>
    </div>
  );
}

/**
 * Generate inline CSS style string that sets --malloy-render--* variables.
 * Priority: local tag > model tag > JS theme object > CSS variable default.
 */
function generateThemeStyle(
  modelTheme?: Tag,
  localTheme?: Tag,
  jsTheme?: MalloyTheme
) {
  return THEME_CSS_PROPERTIES.map(prop => {
    const kebab = toKebabCase(prop);
    const value =
      localTheme?.text(prop) ??
      modelTheme?.text(prop) ??
      (jsTheme?.[prop] as string | undefined) ??
      `var(--malloy-theme--${kebab})`;
    return `--malloy-render--${kebab}: ${value};`;
  }).join('\n');
}
