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
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import {TextDocument} from 'vscode-languageserver-textdocument';

import {DocumentManager} from './document-manager';
import {ConnectionManager} from './connection-manager';
import {loadConfig} from './config';
import {
  setupDocumentSymbolHandler,
  setupCompletionHandler,
  setupHoverHandler,
  setupDefinitionHandler,
  DiagnosticProvider,
} from './handlers';

/**
 * Start the Malloy Language Server.
 * Uses stdio transport for communication with the editor.
 */
export async function startServer(): Promise<void> {
  // Create the connection for the server
  const connection = createConnection(ProposedFeatures.all);

  // Create a text documents manager
  const textDocuments = new TextDocuments(TextDocument);

  // Server state
  let documentManager: DocumentManager;
  let connectionManager: ConnectionManager;
  let diagnosticProvider: DiagnosticProvider;
  let workspaceRoot: string | undefined;

  // Handle initialization
  connection.onInitialize((params: InitializeParams): InitializeResult => {
    // Get the workspace root
    workspaceRoot = params.workspaceFolders?.[0]?.uri;

    console.error('Malloy Language Server initializing...');
    console.error(`Workspace root: ${workspaceRoot || 'none'}`);

    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        completionProvider: {
          triggerCharacters: ['.', ':', ' '],
          resolveProvider: false,
        },
        hoverProvider: true,
        definitionProvider: true,
        documentSymbolProvider: true,
      },
    };
  });

  // Handle initialized notification
  connection.onInitialized(async () => {
    try {
      // Load configuration
      const config = await loadConfig(workspaceRoot);

      // Initialize managers
      documentManager = new DocumentManager(textDocuments);
      connectionManager = new ConnectionManager(config, workspaceRoot);
      diagnosticProvider = new DiagnosticProvider(
        connection,
        documentManager,
        connectionManager
      );

      // Set up LSP handlers
      setupDocumentSymbolHandler(connection, documentManager);
      setupCompletionHandler(connection, documentManager);
      setupHoverHandler(connection, documentManager);
      setupDefinitionHandler(connection, documentManager);

      console.error('Malloy Language Server initialized successfully');
    } catch (error) {
      console.error('Error during initialization:', error);
    }
  });

  // Handle document open
  textDocuments.onDidOpen(event => {
    console.error(`Document opened: ${event.document.uri}`);
    diagnosticProvider?.validateDocument(
      event.document.uri,
      event.document.getText()
    );
  });

  // Handle document changes
  textDocuments.onDidChangeContent(change => {
    diagnosticProvider?.validateDocument(
      change.document.uri,
      change.document.getText()
    );
  });

  // Handle document close
  textDocuments.onDidClose(event => {
    console.error(`Document closed: ${event.document.uri}`);
    documentManager?.closeDocument(event.document.uri);
    diagnosticProvider?.clearDiagnostics(event.document.uri);
  });

  // Handle shutdown
  connection.onShutdown(async () => {
    console.error('Malloy Language Server shutting down...');
    diagnosticProvider?.dispose();
    await connectionManager?.dispose();
  });

  // Start listening
  textDocuments.listen(connection);
  connection.listen();

  console.error('Malloy Language Server started');
}
