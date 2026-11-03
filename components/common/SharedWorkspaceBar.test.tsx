import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('SharedWorkspaceBar Accessibility Semantics & Micro-UX', () => {
  const filePath = path.resolve(process.cwd(), 'components/common/SharedWorkspaceBar.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  it('renders toolbar landmark with role="region" and accessible label', () => {
    expect(content).toContain('role="region"');
    expect(content).toContain('aria-label="Shared resource toolbar"');
  });

  it('provides explicit aria-label on icon-only copy link button', () => {
    expect(content).toContain('aria-label="Copy share link"');
  });

  it('configures modal dialog accessibility attributes and labeling', () => {
    expect(content).toContain('role="dialog"');
    expect(content).toContain('aria-modal="true"');
    expect(content).toContain('aria-labelledby="share-agent-modal-title"');
    expect(content).toContain('id="share-agent-modal-title"');
    expect(content).toContain('aria-label="Close modal"');
  });

  it('configures tablist semantics and aria-selected states on snippet formats', () => {
    expect(content).toContain('role="tablist"');
    expect(content).toContain('aria-label="Agent snippet formats"');
    expect(content).toContain('role="tab"');
    expect(content).toContain("aria-selected={activeTab === 'claude'}");
    expect(content).toContain("aria-selected={activeTab === 'cursor'}");
    expect(content).toContain("aria-selected={activeTab === 'codex'}");
    expect(content).toContain("aria-selected={activeTab === 'raw'}");
  });

  it('includes focus-visible keyboard navigation styles on interactive elements', () => {
    expect(content).toContain('focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:outline-none');
  });
});
