import { UIMessage } from "ai";

const MESSAGE_DELIMITER = "\n--- message ---\n";

// const someMessages: UIMessage[] = [
//   {
//     id: "msg-1",
//     // createdAt: new Date("2024-01-01T10:00:00"),
//     role: "user",
//     parts: [
//       {
//         type: "text",
//         text: "2+2=?",
//       },
//     ],
//   },
//   {
//     id: "msg-2",
//     // createdAt: new Date("2024-01-01T10:00:00"),
//     role: "assistant",
//     parts: [
//       {
//         type: "text",
//         text: "5",
//       },
//     ],
//   },
// ];

const messageToText = (message: UIMessage): string => {
  const content = message.parts
    .map((part) => {
      if (part.type === "dynamic-tool"
        || part.type.indexOf("tool-") === 0) {
        return [
          "***tool***",
          "```json",
          JSON.stringify(part, null, 2),
          "```"
        ]
      }
      if (part.type === "reasoning") {
        return ["<think>", part.text, "</think>"]
      }
      if ("text" in part && typeof part.text === "string") {
        return part.text;
      }
      console.log(` -- not supported part type: ${part.type}`);
      return null;
    })
    .filter((m) => m !== null)
    .flat()
    .join("\n");

  return [
    MESSAGE_DELIMITER.trim(),
    `role: ${message.role}`,
    '---',
    content
  ].join("\n")
};

const textToMessage = (content: string): UIMessage => {
  const lines = content.trim().split("\n");

  let role: UIMessage['role'] | undefined;
  const parts: UIMessage['parts'] = [];

  let currentText: string[] = [];
  let currentReasoning: string[] = [];
  let inThinkBlock = false;

  let inToolBlock = false;
  let collectingToolJson = false;
  let toolJsonLines: string[] = [];

  const flushText = () => {
    if (currentText.length > 0) {
      parts.push({
        type: "text",
        text: currentText.join("\n"),
      });
      currentText = [];
    }
  };

  const flushReasoning = () => {
    if (currentReasoning.length > 0) {
      parts.push({
        type: "reasoning",
        text: currentReasoning.join("\n"),
      });
      currentReasoning = [];
    }
  };

  const flushTool = () => {
    if (toolJsonLines.length > 0) {
      try {
        const tool = JSON.parse(toolJsonLines.join("\n"));
        parts.push(tool);
      } catch {
        // If JSON parsing fails, fall back to text
        parts.push({
          type: "text",
          text: toolJsonLines.join("\n"),
        });
      }
      toolJsonLines = [];
    }
  };

  for (const line of lines) {
    if (!role) {
      const roleMatch = line.match(/^role:\s*(.+)$/);
      if (roleMatch) {
        role = roleMatch[1] as UIMessage['role'];
        continue;
      }
    }

    if (line === '---') continue;

    // Tool call start
    if (line.trim() === '***tool***') {
      flushText();
      flushReasoning();
      inToolBlock = true;
      continue;
    }

    // Tool code fence start
    if (inToolBlock && line.trim().startsWith('```')) {
      collectingToolJson = !collectingToolJson;
      if (!collectingToolJson) {
        flushTool();
        inToolBlock = false;
      }
      continue;
    }

    if (collectingToolJson) {
      toolJsonLines.push(line);
      continue;
    }

    // Think blocks
    if (line.includes("<think>")) {
      flushText();
      inThinkBlock = true;
      const after = line.replace("<think>", "").trim();
      if (after) currentReasoning.push(after);
      continue;
    }

    if (line.includes("</think>")) {
      const before = line.replace("</think>", "").trim();

      if (!inThinkBlock && currentReasoning.length === 0) {
        // some models do not send start <think> tag
        currentText.push(before);
        flushText();
        const lastPart = parts.at(-1);
        if (lastPart) {
          lastPart.type = "reasoning";
        }
        continue;
      } else {
        if (before) currentReasoning.push(before);
        flushReasoning();
        inThinkBlock = false;
        continue;
      }
    }

    if (inThinkBlock) {
      currentReasoning.push(line);
    } else {
      currentText.push(line);
    }
  }

  flushText();
  flushReasoning();

  return {
    id: "",
    role: role ?? "user",
    parts,
  };
};

export function messagesToMarkdown(messages: UIMessage[]): string {

  const content = messages.map(messageToText)
    .join("\n\n");

  return content;
}


export function markdownToMessages(content: string): UIMessage[] {

  const messages = content
    .split(MESSAGE_DELIMITER.trim())
    .filter((text) => text && text.trim())
    .map((text) => {
      const result = textToMessage(text);
      result.id = crypto.randomUUID();
      return result;
    });

  return messages;

}
