// Lightweight preprocessor to preserve single line breaks for markdown rendering
// It avoids modifying fenced code blocks (```...```) and attempts to skip lists, headings, blockquotes, and indented code.

export function preProcessMarkdown(md?: string): string {
  if (!md) return '';

  // Normalize CRLF to LF
  const normalized = md.replace(/\r\n/g, '\n');

  // Split into segments: fenced code blocks (``` or ~~~) and non-code parts
  const parts = normalized.split(/(^(?:```|~~~)[\s\S]*?^(?:```|~~~))/gm);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    // If this part is a fenced code block, skip processing
    if (part.startsWith('```') || part.startsWith('~~~')) continue;

    // Process non-code part: add two trailing spaces to lines that are followed by a non-blank line,
    // but avoid special markdown constructs where trailing spaces would interfere.
    const lines = part.split('\n');

    for (let j = 0; j < lines.length - 1; j++) {
      const line = lines[j];
      const nextLine = lines[j + 1];

      if (nextLine.trim() === '') {
        // Next line is blank -> paragraph break, do not add trailing spaces
        continue;
      }

      // If current line already ends with two spaces, skip
      if (/ {2}$/.test(line)) continue;

      // Skip headings (e.g., "# Heading")
      if (/^\s{0,3}#{1,6}\s+/.test(line)) continue;

      // Skip setext-style underlined headings (the underline is on nextLine, so we should skip adding to this line if nextLine is --- or ===)
      if (/^\s*([=-]){3,}\s*$/.test(nextLine)) continue;

      // Skip list items (e.g., "- item", "* item", "+ item", "1. item")
      if (/^\s{0,3}(?:[*+-]|\d+\.)\s+/.test(line)) continue;

      // Skip blockquotes
      if (/^\s{0,3}>/.test(line)) continue;

      // Skip indented code blocks (lines starting with 4 or more spaces)
      if (/^\s{4,}/.test(line)) continue;

      // Skip reference-style link definitions "[id]: url"
      if (/^\s*\[[^\]]+\]:\s*/.test(line)) continue;

      // Append two spaces to create a markdown line break
      lines[j] = line + '  ';
    }

    parts[i] = lines.join('\n');
  }

  return parts.join('');
}


