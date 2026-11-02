import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('EventDialog Accessibility Semantics', () => {
  const filePath = path.resolve(process.cwd(), 'components/events/EventDialog.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  it('renders dialog semantics with proper labeling', () => {
    expect(content).toContain('role="dialog"');
    expect(content).toContain('aria-modal="true"');
    expect(content).toContain('aria-labelledby="create-event-dialog-title"');
    expect(content).toContain('id="create-event-dialog-title"');
  });

  it('provides explicit aria-label attributes on icon-only action buttons', () => {
    expect(content).toContain('aria-label="Close dialog"');
    expect(content).toContain('aria-label="Go to full event details"');
    expect(content).toContain("aria-label={isExpanded ? 'Collapse event modal' : 'Expand event modal'}");
  });

  it('configures switch semantics and accessible focus ring on video call toggle', () => {
    expect(content).toContain('role="switch"');
    expect(content).toContain('aria-checked={autoCreateCall}');
    expect(content).toContain('aria-label="Create Kylrix Connect Call"');
    expect(content).toContain('focus-visible:ring-2 focus-visible:ring-[#6366F1]');
  });

  it('configures tablist semantics and focus styles on event visibility controls', () => {
    expect(content).toContain('role="tablist"');
    expect(content).toContain('aria-labelledby="event-visibility-label"');
    expect(content).toContain('role="tab"');
    expect(content).toContain('aria-selected={isActive}');
    expect(content).toContain('focus-visible:ring-2 focus-visible:ring-[#6366F1]');
  });
});
