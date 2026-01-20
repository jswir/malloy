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

import type {Position, Range} from 'vscode-languageserver';
import type {
  DocumentPosition as MalloyDocumentPosition,
  DocumentRange as MalloyDocumentRange,
} from '@malloydata/malloy';

/**
 * Convert a Malloy DocumentPosition to an LSP Position.
 * Both use 0-based line and character indices, so this is a direct mapping.
 */
export function malloyToLspPosition(pos: MalloyDocumentPosition): Position {
  return {
    line: pos.line,
    character: pos.character,
  };
}

/**
 * Convert an LSP Position to a Malloy DocumentPosition.
 * Both use 0-based line and character indices, so this is a direct mapping.
 */
export function lspToMalloyPosition(pos: Position): MalloyDocumentPosition {
  return {
    line: pos.line,
    character: pos.character,
  };
}

/**
 * Convert a Malloy DocumentRange to an LSP Range.
 */
export function malloyToLspRange(range: MalloyDocumentRange): Range {
  return {
    start: malloyToLspPosition(range.start),
    end: malloyToLspPosition(range.end),
  };
}

/**
 * Convert an LSP Range to a Malloy DocumentRange.
 */
export function lspToMalloyRange(range: Range): MalloyDocumentRange {
  return {
    start: lspToMalloyPosition(range.start),
    end: lspToMalloyPosition(range.end),
  };
}

/**
 * Create a zero-position Range (used when exact location is unknown).
 */
export function zeroRange(): Range {
  return {
    start: {line: 0, character: 0},
    end: {line: 0, character: 0},
  };
}
