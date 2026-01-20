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

import * as fs from 'fs/promises';
import * as path from 'path';
import {TextDocuments} from 'vscode-languageserver';
import type {TextDocument} from 'vscode-languageserver-textdocument';
import {MalloyTranslator} from '@malloydata/malloy';
import type {URLReader} from '@malloydata/malloy';

/**
 * State for a single document being managed.
 */
interface DocumentState {
  uri: string;
  content: string;
  translator: MalloyTranslator;
  version: number;
}

/**
 * Manages document state and provides a URLReader implementation
 * that can read from both open documents and the filesystem.
 */
export class DocumentManager implements URLReader {
  private documents = new Map<string, DocumentState>();

  constructor(private textDocuments: TextDocuments<TextDocument>) {}

  /**
   * Implement URLReader.readURL to read file contents.
   * First checks open documents, then falls back to filesystem.
   */
  async readURL(url: URL): Promise<string> {
    const uri = url.toString();

    // Check if document is open in editor
    const openDoc = this.textDocuments.get(uri);
    if (openDoc) {
      return openDoc.getText();
    }

    // Check if we have cached content
    const state = this.documents.get(uri);
    if (state) {
      return state.content;
    }

    // Fall back to filesystem
    if (url.protocol === 'file:') {
      try {
        const filePath = url.pathname;
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
      } catch (error) {
        throw new Error(`Failed to read file: ${url.pathname}`);
      }
    }

    throw new Error(`Cannot read URL: ${uri}`);
  }

  /**
   * Normalize a URI to a consistent format.
   */
  private normalizeUri(uri: string): string {
    // Ensure file:// prefix for file paths
    if (!uri.startsWith('file://') && path.isAbsolute(uri)) {
      return `file://${uri}`;
    }
    return uri;
  }

  /**
   * Get or create a translator for the given document.
   * Creates a fresh translator with the current document content.
   */
  getTranslator(uri: string): MalloyTranslator {
    const normalizedUri = this.normalizeUri(uri);
    const state = this.documents.get(normalizedUri);

    if (state) {
      return state.translator;
    }

    // Try to get content from open documents
    const openDoc = this.textDocuments.get(uri);
    if (openDoc) {
      return this.updateDocument(uri, openDoc.getText(), openDoc.version);
    }

    // Create a translator without content (will need to be read from disk)
    const translator = new MalloyTranslator(normalizedUri);
    this.documents.set(normalizedUri, {
      uri: normalizedUri,
      content: '',
      translator,
      version: 0,
    });
    return translator;
  }

  /**
   * Update a document with new content and create a fresh translator.
   * Returns the new translator.
   */
  updateDocument(
    uri: string,
    content: string,
    version: number
  ): MalloyTranslator {
    const normalizedUri = this.normalizeUri(uri);

    // Create fresh translator with the updated content
    const translator = new MalloyTranslator(normalizedUri, null, {
      urls: {[normalizedUri]: content},
    });

    this.documents.set(normalizedUri, {
      uri: normalizedUri,
      content,
      translator,
      version,
    });

    return translator;
  }

  /**
   * Get the content of a document if it's being tracked.
   */
  getContent(uri: string): string | undefined {
    const normalizedUri = this.normalizeUri(uri);
    return this.documents.get(normalizedUri)?.content;
  }

  /**
   * Check if a document is currently being tracked.
   */
  hasDocument(uri: string): boolean {
    const normalizedUri = this.normalizeUri(uri);
    return this.documents.has(normalizedUri);
  }

  /**
   * Close a document and remove it from tracking.
   */
  closeDocument(uri: string): void {
    const normalizedUri = this.normalizeUri(uri);
    this.documents.delete(normalizedUri);
  }

  /**
   * Get all tracked document URIs.
   */
  getTrackedDocuments(): string[] {
    return Array.from(this.documents.keys());
  }
}
