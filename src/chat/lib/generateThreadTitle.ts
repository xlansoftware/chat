export async function generateThreadTitle(
  firstMessage: string,
  modelName: string | null,
  setThreadTitle: (title: string) => void
): Promise<string> {
  const res = await fetch("/api/summary", {
    method: "POST",
    body: JSON.stringify({ firstMessage, modelName }),
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  let title = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    title += decoder.decode(value, { stream: true });
    setThreadTitle(title); // causes letter-by-letter UI update
  }

  return title;
}
