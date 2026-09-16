import { describe, it, expect } from 'vitest';

// Unit tests for Sidekick drawer message safety and JWT propagation

function renderMessageContentHelper(content?: string | null) {
  const text = typeof content === 'string' ? content : (content ? String(content) : '');
  if (!text) return null;

  const attachRegex = /\[Attached:\s*(.*?)\s*\((.*?)\)\s*-\s*ID:\s*(.*?)\]/g;
  const matches = [...text.matchAll(attachRegex)];
  let cleanText = text.replace(attachRegex, '').trim();

  try {
    const p = JSON.parse(cleanText);
    if (p?.oneLiner) cleanText = p.oneLiner;
  } catch {}

  return { cleanText, matches };
}

describe('Sidekick Drawer Message Content Safety', () => {
  it('safely handles undefined content without throwing matchAll error', () => {
    expect(() => renderMessageContentHelper(undefined)).not.toThrow();
    expect(renderMessageContentHelper(undefined)).toBeNull();
  });

  it('safely handles null content without throwing matchAll error', () => {
    expect(() => renderMessageContentHelper(null)).not.toThrow();
    expect(renderMessageContentHelper(null)).toBeNull();
  });

  it('safely handles non-string primitive values', () => {
    expect(() => renderMessageContentHelper(123 as any)).not.toThrow();
    const result = renderMessageContentHelper(123 as any);
    expect(result?.cleanText).toBe('123');
  });

  it('correctly parses attached object regex patterns in message content', () => {
    const rawContent = 'Here is the summary of the project.\n\n[Attached: Roadmap Note (note) - ID: n_12345]';
    const result = renderMessageContentHelper(rawContent);

    expect(result).not.toBeNull();
    expect(result?.cleanText).toBe('Here is the summary of the project.');
    expect(result?.matches).toHaveLength(1);
    expect(result?.matches[0][1]).toBe('Roadmap Note');
    expect(result?.matches[0][2]).toBe('note');
    expect(result?.matches[0][3]).toBe('n_12345');
  });

  it('unwraps JSON summary payloads if present in assistant response content', () => {
    const jsonContent = JSON.stringify({
      oneLiner: 'This form collects user feedback for the release candidate.',
      sections: [{ heading: 'Key Questions', bullets: ['User role', 'Satisfaction rating'] }],
    });

    const result = renderMessageContentHelper(jsonContent);
    expect(result?.cleanText).toBe('This form collects user feedback for the release candidate.');
  });
});
