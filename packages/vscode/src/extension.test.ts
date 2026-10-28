import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { StatusTreeProvider } from './views/status';
import { IdeasTreeProvider } from './views/ideas';
import { GoalsTreeProvider } from './views/goals';
import { VaultTreeProvider } from './views/vault';
import { TotpTreeProvider } from './views/totp';
import { copyAgentKeyCommand, injectTerminalSecretsCommand } from './extension';

const VALID_AET = `kyl_aet_a1b2c3d4_${'A'.repeat(32)}.etk_${'ab'.repeat(32)}`;

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

describe('Agent key commands', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (vscode as any).createdTerminals?.splice(0);
  });

  it('injectTerminalSecrets opens a transient terminal with env, never sendText', async () => {
    const inputSpy = vi
      .spyOn(vscode.window, 'showInputBox')
      .mockResolvedValue(VALID_AET as any);
    const createSpy = vi.spyOn(vscode.window, 'createTerminal');

    await injectTerminalSecretsCommand();

    expect(inputSpy).toHaveBeenCalledWith(
      expect.objectContaining({ password: true, validateInput: expect.any(Function) })
    );
    expect(createSpy).toHaveBeenCalledTimes(1);
    const opts = createSpy.mock.calls[0][0] as any;
    expect(opts.isTransient).toBe(true);
    expect(opts.env.KYLRIX_AGENT_KEY).toBe(VALID_AET);

    const terminal = createSpy.mock.results[0].value;
    const sendSpy = vi.spyOn(terminal, 'sendText');
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('injectTerminalSecrets does nothing when input is cancelled', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue(undefined as any);
    const createSpy = vi.spyOn(vscode.window, 'createTerminal');
    await injectTerminalSecretsCommand();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('copyAgentKey masks input and validates it', async () => {
    const inputSpy = vi
      .spyOn(vscode.window, 'showInputBox')
      .mockResolvedValue(VALID_AET as any);
    const clipSpy = vi.spyOn(vscode.env.clipboard, 'writeText').mockResolvedValue(undefined as any);

    await copyAgentKeyCommand();

    const opts = inputSpy.mock.calls[0][0] as any;
    expect(opts.password).toBe(true);
    expect(opts.validateInput('garbage')).toBeTruthy();
    expect(opts.validateInput(VALID_AET)).toBeNull();
    expect(clipSpy).toHaveBeenCalledWith(VALID_AET);
  });
});
