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

import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
} from 'vscode-languageserver';

/**
 * Internal Malloy DocumentCompletion interface.
 * Matches the shape returned by MalloyTranslator.completions().
 */
interface MalloyDocumentCompletion {
  type: string;
  text: string;
}

/**
 * Map Malloy completion types to LSP CompletionItemKind.
 */
function malloyCompletionTypeToKind(type: string): CompletionItemKind {
  switch (type) {
    case 'explore_property':
      return CompletionItemKind.Property;
    case 'query_property':
      return CompletionItemKind.Method;
    case 'model_property':
      return CompletionItemKind.Keyword;
    default:
      return CompletionItemKind.Text;
  }
}

/**
 * Convert a Malloy DocumentCompletion to an LSP CompletionItem.
 */
export function malloyCompletionToLspItem(
  comp: MalloyDocumentCompletion
): CompletionItem {
  // Remove trailing ": " for the label display, but keep it in insertText
  const label = comp.text.replace(/:\s*$/, '');

  return {
    label,
    kind: malloyCompletionTypeToKind(comp.type),
    insertText: comp.text,
    insertTextFormat: InsertTextFormat.PlainText,
  };
}

/**
 * Convert an array of Malloy DocumentCompletions to LSP CompletionItems.
 */
export function malloyCompletionsToLspItems(
  completions: MalloyDocumentCompletion[]
): CompletionItem[] {
  return completions.map(malloyCompletionToLspItem);
}
