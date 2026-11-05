import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('UnifiedBottomBar Accessibility & Navigation Semantics', () => {
  const filePath = path.resolve(process.cwd(), 'components/UnifiedBottomBar.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  it('renders bottom navigation landmark with accessible aria-label', () => {
    expect(content).toContain('aria-label="Bottom Navigation"');
  });

  it('provides aria-current="page" semantics for the currently active tab link', () => {
    expect(content).toContain("aria-current={isSelected ? 'page' : undefined}");
  });

  it('includes focus-visible accessibility styling on navigation links and the central FAB', () => {
    expect(content).toContain('focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]');
    expect(content).toContain('aria-label="Create new item"');
  });
});
