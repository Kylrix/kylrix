import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isJevAvailable,
  executeJevDecision,
  triageItemUrgency,
  routeWorkflowAction,
} from './jev';

describe('Jev Decision Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('isJevAvailable', () => {
    it('returns true when JEV_API is set', () => {
      process.env.JEV_API = 'test-key';
      expect(isJevAvailable()).toBe(true);
    });

    it('returns true when OPENROUTER_API_KEY is set', () => {
      delete process.env.JEV_API;
      process.env.OPENROUTER_API_KEY = 'test-openrouter';
      expect(isJevAvailable()).toBe(true);
    });

    it('returns false when neither key is set', () => {
      delete process.env.JEV_API;
      delete process.env.OPENROUTER_API_KEY;
      expect(isJevAvailable()).toBe(false);
    });
  });

  describe('executeJevDecision', () => {
    it('fails gracefully when no API key is set', async () => {
      delete process.env.JEV_API;
      delete process.env.OPENROUTER_API_KEY;

      const res = await executeJevDecision({
        state: 'Test input',
        questions: {
          test: {
            type: 'noul',
            instructions: 'Is this a test?',
          },
        },
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Jev API key is not configured');
    });

    it('calls OpenRouter decisions endpoint and returns structured decisions', async () => {
      process.env.JEV_API = 'sk-mock-key';

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          decisions: {
            urgency: { choice: 'urgent', confidence: 0.98 },
            actionable: 0.95,
          },
        }),
      });
      global.fetch = mockFetch;

      const res = await executeJevDecision({
        state: 'Emergency server down',
        questions: {
          urgency: {
            type: 'choice',
            instructions: 'Rate urgency',
            criteria: { urgent: 'Emergency', low: 'Not urgent' },
          },
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/alpha/decisions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-mock-key',
          }),
        })
      );
      expect(res.success).toBe(true);
      expect(res.decisions?.urgency.choice).toBe('urgent');
    });
  });

  describe('triageItemUrgency', () => {
    it('uses Jev when configured and returns parsed triage object', async () => {
      process.env.JEV_API = 'sk-mock-key';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          decisions: {
            urgency: { choice: 'high', confidence: 0.92 },
            actionable: 0.85,
            domain: { choice: 'dev', confidence: 0.88 },
          },
        }),
      });

      const result = await triageItemUrgency({
        title: 'Fix database connection timeout',
        content: 'Production database is timing out after 30s under load',
        type: 'note',
      });

      expect(result.evaluatedBy).toBe('jev');
      expect(result.urgency).toBe('high');
      expect(result.isActionable).toBe(true);
      expect(result.domain).toBe('dev');
    });

    it('falls back to deterministic heuristics when Jev is unavailable', async () => {
      delete process.env.JEV_API;
      delete process.env.OPENROUTER_API_KEY;

      const result = await triageItemUrgency({
        title: 'Urgent: Fix billing payment crypto gateway ASAP',
        content: 'Investigate failed webhook',
        type: 'goal',
      });

      expect(result.evaluatedBy).toBe('heuristic');
      expect(result.urgency).toBe('urgent');
      expect(result.isActionable).toBe(true);
      expect(result.domain).toBe('finance');
    });
  });

  describe('routeWorkflowAction', () => {
    it('routes workflow action via Jev choice decision', async () => {
      process.env.JEV_API = 'sk-mock-key';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          decisions: {
            target_action: { choice: 'convert_idea_to_goal', confidence: 0.94 },
          },
        }),
      });

      const actions = [
        { id: 'convert_idea_to_goal', description: 'Convert this note to actionable tasks' },
        { id: 'vault_export_copy', description: 'Copy vault credentials' },
      ];

      const res = await routeWorkflowAction('Turn my ideas into action tasks', actions);

      expect(res.evaluatedBy).toBe('jev');
      expect(res.selectedId).toBe('convert_idea_to_goal');
      expect(res.confidence).toBe(0.94);
    });
  });
});
