"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * A small markdown subset - bold, italic, code, links, lists and quotes -
 * written as React elements, never as HTML, so nothing injected here can
 * escape into the page.
 */

const INLINE =
  /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>()]+)/g;

type Block =
  | { kind: "p"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "ul"; items: string[] };

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter((part) => part !== "")
    .map((part, index) => {
      const key = `${keyPrefix}-${index}`;
      if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
        return <strong key={key}>{part.slice(2, -2)}</strong>;
      }
      if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
        return <code key={key}>{part.slice(1, -1)}</code>;
      }
      if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
        return <em key={key}>{part.slice(1, -1)}</em>;
      }
      const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
      if (link) {
        return (
          <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer">
            {link[1]}
          </a>
        );
      }
      if (/^https?:\/\//.test(part)) {
        return (
          <a key={key} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        );
      }
      return part;
    });
}

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "p", text: paragraph.join("\n") });
    paragraph = [];
  };
  const flushQuote = () => {
    if (quote.length) blocks.push({ kind: "quote", text: quote.join("\n") });
    quote = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ kind: "ul", items: list });
    list = [];
  };

  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const trimmed = line.trim();
    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      list.push(trimmed.replace(/^[-*]\s+/, ""));
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      flushList();
      quote.push(trimmed.replace(/^>\s?/, ""));
      continue;
    }
    if (!trimmed) {
      flushParagraph();
      flushQuote();
      flushList();
      continue;
    }
    flushQuote();
    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushQuote();
  flushList();
  return blocks;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  if (!text.trim()) return null;
  return (
    <div className={className ? `rich ${className}` : "rich"}>
      {parseBlocks(text).map((block, index) => {
        if (block.kind === "ul") {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inline(item, `${index}-${itemIndex}`)}</li>
              ))}
            </ul>
          );
        }
        if (block.kind === "quote") {
          return <blockquote key={index}>{inline(block.text, String(index))}</blockquote>;
        }
        return <p key={index}>{inline(block.text, String(index))}</p>;
      })}
    </div>
  );
}

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  showToolbar?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  rows = 6,
  autoFocus = false,
  showToolbar = true,
}: EditorProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [preview, setPreview] = useState(false);

  const wrap = (before: string, after = before, fallback = "") => {
    const area = ref.current;
    if (!area) return;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const prefix = (marker: string) => {
    const area = ref.current;
    if (!area) return;
    const start = area.selectionStart;
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    onChange(`${value.slice(0, lineStart)}${marker}${value.slice(lineStart)}`);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(start + marker.length, start + marker.length);
    });
  };

  return (
    <div className="editor">
      {showToolbar && (
        <div className="editor-bar">
          <button type="button" title="Bold" onClick={() => wrap("**", "**", "bold")}>
            <b>B</b>
          </button>
          <button type="button" title="Italic" onClick={() => wrap("*", "*", "italic")}>
            <i>I</i>
          </button>
          <button type="button" title="Link" onClick={() => wrap("[", "](https://)", "link")}>
            link
          </button>
          <button type="button" title="List" onClick={() => prefix("- ")}>
            list
          </button>
          <button type="button" title="Quote" onClick={() => prefix("> ")}>
            quote
          </button>
          <button
            type="button"
            className={preview ? "on" : ""}
            title="Preview"
            onClick={() => setPreview((was) => !was)}
          >
            preview
          </button>
        </div>
      )}
      {preview ? (
        <div className="editor-preview">
          {value.trim() ? <RichText text={value} /> : <p className="hint">Nothing to preview yet.</p>}
        </div>
      ) : (
        <textarea
          ref={ref}
          rows={rows}
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (!(event.metaKey || event.ctrlKey)) return;
            if (event.key === "b") {
              event.preventDefault();
              wrap("**", "**", "bold");
            }
            if (event.key === "i") {
              event.preventDefault();
              wrap("*", "*", "italic");
            }
          }}
        />
      )}
    </div>
  );
}
