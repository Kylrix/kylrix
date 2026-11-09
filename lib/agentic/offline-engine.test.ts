import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseOfflineIntent,
  executeDeterministicOfflineIntent,
  executeDualPathAgent,
  WORKSPACE_SLASH_COMMANDS,
} from './offline-engine';
import { LocalEngine } from '@/lib/services/LocalEngine';

describe('Deterministic Offline Intent Engine', () => {
  const memoryCache = new Map<string, any>();

  beforeEach(async () => {
    vi.restoreAllMocks();
    memoryCache.clear();

    vi.spyOn(LocalEngine, 'cacheGet').mockImplementation(async (key: string) => {
      return memoryCache.get(key) || null;
    });

    vi.spyOn(LocalEngine, 'cacheSet').mockImplementation(async (key: string, data: any) => {
      memoryCache.set(key, data);
    });
  });

  describe('parseOfflineIntent', () => {
    it('parses slash commands correctly', () => {
      expect(parseOfflineIntent('/note Architecture Spec')).toEqual({
        verb: 'create',
        entity: 'note',
        argument: 'Architecture Spec',
      });

      expect(parseOfflineIntent('/goal Ship Release 2.0')).toEqual({
        verb: 'create',
        entity: 'goal',
        argument: 'Ship Release 2.0',
      });

      expect(parseOfflineIntent('/search roadmap')).toEqual({
        verb: 'search',
        entity: 'query',
        argument: 'roadmap',
      });

      expect(parseOfflineIntent('/vault github_pat')).toEqual({
        verb: 'vault',
        entity: 'query',
        argument: 'github_pat',
      });
    });

    it('parses verb-noun natural language heuristics', () => {
      expect(parseOfflineIntent('Create note: Deployment checklist')).toEqual({
        verb: 'create',
        entity: 'note',
        argument: 'Deployment checklist',
      });

      expect(parseOfflineIntent('Draft a note Sprint retro')).toEqual({
        verb: 'create',
        entity: 'note',
        argument: 'Sprint retro',
      });

      expect(parseOfflineIntent('Add goal: Finalize Q3 milestones')).toEqual({
        verb: 'create',
        entity: 'goal',
        argument: 'Finalize Q3 milestones',
      });

      expect(parseOfflineIntent('Complete goal Sprint retro')).toEqual({
        verb: 'complete',
        entity: 'goal',
        argument: 'Sprint retro',
      });

      expect(parseOfflineIntent('Find database migration docs')).toEqual({
        verb: 'search',
        entity: 'query',
        argument: 'database migration docs',
      });
    });

    it('returns null for empty or unparseable input', () => {
      expect(parseOfflineIntent('')).toBeNull();
      expect(parseOfflineIntent('   ')).toBeNull();
    });
  });

  describe('executeDeterministicOfflineIntent', () => {
    it('creates note and stores in LocalEngine optimistically', async () => {
      const res = await executeDeterministicOfflineIntent('/note Test offline note', {
        workspaceId: 'ws_demo',
        workspaceTitle: 'Demo Project',
        userId: 'user_123',
      });

      expect(res.handled).toBe(true);
      expect(res.type).toBe('create_note');
      expect(res.summary).toContain('Test offline note');
      expect(res.toolCall?.toolKey).toBe('create_note');
      expect(res.payload?.projectId).toBe('ws_demo');

      const cached = await LocalEngine.cacheGet<any>(`note_${res.payload.$id}`);
      expect(cached).toBeDefined();
      expect(cached.title).toBe('Test offline note');
    });

    it('creates goal and stores in LocalEngine optimistically', async () => {
      const res = await executeDeterministicOfflineIntent('Create goal: Finish testing', {
        workspaceId: 'ws_demo',
        workspaceTitle: 'Demo Project',
        userId: 'user_123',
      });

      expect(res.handled).toBe(true);
      expect(res.type).toBe('create_goal');
      expect(res.summary).toContain('Finish testing');
      expect(res.toolCall?.toolKey).toBe('create_goal');
      expect(res.payload?.status).toBe('todo');

      const cached = await LocalEngine.cacheGet<any>(`goal_${res.payload.$id}`);
      expect(cached).toBeDefined();
      expect(cached.title).toBe('Finish testing');
    });

    it('completes existing goal in LocalEngine', async () => {
      const goalId = 'goal_test_complete';
      const initialGoal = {
        $id: goalId,
        id: goalId,
        title: 'Draft Whitepaper',
        status: 'todo',
      };
      await LocalEngine.cacheSet('f_tasks_list_user_123', [initialGoal]);

      const res = await executeDeterministicOfflineIntent('Complete goal Draft Whitepaper', {
        workspaceId: 'ws_demo',
        userId: 'user_123',
      });

      expect(res.handled).toBe(true);
      expect(res.type).toBe('complete_goal');
      expect(res.summary).toContain('Marked goal completed: **Draft Whitepaper**');

      const cached = await LocalEngine.cacheGet<any>(`goal_${goalId}`);
      expect(cached?.status).toBe('completed');
    });
  });

  describe('executeDualPathAgent', () => {
    it('uses online executor when online and successful', async () => {
      const onlineExecutor = vi.fn().mockResolvedValue({
        success: true,
        response: 'Online response from LLM.\n\n```json\n{"toolCall": {"toolKey": "create_note", "args": {"title": "Sample"}}}\n```',
      });

      const res = await executeDualPathAgent({
        prompt: 'Create note: Sample',
        workspaceId: 'ws_1',
        onlineExecutor,
      });

      expect(res.mode).toBe('online');
      expect(res.response).toContain('Online response from LLM');
      expect(res.toolCall?.toolKey).toBe('create_note');
    });

    it('falls back to offline engine when online executor fails', async () => {
      const onlineExecutor = vi.fn().mockRejectedValue(new Error('Network error'));

      const res = await executeDualPathAgent({
        prompt: '/note Fallback Note',
        workspaceId: 'ws_1',
        onlineExecutor,
      });

      expect(res.mode).toBe('offline');
      expect(res.response).toContain('Fallback Note');
      expect(res.offlineResult?.type).toBe('create_note');
    });

    it('falls back to offline engine when online executor times out (> timeoutMs)', async () => {
      const onlineExecutor = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 500)));

      const res = await executeDualPathAgent({
        prompt: '/goal Timed Out Goal',
        workspaceId: 'ws_1',
        timeoutMs: 50,
        onlineExecutor,
      });

      expect(res.mode).toBe('offline');
      expect(res.response).toContain('timed out');
      expect(res.offlineResult?.type).toBe('create_goal');
    });
  });

  describe('WORKSPACE_SLASH_COMMANDS', () => {
    it('contains all standard slash command action chips', () => {
      const labels = WORKSPACE_SLASH_COMMANDS.map((c) => c.label);
      expect(labels).toContain('/note');
      expect(labels).toContain('/goal');
      expect(labels).toContain('/search');
      expect(labels).toContain('/vault');
    });
  });
});
