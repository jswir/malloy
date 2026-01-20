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

import type {Connection, HoverParams, Hover} from 'vscode-languageserver';
import type {DocumentManager} from '../document-manager';
import {lspToMalloyPosition} from '../converters';

/**
 * Format help context into markdown content for hover display.
 */
function formatHelpContext(helpContext: {
  type: string;
  token: string | undefined;
}): string {
  const {type, token} = helpContext;

  // Map context types to user-friendly labels
  const typeLabels: Record<string, string> = {
    model_property: 'Model Property',
    explore_property: 'Source Property',
    query_property: 'Query Property',
  };

  const label = typeLabels[type] || type;

  if (token) {
    return `**${label}**: \`${token}\``;
  }

  return `**${label}**`;
}

/**
 * Set up the hover handler.
 * Provides hover information including type and documentation.
 */
export function setupHoverHandler(
  connection: Connection,
  documentManager: DocumentManager
): void {
  connection.onHover((params: HoverParams): Hover | null => {
    try {
      const translator = documentManager.getTranslator(params.textDocument.uri);
      const position = lspToMalloyPosition(params.position);

      const response = translator.helpContext(position);

      if (!response.helpContext) {
        return null;
      }

      return {
        contents: {
          kind: 'markdown',
          value: formatHelpContext(response.helpContext),
        },
      };
    } catch (error) {
      console.error('Error in hover handler:', error);
      return null;
    }
  });
}
