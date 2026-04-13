/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Field, RecordCell} from '@/data_tree';

export interface NameValueItem {
  name: string;
  value: number;
}

export interface TreeNode {
  name: string;
  value: number;
  children?: TreeNode[];
}

export interface LinkData {
  nodes: {name: string}[];
  links: {source: string; target: string; value: number}[];
}

export function mapToNameValue(
  rows: RecordCell[],
  nameField: Field,
  valueField: Field
): NameValueItem[] {
  return rows.map(row => ({
    name: String(row.column(nameField.name).value ?? ''),
    value: (row.column(valueField.name).value as number) ?? 0,
  }));
}

export function mapToDataset(
  rows: RecordCell[],
  fields: Field[]
): Record<string, unknown>[] {
  return rows.map(row => {
    const record: Record<string, unknown> = {};
    for (const f of fields) {
      record[f.name] = row.column(f.name).value;
    }
    return record;
  });
}

export function mapToHierarchy(
  rows: RecordCell[],
  dimField: Field,
  measureField: Field,
  nestField?: Field
): TreeNode[] {
  return rows.map(row => {
    const node: TreeNode = {
      name: String(row.column(dimField.name).value ?? ''),
      value: (row.column(measureField.name).value as number) ?? 0,
    };
    if (nestField) {
      const nestCell = row.column(nestField.name);
      if (nestCell.isRepeatedRecord()) {
        const childFields = nestCell.field.fields;
        const childDim = childFields.find(
          f => f.isString() || f.isTime() || f.isDate()
        );
        const childMeasure = childFields.find(f => f.isNumber());
        const childNest = childFields.find(f => f.isNest?.());
        if (childDim && childMeasure) {
          node.children = mapToHierarchy(
            nestCell.rows,
            childDim,
            childMeasure,
            childNest
          );
        }
      }
    }
    return node;
  });
}

export interface SeriesData {
  categories: string[];
  seriesNames: string[];
  seriesValues: Map<string, number[]>;
}

export function mapToSeriesData(
  rows: RecordCell[],
  categoryField: Field,
  seriesField: Field | undefined,
  measureFields: Field[]
): SeriesData {
  const categorySet: string[] = [];
  const categoryIndex = new Map<string, number>();
  const seriesValues = new Map<string, number[]>();

  if (seriesField) {
    for (const row of rows) {
      const cat = String(row.column(categoryField.name).value ?? '');
      if (!categoryIndex.has(cat)) {
        categoryIndex.set(cat, categorySet.length);
        categorySet.push(cat);
      }
    }
    for (const row of rows) {
      const cat = String(row.column(categoryField.name).value ?? '');
      const series = String(row.column(seriesField.name).value ?? '');
      const val =
        (row.column(measureFields[0].name).value as number) ?? 0;
      if (!seriesValues.has(series)) {
        seriesValues.set(series, new Array(categorySet.length).fill(0));
      }
      const arr = seriesValues.get(series)!;
      arr[categoryIndex.get(cat)!] = val;
    }
  } else {
    for (const row of rows) {
      const cat = String(row.column(categoryField.name).value ?? '');
      categorySet.push(cat);
    }
    for (const mf of measureFields) {
      const vals: number[] = [];
      for (const row of rows) {
        vals.push((row.column(mf.name).value as number) ?? 0);
      }
      seriesValues.set(mf.name, vals);
    }
  }

  return {
    categories: categorySet,
    seriesNames: Array.from(seriesValues.keys()),
    seriesValues,
  };
}

export function mapToLinks(
  rows: RecordCell[],
  sourceField: Field,
  targetField: Field,
  valueField: Field
): LinkData {
  const nodeSet = new Set<string>();
  const links = rows.map(row => {
    const source = String(row.column(sourceField.name).value ?? '');
    const target = String(row.column(targetField.name).value ?? '');
    nodeSet.add(source);
    nodeSet.add(target);
    return {
      source,
      target,
      value: (row.column(valueField.name).value as number) ?? 0,
    };
  });
  const nodes = Array.from(nodeSet).map(name => ({name}));
  return {nodes, links};
}
