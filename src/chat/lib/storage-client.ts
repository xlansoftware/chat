import { Node } from "@/types/nodes";
import { UIMessage } from "ai";

// lib/storage-client.ts
export class StorageClient {
  private baseUrl = '/api/storage';

  async createNode<T extends Node>(nodeType: T['type'], path: string, metadata: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, type: nodeType, metadata }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create file');
    }

    const data = await response.json();
    return data.node;
  }

  async deleteNode(path: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}?path=${encodeURIComponent(path)}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete node');
    }
  }

  async renameNode(oldPath: string, newPath: string): Promise<Node | null> {
    const response = await fetch(this.baseUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newPath }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to rename node');
    }

    const data = await response.json();
    return data.node;
  }

  async readContent(path: string): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/content?path=${encodeURIComponent(path)}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to read content');
    }

    const data = await response.json();
    return data.content;
  }

  async writeContent(path: string, content: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to write content');
    }
  }

  async writeMetadata(path: string, metadata: Record<string, unknown>, append?: boolean,): Promise<Node> {
    const response = await fetch(`${this.baseUrl}/metadata`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, metadata, append }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to write metadata');
    }

    const { node } = await response.json();
    return node;
  }

  async getNode(path: string): Promise<Node | null> {
    const response = await fetch(
      `${this.baseUrl}?path=${encodeURIComponent(path)}&action=get`
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get node');
    }

    const data = await response.json();
    return data.node;
  }

  async listNodes(path: string): Promise<{ nodes: Node[], breadcrumbs: Node[] }> {
    const response = await fetch(
      `${this.baseUrl}?path=${encodeURIComponent(path)}&action=list`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list nodes');
    }

    const data = await response.json();
    return { nodes: data.nodes, breadcrumbs: data.breadcrumbs };
  }

  async readMessages(path: string): Promise<UIMessage[]> {
    const response = await fetch(
      `${this.baseUrl}/messages?path=${encodeURIComponent(path)}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to read messages');
    }

    const data = await response.json();
    return data.messages;
  }

  async writeMessages(path: string, messages: readonly UIMessage[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, messages }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to write messages');
    }
  }

}

// Export a singleton instance
export const storageClient = new StorageClient();