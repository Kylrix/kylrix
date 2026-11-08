import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('FormDialog Accessibility Semantics & Keyboard Focus', () => {
  const filePath = path.resolve(process.cwd(), 'components/forms/FormDialog.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  it('provides explicit aria-label attributes on icon-only buttons', () => {
    expect(content).toContain('aria-label="Remove question"');
    expect(content).toContain('aria-label={`Remove option ${oIdx + 1}`}');
    expect(content).toContain('aria-label="Kylrix Assist — AI Auto-Creator"');
    expect(content).toContain('aria-label="Close form editor"');
    expect(content).toContain('aria-label="Close ghost fields drawer"');
    expect(content).toContain('aria-label="Close field rules drawer"');
  });

  it('configures switch semantics and labels on question required toggle', () => {
    expect(content).toContain('role="switch"');
    expect(content).toContain('aria-checked={Boolean(field.required)}');
    expect(content).toContain('aria-label={`Mark "${field.label || \'question\'}" as required`}');
    expect(content).toContain('focus-within:ring-2 focus-within:ring-[#6366F1]');
  });

  it('configures switch semantics and accessible labeling on submission limit toggle', () => {
    expect(content).toContain('role="switch"');
    expect(content).toContain('aria-checked={isMultiple}');
    expect(content).toContain('aria-label="Allow multiple submissions per user"');
  });

  it('applies keyboard focus rings to interactive buttons and selectors', () => {
    expect(content).toContain('focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400');
    expect(content).toContain('focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]');
    expect(content).toContain('focus-visible:ring-2 focus-visible:ring-[#6366F1]');
  });
});
