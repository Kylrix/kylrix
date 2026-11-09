import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('ProjectVisibilityDrawer Accessibility Semantics', () => {
  const filePath = path.resolve(process.cwd(), 'components/projects/ProjectVisibilityDrawer.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  it('renders dialog semantics with proper labeling', () => {
    expect(content).toContain('role="dialog"');
    expect(content).toContain('aria-modal="true"');
    expect(content).toContain('aria-labelledby="project-visibility-drawer-title"');
    expect(content).toContain('id="project-visibility-drawer-title"');
  });

  it('provides explicit aria-label and focus rings on close button', () => {
    expect(content).toContain('aria-label="Close project visibility dialog"');
    expect(content).toContain('focus-visible:ring-2 focus-visible:ring-[#6366F1]');
  });

  it('provides aria-expanded on advanced access control accordion', () => {
    expect(content).toContain('aria-expanded={isExpanded}');
  });

  it('configures switch semantics and accessible focus ring on guest view toggle', () => {
    expect(content).toContain('role="switch"');
    expect(content).toContain('aria-checked={isGuest}');
    expect(content).toContain('aria-label="Toggle anonymous guest view"');
    expect(content).toContain('focus-visible:ring-2 focus-visible:ring-[#6366F1]');
  });

  it('configures focus-visible ring styles on visibility option cards', () => {
    expect(content).toContain('focus-visible:ring-2 focus-visible:ring-[#6366F1]');
  });
});
