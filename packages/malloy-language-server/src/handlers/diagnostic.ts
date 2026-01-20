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

import type {Connection, Diagnostic} from 'vscode-languageserver';
import {DiagnosticSeverity} from 'vscode-languageserver';
import type {DocumentManager} from '../document-manager';
import type {ConnectionManager} from '../connection-manager';
import {logMessagesToDiagnostics, zeroRange} from '../converters';

/**
 * Provides diagnostics (errors and warnings) for Malloy documents.
 */
export class DiagnosticProvider {
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private readonly debounceMs = 300;

  constructor(
    private connection: Connection,
    private documentManager: DocumentManager,
    private connectionManager: ConnectionManager
  ) {}

  /**
   * Validate a document and send diagnostics.
   * Uses debouncing to avoid excessive validation on rapid edits.
   */
  validateDocument(uri: string, content: string): void {
    // Clear any existing debounce timer
    const existing = this.debounceTimers.get(uri);
    if (existing) {
      clearTimeout(existing);
    }

    // Set up debounced validation
    const timer = setTimeout(() => {
      this.doValidate(uri, content);
      this.debounceTimers.delete(uri);
    }, this.debounceMs);

    this.debounceTimers.set(uri, timer);
  }

  /**
   * Perform the actual validation and send diagnostics.
   */
  private async doValidate(uri: string, content: string): Promise<void> {
    try {
      // Update the document and get a fresh translator
      const translator = this.documentManager.updateDocument(uri, content, 0);

      // Attempt full translation to get all diagnostics
      const response = translator.translate();

      let diagnostics: Diagnostic[] = [];

      if (response.problems) {
        diagnostics = logMessagesToDiagnostics(response.problems, uri);
      }

      // Send the diagnostics
      this.connection.sendDiagnostics({uri, diagnostics});
    } catch (error) {
      // If translation fails completely, send an error diagnostic
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.connection.sendDiagnostics({
        uri,
        diagnostics: [
          {
            range: zeroRange(),
            message: `Validation error: ${errorMessage}`,
            severity: DiagnosticSeverity.Error,
            source: 'malloy',
          },
        ],
      });
    }
  }

  /**
   * Clear diagnostics for a document.
   */
  clearDiagnostics(uri: string): void {
    // Cancel any pending validation
    const existing = this.debounceTimers.get(uri);
    if (existing) {
      clearTimeout(existing);
      this.debounceTimers.delete(uri);
    }

    // Clear diagnostics
    this.connection.sendDiagnostics({uri, diagnostics: []});
  }

  /**
   * Dispose of the provider and clean up resources.
   */
  dispose(): void {
    // Cancel all pending validations
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
}
