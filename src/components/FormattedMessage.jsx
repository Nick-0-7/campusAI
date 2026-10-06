import React, { useMemo } from "react";
import { marked } from "marked";

// Configure marked with GitHub-flavored markdown and soft line breaks
marked.setOptions({
  breaks: true,
  gfm: true,
});

/**
 * Preprocesses text to fix crammed OCR tables, broken markdown pipes, and missing newlines.
 */
function cleanAndFormatText(rawText) {
  if (!rawText || typeof rawText !== "string") return "";

  let text = rawText;

  // 1. Separate table header row from table separator (e.g., "... | Particulars --- | --- | ---")
  text = text.replace(/([^\n|]+)\s+(\|\s*---+[\s\-|:]+)/g, "$1\n$2");
  text = text.replace(/([^\n|]+)\s+(---+[\s\-|:]+\|)/g, "$1\n$2");

  // 2. Separate table separator from first data row
  text = text.replace(/(---+[\s\-|:]+)\s+(\*\*?[A-Za-z0-9])/g, "$1\n$2");
  text = text.replace(/(---+[\s\-|:]+)\s+(\d+\s*\|)/g, "$1\n$2");

  // 3. Separate consecutive table rows that lack newlines between row numbers/weeks
  text = text.replace(/(\|[^\n|]+)\s+(\d+\s*\|\s*\d+)/g, "$1\n$2");
  text = text.replace(/(\|[^\n|]+)\s+(\*\*[A-Za-z0-9_-]+\*\*)/g, "$1\n$2");

  // 4. Ensure section breaks before headings or stats
  text = text.replace(/([^\n])\s+(\*\*(?:Academic Year|Academic days|Probable Holidays|Important Dates|Note|Summary)[^*]*\*\*)/g, "$1\n\n$2");

  return text;
}

export const FormattedMessage = ({ content }) => {
  const htmlContent = useMemo(() => {
    if (!content) return "";
    try {
      const cleaned = cleanAndFormatText(content);
      return marked.parse(cleaned);
    } catch (err) {
      console.warn("Markdown parse error:", err);
      return content;
    }
  }, [content]);

  return (
    <div
      className="formatted-markdown-body"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};

export default FormattedMessage;
