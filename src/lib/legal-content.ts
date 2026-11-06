export type LegalBlock =
  | { type: "heading" | "paragraph"; text: string }
  | { type: "list"; items: string[] };

// Deliberately small text format: no HTML, embedded media or executable markup.
export function parseLegalContent(content: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  for (const line of content.replace(/\r\n?/g, "\n").split("\n")) {
    const text = line.trim();
    if (!text) {
      blocks.push({ type: "paragraph", text: "" });
      continue;
    }
    if (text.startsWith("## ")) {
      blocks.push({ type: "heading", text: text.slice(3) });
      continue;
    }
    const last = blocks.at(-1);
    if (text.startsWith("- ")) {
      if (last?.type === "list") last.items.push(text.slice(2));
      else blocks.push({ type: "list", items: [text.slice(2)] });
    } else if (last?.type === "paragraph" && last.text)
      last.text += "\n" + text;
    else blocks.push({ type: "paragraph", text });
  }
  return blocks.filter((block) => block.type === "list" || block.text);
}
