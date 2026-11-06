import { parseLegalContent } from "@/lib/legal-content";

export function LegalContent({
  content,
  idPrefix = "legal-section",
}: {
  content: string;
  idPrefix?: string;
}) {
  return (
    <div className="legal-content">
      {parseLegalContent(content).map((block, index) =>
        block.type === "heading" ? (
          <h2 key={index} id={`${idPrefix}-${index}`}>
            {block.text}
          </h2>
        ) : block.type === "list" ? (
          <ul key={index}>
            {block.items.map((text, item) => (
              <li key={item}>{text}</li>
            ))}
          </ul>
        ) : (
          <p key={index}>{block.text}</p>
        ),
      )}
    </div>
  );
}
