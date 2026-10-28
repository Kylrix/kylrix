import { describe, it, expect } from 'vitest';
import {
  computeSweepScopes,
  computeAetRequiredScopes,
  computeAetScopes,
  getStepTitle,
  isReadScope,
  isWriteScope,
  SCOPE_CATEGORIES,
} from './CreatePatDrawer';
import { PAT_SCOPES } from '@/lib/api/scopes';

describe('CreatePatDrawer helper logic', () => {
  it('correctly identifies read and write scopes', () => {
    expect(isReadScope('notes:read')).toBe(true);
    expect(isReadScope('profile:read')).toBe(true);
    expect(isReadScope('notes:write')).toBe(false);
    expect(isWriteScope('notes:write')).toBe(true);
    expect(isWriteScope('tools:execute')).toBe(true);
  });

  it('computes sweep scopes for all resources across access levels', () => {
    const allFull = computeSweepScopes('all', 'all');
    expect(allFull.length).toBe(PAT_SCOPES.length);

    const allRead = computeSweepScopes('all', 'read');
    expect(allRead.every(isReadScope)).toBe(true);
    expect(allRead.length).toBeGreaterThan(0);

    const allWrite = computeSweepScopes('all', 'write');
    expect(allWrite.every(isWriteScope)).toBe(true);
    expect(allWrite.length).toBeGreaterThan(0);
    expect(allRead.length + allWrite.length).toBe(PAT_SCOPES.length);
  });

  it('computes sweep scopes for a specific resource (e.g. ideas) with access sweeps', () => {
    const ideasCat = SCOPE_CATEGORIES.find((c) => c.key === 'ideas')!;
    expect(ideasCat.scopes).toEqual(['notes:read', 'notes:write']);

    const ideasFull = computeSweepScopes('ideas', 'all');
    expect(ideasFull).toEqual(['notes:read', 'notes:write']);

    const ideasRead = computeSweepScopes('ideas', 'read');
    expect(ideasRead).toEqual(['notes:read']);

    const ideasWrite = computeSweepScopes('ideas', 'write');
    expect(ideasWrite).toEqual(['notes:write']);
  });

  it('computes sweep scopes for vault and agents correctly', () => {
    const vaultRead = computeSweepScopes('vault', 'read');
    expect(vaultRead).toEqual(['vault:read']);

    const agentsWrite = computeSweepScopes('agents', 'write');
    expect(agentsWrite).toEqual([
      'tools:execute',
      'agents:write',
      'agents:harness',
      'agents:provision',
    ]);
  });

  it('#317: permitted resources add and lock the matching read scopes', () => {
    const required = computeAetRequiredScopes({
      permittedVault: true,
      permittedTotp: true,
      permittedNotes: false,
    });
    expect(required).toContain('vault:read');
    expect(required).toContain('profile:read');
    expect(required).not.toContain('notes:read');

    const withNotes = computeAetRequiredScopes({
      permittedVault: false,
      permittedTotp: false,
      permittedNotes: true,
    });
    expect(withNotes).toContain('notes:read');
    expect(withNotes).not.toContain('vault:read');

    // extra user-selected scopes are preserved and deduplicated
    const merged = computeAetScopes(['notes:write', 'vault:read'], {
      permittedVault: true,
      permittedTotp: false,
      permittedNotes: false,
    });
    expect(merged).toContain('vault:read');
    expect(merged).toContain('notes:write');
    expect(merged.filter((s) => s === 'vault:read')).toHaveLength(1);
  });

  it('#306: every drawer step has a nonblank title', () => {
    const steps = ['name', 'wizard_step1', 'wizard_step2', 'scopes', 'done'] as const;
    for (const s of steps) {
      expect(getStepTitle(s, false).trim().length).toBeGreaterThan(0);
      expect(getStepTitle(s, true).trim().length).toBeGreaterThan(0);
    }
    expect(getStepTitle('done', true)).toContain('Agent Key');
  });
});
