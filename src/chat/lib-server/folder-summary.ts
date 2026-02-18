import { IStorageService } from "@/lib/storage/IStorageService";
import { markdownToMessages } from "./convert-md-message";
import { getParentPaths } from "./get-parent-paths";
import { Node } from "@/types/nodes"
import { changeFileName } from "@/lib/file-name";

export async function updateFolderSummary(storage: IStorageService, path: string, recursive: boolean = false, rename: boolean = false) {

  const node = await storage.getNode(path);
  if (!node) return;

  await updateNodeSummary(storage, node, recursive, rename);
}

async function updateNodeSummary(storage: IStorageService, node: Node, recursive: boolean = false, rename: boolean = false) {

  const folderPath = node.type === "file"
    ? getParentPaths(node.name, false).pop()
    : node.name
    ;

  if (!folderPath) return;

  if (recursive) {
    const children = await storage.listNodes(folderPath);
    for (let childNode of children) {
      if (rename && childNode.metadata?.title) {
        const newName = changeFileName(childNode.name, childNode.metadata?.title as string);
        if (newName && newName !== childNode.name) {
          try {
            childNode = await storage.renameNode(childNode.name, newName);
          } catch {
            console.log(`Failed to rename ${childNode.name} -> ${newName}`)
          }
        }
      }

      if (childNode.type === "folder") {
        await updateNodeSummary(storage, childNode, recursive, rename);
      }
    }
  }

  const summary = await folderSummary(storage, folderPath);
  if (summary) {
    await storage.writeContent(folderPath, summary);
  }

}

export async function folderSummary(storage: IStorageService, path: string): Promise<string | null> {

  const node = await storage.getNode(path);
  if (!node) return null;
  if (node.type !== "folder") throw new Error(`Path ${path} is not a folder`);

  const ls = await storage.listNodes(path);

  const folders = ls.filter((n) => n.type === "folder");
  const files = ls.filter((n) => n.type === "file");

  const markdown: string[] = [];

  markdown.push(`# ${node.metadata?.title || node.name}`, '');

  markdown.push(`## Table of content`, '');

  for (const node of files) {
    const title = node.metadata?.title || node.name;
    markdown.push(`1. [${title}](./${node.name.substring(path.length)})`);
    const content = await storage.readContent(node.name);
    const contentSummary = messagesSummary(content);
    if (contentSummary) {
      markdown.push(`   > ${contentSummary}`);
    }
  }

  markdown.push('---');

  for (const node of folders) {
    const title = node.metadata?.title || node.name;
    markdown.push(`1. [${title}](./${node.name.substring(path.length)}/)`);
  }

  return markdown.join('\n');
}

function messagesSummary(content: string): string {
  const messages = markdownToMessages(content);

  const userMessages = messages.filter((m) => m.role === "user");
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const codeCount = assistantMessages.reduce((sofar, current) => {
    current.parts.filter((p) => p.type === "text").forEach((p) => {
      sofar += countCodeBlocks(p.text);
    })
    return sofar;
  }, 0);

  const result = [];
  result.push(plural(userMessages.length, "question"));
  if (codeCount > 0) {
    result.push(plural(codeCount, "code block"));
  }

  return result.join("; ");
}

function plural(n: number, str: string): string {
  if (n === 1) return `1 ${str}`;
  return `${n} ${str}s`;
}

/**
 * Counts the number of code blocks in a markdown string
 * Supports both fenced code blocks (```) and indented code blocks
 */
function countCodeBlocks(markdown: string): number {
  if (!markdown) return 0;

  let count = 0;

  // Match fenced code blocks (``` or ~~~)
  // This handles:
  // - ```language
  //   code
  //   ```
  // - ~~~
  //   code
  //   ~~~
  const fencedCodeBlockRegex = /(^|\n)([`~]{3,})[^\n]*\n[\s\S]*?\n\2($|\n)/g;
  const fencedMatches = markdown.match(fencedCodeBlockRegex);
  if (fencedMatches) {
    count += fencedMatches.length;
  }

  return count;
}