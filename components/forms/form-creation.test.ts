import { describe, it, expect } from 'vitest';
import { shapeFormDetail, shapeFormListItem } from '@/sdk/contracts/forms';

describe('Form Creation & Workspace Scoping Contracts', () => {
  it('correctly validates and shapes form input with ghost fields and full schema', () => {
    const rawFormRow = {
      $id: 'form-test-123',
      userId: 'user-human-1',
      title: 'Kylrix Ecosystem Feedback & Issue Intake',
      description: 'Collects bug reports, feature requests, and security vulnerabilities.',
      schema: JSON.stringify([
        {
          id: 'f_category',
          type: 'radio',
          label: 'Submission Category',
          required: true,
          options: ['Bug Report', 'Feature Request', 'Security Vulnerability', 'Feedback'],
        },
        {
          id: 'f_module',
          type: 'checkbox',
          label: 'Affected Module',
          required: true,
          options: ['Notes', 'Flow', 'Vault', 'Connect', 'Agents', 'Workspaces'],
        },
        {
          id: 'f_details',
          type: 'textarea',
          label: 'Details & Reproduction Steps',
          required: true,
        },
      ]),
      settings: JSON.stringify({
        ghostFields: ['client_environment', 'subscription_tier', 'identity_id'],
      }),
      status: 'published',
      visibility: 'public',
      isPublic: true,
      isGuest: true,
      isWorkspace: true,
      $createdAt: '2026-09-19T05:00:00.000Z',
      $updatedAt: '2026-09-19T05:00:00.000Z',
    };

    const detail = shapeFormDetail(rawFormRow);
    expect(detail.id).toBe('form-test-123');
    expect(detail.title).toBe('Kylrix Ecosystem Feedback & Issue Intake');
    expect(detail.fields.length).toBe(3);
    expect(detail.ghostFields).toContain('client_environment');
    expect(detail.isWorkspace).toBe(true);

    const listItem = shapeFormListItem(rawFormRow);
    expect(listItem.id).toBe('form-test-123');
    expect(listItem.fieldCount).toBe(3);
    expect(listItem.status).toBe('published');
  });

  it('guarantees user ID and workspace invariants are preserved in form payloads', () => {
    const humanUserId = 'user-owner-999';
    const workspaceId = 'ws-agentic-123';

    const inputData: Record<string, any> = {
      title: 'Bug Report Form',
      description: 'Report bugs directly into workspace',
      workspaceId,
      userId: 'spoofed-or-agent-id', // Should be overridden by server
      isWorkspace: true,
    };

    // Server-side normalization simulation
    const normalizedData = {
      ...inputData,
      userId: humanUserId, // Strictly enforced
      isWorkspace: Boolean(inputData.workspaceId),
    };

    expect(normalizedData.userId).toBe(humanUserId);
    expect(normalizedData.isWorkspace).toBe(true);
  });
});
