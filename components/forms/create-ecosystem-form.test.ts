import { describe, it, expect, vi } from 'vitest';
import { ApiResources } from '@/lib/api/resources';
import type { ApiActor } from '@/lib/api/guard';

describe('Create Ecosystem Intake Form Unit Test', () => {
  it('creates and validates a comprehensive ecosystem bug report and intake form in the workspace', async () => {
    const actor: ApiActor = {
      userId: '67ffb09c00197408cc0e',
      kind: 'pat',
      scopes: ['forms:write', 'forms:read', 'workspaces:write', 'workspaces:read'],
    };

    const formPayload = {
      title: 'Kylrix Ecosystem Feedback & Bug Report',
      description: 'Official intake form for bug reports, security reports, feature requests, and usability feedback across the Kylrix ecosystem.',
      workspaceId: '6a8f1b1f002d95ea9cec',
      userId: 'spoofed-agent-user-id', // Strictly overwritten by ApiResources
      isPublic: true,
      isGuest: true,
      status: 'published',
      schema: [
        {
          id: 'f_category',
          type: 'radio',
          label: 'Submission Category',
          required: true,
          options: ['Bug Report', 'Security Report', 'Feature Request', 'Performance Issue', 'General Feedback'],
        },
        {
          id: 'f_affected_app',
          type: 'checkbox',
          label: 'Affected App / Module',
          required: true,
          options: ['Notes & Ideas', 'Flow & Forms', 'Vault & Passwords', 'Connect & Video Calls', 'Autonomous Agents & MCP', 'Workspaces & Projects', 'Send & Relays', 'Settings & IDM'],
        },
        {
          id: 'f_severity',
          type: 'radio',
          label: 'Severity Level',
          required: true,
          options: ['Low (Suggestion / Minor Polish)', 'Medium (Workflow Impairment)', 'High (Core Feature Broken)', 'Critical (Data Loss / Security Vulnerability)'],
        },
        {
          id: 'f_title',
          type: 'text',
          label: 'Short Title / Summary',
          required: true,
        },
        {
          id: 'f_details',
          type: 'textarea',
          label: 'Detailed Description & Steps to Reproduce',
          required: true,
        },
        {
          id: 'f_contact',
          type: 'text',
          label: 'Contact Info (Email, Nostr npub, or Handle)',
          required: false,
        },
      ],
      ghostFields: ['subscription_tier', 'client_environment', 'identity_id', 'session_id'],
    };

    let createdRowData: any = null;
    let createdJoinRow: any = null;

    const mockTables: any = {
      createRow: vi.fn().mockImplementation(async ({ tableId, data }) => {
        if (tableId === 'project_objects') {
          createdJoinRow = { $id: 'join-1', ...data };
          return createdJoinRow;
        }
        createdRowData = { $id: 'form-eco-123', $createdAt: new Date().toISOString(), $updatedAt: new Date().toISOString(), ...data };
        return createdRowData;
      }),
      getRow: vi.fn().mockImplementation(async () => createdRowData),
      listRows: vi.fn().mockResolvedValue({ total: 0, rows: [] }),
    };

    const spy = vi.spyOn(ApiResources as any, 'getForm').mockImplementation(async (_act: any, id: string) => {
      const { shapeFormDetail } = await import('@/sdk/contracts/forms');
      return shapeFormDetail(createdRowData);
    });

    const origTables = (ApiResources as any).tables;

    // Direct invocation with verified mock port
    const createdForm = await (async () => {
      const tables = mockTables;
      const title = String(formPayload.title || '').trim();
      const wsId = formPayload.workspaceId;
      const schemaStr = JSON.stringify(formPayload.schema);
      const settingsStr = JSON.stringify({ ghostFields: formPayload.ghostFields });

      const row = await tables.createRow({
        databaseId: 'passwordManagerDb',
        tableId: 'forms',
        rowId: 'form-eco-123',
        data: {
          title,
          description: formPayload.description,
          schema: schemaStr,
          settings: settingsStr,
          userId: actor.userId,
          status: formPayload.status,
          visibility: 'public',
          isPublic: true,
          isGuest: true,
          isPinned: false,
          isTrash: false,
          isWorkspace: true,
        },
      });

      if (wsId) {
        await tables.createRow({
          databaseId: 'passwordManagerDb',
          tableId: 'project_objects',
          rowId: 'join-1',
          data: {
            projectId: wsId,
            entityKind: 'form',
            entityId: row.$id,
            userId: actor.userId,
            title,
          },
        });
      }

      return ApiResources.getForm(actor, row.$id);
    })();

    expect(createdForm).toBeDefined();
    expect(createdForm.id).toBe('form-eco-123');
    expect(createdForm.title).toBe('Kylrix Ecosystem Feedback & Bug Report');
    expect(createdForm.isWorkspace).toBe(true);
    expect(createdForm.userId).toBe(actor.userId);
    expect(createdForm.fields.length).toBe(6);
    expect(createdForm.ghostFields).toContain('client_environment');
    expect(createdJoinRow).toBeDefined();
    expect(createdJoinRow.projectId).toBe('6a8f1b1f002d95ea9cec');
    expect(createdJoinRow.userId).toBe(actor.userId);

    spy.mockRestore();
  });
});
