/** Plain-text helpers for the markdown-lite posts (see components/RichText.tsx). */

export function plainText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[*`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
