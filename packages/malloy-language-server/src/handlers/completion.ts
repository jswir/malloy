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

import type {
  Connection,
  CompletionParams,
  CompletionItem,
} from 'vscode-languageserver';
import type {DocumentManager} from '../document-manager';
import {lspToMalloyPosition, malloyCompletionsToLspItems} from '../converters';

/**
 * Set up the completion handler.
 * Provides context-aware code completion suggestions.
 */
export function setupCompletionHandler(
  connection: Connection,
  documentManager: DocumentManager
): void {
  connection.onCompletion((params: CompletionParams): CompletionItem[] => {
    try {
      const translator = documentManager.getTranslator(params.textDocument.uri);
      const position = lspToMalloyPosition(params.position);

      const response = translator.completions(position);

      if (!response.completions) {
        return [];
      }

      return malloyCompletionsToLspItems(response.completions);
    } catch (error) {
      console.error('Error in completion handler:', error);
      return [];
    }
  });
}
