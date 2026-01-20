/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {DocumentSymbol, SymbolKind} from 'vscode-languageserver';
import type {DocumentRange as MalloyDocumentRange} from '@malloydata/malloy';
import {malloyToLspRange} from './position';

/**
 * Internal Malloy DocumentSymbol interface.
 * Matches the shape returned by MalloyTranslator.metadata().symbols.
 */
interface MalloyDocumentSymbol {
  range: MalloyDocumentRange;
  type: string;
  name: string;
  children: MalloyDocumentSymbol[];
  lensRange?: MalloyDocumentRange;
}

/**
 * Map Malloy symbol types to LSP SymbolKind.
 */
function malloyTypeToSymbolKind(type: string): SymbolKind {
  switch (type) {
    case 'explore':
      return SymbolKind.Class;
    case 'query':
      return SymbolKind.Function;
    case 'unnamed_query':
      return SymbolKind.Function;
    case 'field':
      return SymbolKind.Field;
    case 'join':
      return SymbolKind.Interface;
    case 'import':
      return SymbolKind.Module;
    case 'import_item':
      return SymbolKind.Variable;
    default:
      return SymbolKind.Variable;
  }
}

/**
 * Convert a Malloy DocumentSymbol to an LSP DocumentSymbol.
 * Recursively converts children.
 */
export function malloySymbolToLspSymbol(
  sym: MalloyDocumentSymbol
): DocumentSymbol {
  const kind = malloyTypeToSymbolKind(sym.type);
  const range = malloyToLspRange(sym.range);

  return {
    name: sym.name,
    kind,
    range,
    selectionRange: range,
    children: sym.children.map(malloySymbolToLspSymbol),
  };
}

/**
 * Convert an array of Malloy DocumentSymbols to LSP DocumentSymbols.
 */
export function malloySymbolsToLspSymbols(
  symbols: MalloyDocumentSymbol[]
): DocumentSymbol[] {
  return symbols.map(malloySymbolToLspSymbol);
}
