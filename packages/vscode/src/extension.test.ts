import { describe, it, expect } from 'vitest';
import { StatusTreeProvider } from './views/status';
import { IdeasTreeProvider } from './views/ideas';
import { GoalsTreeProvider } from './views/goals';
import { VaultTreeProvider } from './views/vault';
import { TotpTreeProvider } from './views/totp';

describe('Kylrix VS Code Extension TreeView Providers', () => {
  it('StatusTreeProvider returns status tree items', async () => {
    const provider = new StatusTreeProvider();
    const children = await provider.getChildren();
    expect(children.length).toBeGreaterThan(0);
    const labels = children.map((c) => c.label);
    expect(labels.some((l) => l.includes('Account'))).toBe(true);
    expect(labels.some((l) => l.includes('Server'))).toBe(true);
    expect(labels.some((l) => l.includes('Workspace'))).toBe(true);
  });

  it('IdeasTreeProvider returns category groups or items', async () => {
    const provider = new IdeasTreeProvider();
    const children = await provider.getChildren();
    expect(Array.isArray(children)).toBe(true);
  });

  it('GoalsTreeProvider returns goal items or empty placeholder', async () => {
    const provider = new GoalsTreeProvider();
    const children = await provider.getChildren();
    expect(Array.isArray(children)).toBe(true);
    expect(children.length).toBeGreaterThan(0);
  });

  it('VaultTreeProvider returns vault items or empty placeholder', async () => {
    const provider = new VaultTreeProvider();
    const children = await provider.getChildren();
    expect(Array.isArray(children)).toBe(true);
    expect(children.length).toBeGreaterThan(0);
  });

  it('TotpTreeProvider returns TOTP items or empty placeholder', async () => {
    const provider = new TotpTreeProvider();
    const children = await provider.getChildren();
    expect(Array.isArray(children)).toBe(true);
    expect(children.length).toBeGreaterThan(0);
  });
});
