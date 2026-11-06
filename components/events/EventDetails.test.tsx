import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('EventDetails Accessibility and Micro-UX Semantics', () => {
  const filePath = path.resolve(process.cwd(), 'components/events/EventDetails.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  it('provides explicit aria-label and accessible focus ring on close button', () => {
    expect(content).toContain('aria-label="Close event details"');
    expect(content).toContain('focus-visible:ring-2 focus-visible:ring-[#6366F1]');
  });

  it('provides explicit aria-label on icon-only title and about action buttons', () => {
    expect(content).toContain('aria-label="Save title"');
    expect(content).toContain('aria-label="Edit about event"');
    expect(content).toContain('aria-label="Open Sidekick Companion"');
  });

  it('provides dialog semantics and accessible label on visibility control', () => {
    expect(content).toContain('aria-haspopup="dialog"');
    expect(content).toContain('aria-expanded={isVisibilityDrawerOpen}');
    expect(content).toContain('aria-label={`Event visibility: ${visibility}. Click to modify.`}');
  });

  it('provides accessible focus indicators on RSVP and action buttons', () => {
    expect(content).toContain('focus-visible:ring-[#F59E0B]');
  });
});
