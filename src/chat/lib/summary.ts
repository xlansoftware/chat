import { UIMessage } from "ai";
import { markdownToMessages } from "../lib-server/convert-md-message";

export function chatSummary(content: string) {
  const messages = markdownToMessages(content);

  const userMessages = messages.filter((m) => m.role === "user");
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const codeCount = assistantMessages.reduce((sofar, current) => {
    current.parts.filter((p) => p.type === "text").forEach((p) => {
      sofar += countCodeBlocks(p.text);
    })
    return sofar;
  }, 0);

  const firstUserMessageText = userMessages.length > 0 ? messageText(userMessages[0]) : "";
  const firstAssistantMessageText = assistantMessages.length > 0 ? messageText(assistantMessages[0]) : "";

  return {
    firstUserMessageText,
    firstAssistantMessageText,
    userMessages,
    assistantMessages,
    codeCount
  };
}

export function messageText(message: UIMessage) {
  const result: string[] = message.parts.filter((p) => p.type === "text").map((p) => p.text);;
  return result.join("\n");
}

/**
 * Counts the number of code blocks in a markdown string
 * Supports both fenced code blocks (```) and indented code blocks
 */
export function countCodeBlocks(markdown: string): number {
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