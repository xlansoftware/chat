import fs from "fs";
import readline from "readline";
import yaml from "yaml";

export async function loadDocument(
  fileName: string,
  withContent = false
): Promise<{ metadata: Record<string, unknown>; content?: string }> {
  const stream = fs.createReadStream(fileName, { encoding: "utf8" });

  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let inFrontMatter = false;
  let hasFrontMatter = false;
  const frontMatterLines: string[] = [];
  const contentLines: string[] = [];

  try {
    for await (const line of rl) {
      // Detect start of front matter
      if (!inFrontMatter && !hasFrontMatter && line.trim() === "---") {
        inFrontMatter = true;
        hasFrontMatter = true;
        continue;
      }

      // Detect end of front matter
      if (inFrontMatter && line.trim() === "---") {
        inFrontMatter = false;
        if (!withContent) {
          break;
        }
        continue;
      }

      if (inFrontMatter) {
        frontMatterLines.push(line);
      } else if (withContent) {
        // Collect all lines as content if we're not in front matter
        contentLines.push(line);
      }
    }
  } finally {
    rl.close();
    stream.close();
  }

  const metadata = hasFrontMatter && frontMatterLines.length >= 0
    ? yaml.parse(frontMatterLines.join("\n"))
    : {};

  return withContent
    ? { metadata, content: contentLines.join("\n") }
    : { metadata };
}

export async function writeDocument(
  fileName: string,
  metadata: Record<string, unknown>,
  content: string = ""
): Promise<void> {
  // Construct the complete document content
  const documentContent = Object.keys(metadata).length > 0
    ? `---\n${yaml.stringify(metadata)}---\n${content}`
    : content;

  // Write the content to the file
  await fs.promises.writeFile(fileName, documentContent, { encoding: "utf8" });
}

export async function updateMetadata<T>(
  fileName: string,
  update: (metadata: T) => T
): Promise<void> {
  const tempFile = `${fileName}.tmp`;

  const input = fs.createReadStream(fileName, "utf8");
  const output = fs.createWriteStream(tempFile, "utf8");

  const rl = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });

  let lineIndex = 0;
  let inFrontMatter = false;
  // let frontMatterHandled = false;
  let sawFrontMatterStart = false;

  const frontMatterLines: string[] = [];

  for await (const line of rl) {
    // Front matter may only start on first line
    if (lineIndex === 0 && line.trim() === "---") {
      inFrontMatter = true;
      sawFrontMatterStart = true;
      lineIndex++;
      continue;
    }

    // End of existing front matter
    if (inFrontMatter && line.trim() === "---") {
      inFrontMatter = false;
      // frontMatterHandled = true;

      const original = (yaml.parse(frontMatterLines.join("\n")) ?? {}) as T;
      const updated = update(original);

      output.write("---\n");
      output.write(yaml.stringify(updated));
      output.write("---\n");

      lineIndex++;
      continue;
    }

    if (inFrontMatter) {
      frontMatterLines.push(line);
    } else {
      // No front matter and we're at the start → insert one
      if (lineIndex === 0 && !sawFrontMatterStart) {
        const updated = update({} as T);

        output.write("---\n");
        output.write(yaml.stringify(updated));
        output.write("---\n");
        // frontMatterHandled = true;
      }

      output.write(line + "\n");
    }

    lineIndex++;
  }

  // Edge case: empty file
  if (lineIndex === 0) {
    const updated = update({} as T);
    output.write("---\n");
    output.write(yaml.stringify(updated));
    output.write("---\n");
  }

  rl.close();
  output.end();

  await new Promise((r) => output.on("finish", () => { r(null); }));
  await fs.promises.rename(tempFile, fileName);
}
