import { describe, test, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";

import { loadDocument, updateMetadata, writeDocument } from "@/lib/load-document";

let tempDir: string;
let filePath: string;
let filePathNoMetadata: string;

const initialMarkdown = `---
title: Test Post
published: true
count: 1
---

# Hello World

This is the body.
`;

const noMetadata = `
# Hello World

This is the body.
`;

describe("markdown front matter", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "md-test-"));
    filePath = path.join(tempDir, "post.md");
    filePathNoMetadata = path.join(tempDir, "post-no-metadata.md");
    await fs.writeFile(filePath, initialMarkdown, "utf8");
    await fs.writeFile(filePathNoMetadata, noMetadata, "utf8");
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("loadDocument reads metadata only", async () => {
    const result = await loadDocument(filePath);

    expect(result.metadata).toEqual({
      title: "Test Post",
      published: true,
      count: 1,
    });

    expect(result.content).toBeUndefined();
  });

  test("loadDocument reads metadata and content", async () => {
    const result = await loadDocument(filePath, true);

    expect(result.metadata).toEqual({
      title: "Test Post",
      published: true,
      count: 1,
    });

    expect(result.content).toContain("# Hello World");
    expect(result.content).toContain("This is the body.");
  });

  test("loadDocument reads metadata and content (no metadata)", async () => {
    const result = await loadDocument(filePathNoMetadata, true);

    expect(result.metadata).toEqual({});
    expect(result.content).toEqual(noMetadata.trimEnd());
  });

  test("updateMetadata updates front matter without touching content", async () => {
    await updateMetadata(filePath, (meta: { count?: number }) => ({
      ...meta,
      count: Number(meta.count ?? 0) + 1,
      updated: "yes",
    }));

    const result = await loadDocument(filePath, true);

    expect(result.metadata).toEqual({
      title: "Test Post",
      published: true,
      count: 2,
      updated: "yes",
    });

    expect(result.content).toContain("# Hello World");
    expect(result.content).toContain("This is the body.");
  });

  test("create front matter", async () => {
    await updateMetadata(filePathNoMetadata, () => ({
      title: "Hello document!",
    }));

    const result = await loadDocument(filePathNoMetadata, true);

    expect(result.metadata).toEqual({
      title: "Hello document!",
    });

    expect(result.content).toContain("# Hello World");
    expect(result.content).toContain("This is the body.");
  });

  describe("writeDocument", () => {
    test("writes a document with metadata and content", async () => {
      const metadata = {
        title: "New Post",
        author: "John Doe",
        tags: ["javascript", "typescript"],
        published: false,
      };
      const content = "# New Content\n\nThis is new content.";

      await writeDocument(filePath, metadata, content);

      const result = await loadDocument(filePath, true);

      expect(result.metadata).toEqual(metadata);
      expect(result.content).toBe(content);
    });

    test("writes a document with empty content", async () => {
      const metadata = {
        title: "Empty Content Post",
        draft: true,
      };
      const content = "";

      await writeDocument(filePath, metadata, content);

      const result = await loadDocument(filePath, true);

      expect(result.metadata).toEqual(metadata);
      expect(result.content).toBe("");
    });

    test("writes a document with complex YAML metadata", async () => {
      const metadata = {
        title: "Complex Post",
        date: "2024-01-15",
        nested: {
          array: [1, 2, 3],
          object: { key: "value" },
        },
        multiline: "line 1\nline 2\nline 3",
      };
      const content = "# Complex Example\n\nWith complex metadata.";

      await writeDocument(filePath, metadata, content);

      const result = await loadDocument(filePath, true);

      expect(result.metadata).toEqual(metadata);
      expect(result.content).toBe(content);
    });

    test("writes a document with empty metadata object", async () => {
      const metadata = {};
      const content = "# No Metadata\n\nThis post has no front matter.";

      await writeDocument(filePath, metadata, content);

      const result = await loadDocument(filePath, true);

      expect(result.metadata).toEqual({});
      expect(result.content).toBe(content);

      // Verify the file structure
      const fileContent = await fs.readFile(filePath, "utf8");
      expect(fileContent).toBe(content);
    });

    test("writes a document with no content parameter", async () => {
      const metadata = {
        title: "Default Content Test",
      };

      // Call without content parameter
      await writeDocument(filePath, metadata);

      const result = await loadDocument(filePath, true);

      expect(result.metadata).toEqual(metadata);
      expect(result.content).toBe("");
    });

    test("overwrites existing file completely", async () => {
      const metadata = {
        title: "Overwritten Post",
        newField: "value",
      };
      const content = "# New Beginning\n\nOld content is gone.";

      await writeDocument(filePath, metadata, content);

      const result = await loadDocument(filePath, true);

      expect(result.metadata).toEqual({
        title: "Overwritten Post",
        newField: "value",
      });
      expect(result.metadata).not.toHaveProperty("count");
      expect(result.metadata).not.toHaveProperty("published");
      expect(result.content).toBe("# New Beginning\n\nOld content is gone.");
    });

    test("handles special characters in content", async () => {
      const metadata = { title: "Special Chars" };
      const content = "# Special\n\n```javascript\nconsole.log('test');\n```\n\n> Quote\n\n---\n\nHorizontal rule";

      await writeDocument(filePath, metadata, content);

      const result = await loadDocument(filePath, true);

      expect(result.metadata).toEqual(metadata);
      expect(result.content).toBe(content);
    });

    test("metadata with arrays and objects are properly formatted", async () => {
      const metadata = {
        title: "Array Test",
        categories: ["Tech", "Programming"],
        authors: [
          { name: "Alice", role: "writer" },
          { name: "Bob", role: "editor" },
        ],
        config: {
          featured: true,
          priority: 5,
        },
      };
      const content = "# Test";

      await writeDocument(filePath, metadata, content);

      const result = await loadDocument(filePath, true);

      // Check metadata structure
      expect(result.metadata).toEqual(metadata);
      expect(Array.isArray(result.metadata.categories)).toBe(true);
      expect(result.metadata.categories).toHaveLength(2);
      expect(Array.isArray((result.metadata).authors)).toBe(true);
      expect((result.metadata).authors).toHaveLength(2);
      expect(typeof (result.metadata).config).toBe("object");

      // Verify file can be parsed correctly
      const fileContent = await fs.readFile(filePath, "utf8");
      expect(fileContent).toContain("---");
      expect(fileContent).toContain("title: Array Test");
      expect(fileContent).toContain("categories:");
      expect(fileContent).toContain("- Tech");
      expect(fileContent).toContain("- Programming");
    });

    test("writes metadata with null and undefined values", async () => {
      const metadata = {
        title: "Null Test",
        nullField: null,
        undefinedField: undefined,
        emptyString: "",
        zero: 0,
        falseValue: false,
      };
      const content = "# Testing null/undefined";

      await writeDocument(filePath, metadata, content);

      const result = await loadDocument(filePath, true);

      // Note: YAML stringify may handle null/undefined differently
      // undefined might be omitted, null might be written as null
      expect(result.metadata).toHaveProperty("title", "Null Test");
      expect(result.metadata).toHaveProperty("emptyString", "");
      expect(result.metadata).toHaveProperty("zero", 0);
      expect(result.metadata).toHaveProperty("falseValue", false);
      // null might be preserved or omitted depending on YAML implementation
    });
  });
});
