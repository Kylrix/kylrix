import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('TaskList Accessibility and Focus Visible Rings', () => {
  const filePath = path.resolve(process.cwd(), 'components/tasks/TaskList.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  it('provides aria-label and aria-expanded on Completed Goals accordion toggle', () => {
    expect(content).toContain('aria-expanded={showCompletedSection}');
    expect(content).toContain('aria-label="Toggle completed goals visibility"');
  });

  it('provides aria-label on tag filter clear and bulk delete buttons', () => {
    expect(content).toContain('aria-label="Clear active tag filter"');
    expect(content).toContain('aria-label="Purge all completed goals"');
  });

  it('includes focus-visible accessibility styling on interactive controls', () => {
    expect(content).toContain('focus-visible:ring-2 focus-visible:ring-[#A855F7]');
    expect(content).toContain('focus-visible:ring-2 focus-visible:ring-red-400');
  });
});
