import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('CredentialDetail accessibility test', () => {
  it('ensures all icon-only action buttons and links have accessible aria-labels', () => {
    const filePath = path.resolve(__dirname, 'CredentialDetail.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Verify key action buttons have aria-label
    expect(content).toContain("aria-label={isMobile ? 'Back' : 'Close'}");
    expect(content).toContain("aria-label={copied === 'header-id' ? 'Copied ID' : 'Copy full ID'}");
    expect(content).toContain('aria-label="Sidekick Companion"');
    expect(content).toContain("aria-label={copied === 'all-envs' ? 'Copied .env' : 'Copy .env'}");
    expect(content).toContain("aria-label={isPublic ? 'Copy share link' : 'Publish & share'}");
    expect(content).toContain('aria-label="Link project"');
    expect(content).toContain('aria-label="Delete"');
    expect(content).toContain("aria-label={isFieldCopied ? 'Recovery code copied' : 'Copy recovery code'}");
    expect(content).toContain('aria-label="Open website"');
    expect(content).toContain("aria-label={`Open attachment: ${att.name}`}");
  });

  it('ensures interactive buttons include focus-visible accessibility styling', () => {
    const filePath = path.resolve(__dirname, 'CredentialDetail.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('focus-visible:ring-');
  });
});
