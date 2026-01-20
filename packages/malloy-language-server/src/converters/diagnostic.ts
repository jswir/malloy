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

import {Diagnostic, DiagnosticSeverity} from 'vscode-languageserver';
import type {LogMessage} from '@malloydata/malloy';
import {malloyToLspRange, zeroRange} from './position';

/**
 * Convert a Malloy LogMessage to an LSP Diagnostic.
 */
export function logMessageToDiagnostic(msg: LogMessage): Diagnostic {
  let severity: DiagnosticSeverity;
  switch (msg.severity) {
    case 'error':
      severity = DiagnosticSeverity.Error;
      break;
    case 'warn':
      severity = DiagnosticSeverity.Warning;
      break;
    case 'debug':
      severity = DiagnosticSeverity.Information;
      break;
    default:
      severity = DiagnosticSeverity.Error;
  }

  return {
    range: msg.at ? malloyToLspRange(msg.at.range) : zeroRange(),
    message: msg.message,
    severity,
    code: msg.code,
    source: 'malloy',
  };
}

/**
 * Convert an array of LogMessages to LSP Diagnostics,
 * filtering to only include messages for the specified document URI.
 */
export function logMessagesToDiagnostics(
  messages: LogMessage[],
  documentUri: string
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const msg of messages) {
    // Include messages that have no location (general errors) or match the document
    if (!msg.at || msg.at.url === documentUri) {
      diagnostics.push(logMessageToDiagnostic(msg));
    }
  }

  return diagnostics;
}
