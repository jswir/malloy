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

import type {Connection, DocumentSymbolParams} from 'vscode-languageserver';
import type {DocumentManager} from '../document-manager';
import {malloySymbolsToLspSymbols} from '../converters';

/**
 * Set up the document symbol handler.
 * Provides outline/breadcrumb information for the document.
 */
export function setupDocumentSymbolHandler(
  connection: Connection,
  documentManager: DocumentManager
): void {
  connection.onDocumentSymbol((params: DocumentSymbolParams) => {
    try {
      const translator = documentManager.getTranslator(params.textDocument.uri);
      const metadata = translator.metadata();

      if (!metadata.symbols) {
        return [];
      }

      // The translator returns internal DocumentSymbol interface from parse-tree-walkers
      // which matches our converter's expected input type
      return malloySymbolsToLspSymbols(
        metadata.symbols as Parameters<typeof malloySymbolsToLspSymbols>[0]
      );
    } catch (error) {
      console.error('Error in document symbol handler:', error);
      return [];
    }
  });
}
