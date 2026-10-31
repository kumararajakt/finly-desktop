import { Component, For } from "solid-js";

interface FormattedMessageProps {
  content: string;
}

/**
 * Renders structured markdown-like text (headings, bold, lists, code, tables)
 * safely with clean Tailwind styling.
 */
export const FormattedMessage: Component<FormattedMessageProps> = (props) => {
  // Parse message into blocks: header, list, table, or paragraph
  const blocks = () => {
    const raw = props.content || "";
    const lines = raw.split("\n");
    const result: Array<
      | { type: "header"; level: number; text: string }
      | { type: "list"; items: string[] }
      | { type: "paragraph"; text: string }
    > = [];

    let currentList: string[] | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trimEnd();

      if (!line.trim()) {
        if (currentList) {
          result.push({ type: "list", items: currentList });
          currentList = null;
        }
        continue;
      }

      // Headers (e.g. ### Header)
      const headerMatch = line.match(/^(#{1,3})\s+(.*)$/);
      if (headerMatch) {
        if (currentList) {
          result.push({ type: "list", items: currentList });
          currentList = null;
        }
        result.push({
          type: "header",
          level: headerMatch[1].length,
          text: headerMatch[2],
        });
        continue;
      }

      // Bullet list items (- or * or numbered 1.)
      const listMatch = line.match(/^[-*•]\s+(.*)$/) || line.match(/^\d+\.\s+(.*)$/);
      if (listMatch) {
        if (!currentList) currentList = [];
        currentList.push(listMatch[1]);
        continue;
      }

      // Normal text / paragraph
      if (currentList) {
        result.push({ type: "list", items: currentList });
        currentList = null;
      }

      result.push({ type: "paragraph", text: line });
    }

    if (currentList) {
      result.push({ type: "list", items: currentList });
    }

    return result;
  };

  /**
   * Replaces **bold**, *italic*, and `code` with HTML spans safely
   */
  const formatInline = (text: string) => {
    // Escape basic html
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Replace bold **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-text-main">$1</strong>');

    // Replace italic *text* or _text_
    escaped = escaped.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em class="italic text-text-muted">$1</em>');

    // Replace inline code `text`
    escaped = escaped.replace(
      /`([^`]+)`/g,
      '<code class="px-1.5 py-0.5 rounded bg-primary-light text-primary text-[11px] font-mono font-medium">$1</code>'
    );

    return escaped;
  };

  return (
    <div class="space-y-2 text-xs leading-relaxed text-text-main select-text">
      <For each={blocks()}>
        {(block) => {
          if (block.type === "header") {
            return (
              <div
                class={`font-bold text-text-main mt-2 mb-1 ${
                  block.level === 1 ? "text-sm text-primary" : block.level === 2 ? "text-xs text-primary" : "text-xs font-semibold"
                }`}
                innerHTML={formatInline(block.text)}
              />
            );
          }

          if (block.type === "list") {
            return (
              <ul class="space-y-1 my-1.5 pl-1">
                <For each={block.items}>
                  {(item) => (
                    <li class="flex items-start gap-2 text-text-main">
                      <span class="text-primary mt-1 text-[8px] leading-none shrink-0">●</span>
                      <div class="flex-1" innerHTML={formatInline(item)} />
                    </li>
                  )}
                </For>
              </ul>
            );
          }

          return <p class="my-1 text-text-main" innerHTML={formatInline(block.text)} />;
        }}
      </For>
    </div>
  );
};
