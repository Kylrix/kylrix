import { describe, it, expect } from 'vitest';
import { mcpListResult } from './common';
import { shapeAgentSessionListItem, shapeAgentSessionDetail } from './agents';
import { shapeVaultItem, shapeTotpSecret } from './vault';
import { shapeGoal, buildGoalCreateRow, buildGoalUpdatePatch, resolveWorkspaceId } from './goals';
import { shapeWorkspace, shapeWorkspaceCollaborator } from './workspaces';
import { shapeWorkspaceProject } from './projects';
import { shapeNote } from './notes';
import { shapeThread, shapeThreadMessage, shapeLegacyThreadComment } from './threads';
import { shapeProfile, shapeTokenMe, shapeTokenScopeCatalog, shapeTokenRefreshResult } from './auth';
import { shapeChatListItem, shapeChatDetail, shapeChatMessage } from './chats';
import { shapeEventListItem, shapeEventDetail } from './events';
import { shapeFlowListItem, shapeFlowInstallListItem, resolveFlowCreateFields } from './flows';
import { shapeFormListItem, shapeFormDetail } from './forms';
import { shapeMoment, shapeMomentCommentEcosystem, shapeMomentCommentNostr, shapeMomentCommentCreated } from './moments';
import { shapeTag } from './tags';
import { shapeTrashNoteItem, shapeTrashGoalItem, shapeTrashVaultItem, shapeTrashEventItem, shapeTrashFormItem } from './trash';

describe('sdk/contracts helpers', () => {
  it('common helpers', () => {
    const listRes = mcpListResult(['a', 'b']);
    expect(listRes).toEqual({ items: ['a', 'b'] });
  });

  it('agents contract helpers', () => {
    const item = shapeAgentSessionListItem({ $id: 's1', context: 'Goal', status: 'active' });
    expect(item.id).toBe('s1');
    expect(item.title).toBe('Goal');

    const detail = shapeAgentSessionDetail({
      $id: 's1',
      chatHistory: JSON.stringify([{ role: 'user', content: 'Hi' }]),
    });
    expect(detail.id).toBe('s1');
    expect(detail.history.length).toBe(1);

    const badDetail = shapeAgentSessionDetail({ $id: 's2', chatHistory: 'invalid-json{' });
    expect(badDetail.history).toEqual([]);
  });

  it('vault contract helpers', () => {
    const vaultItem = shapeVaultItem(
      { $id: 'v1', name: 'My Secret', password: 'secretpassword' },
      { unsealed: { name: 'My Secret', password: 'unsealedpassword' }, hasMek: true }
    );
    expect(vaultItem.id).toBe('v1');
    expect(vaultItem.secret).toBe('unsealedpassword');

    const unsealedVaultItem = shapeVaultItem(
      { $id: 'v2', name: 'EncryptedName', username: 'EncryptedUser' },
      { looksEncrypted: () => true, hasMek: false }
    );
    expect(unsealedVaultItem.name).toBe('Protected Secret');
    expect(unsealedVaultItem.username).toBeNull();

    const totpItem = shapeTotpSecret(
      { $id: 't1', issuer: 'GitHub', secretKey: 'JBSWY3DPEHPK3PXP' },
      { unsealed: { issuer: 'GitHub', secretKey: 'JBSWY3DPEHPK3PXP' }, hasMek: true }
    );
    expect(totpItem.id).toBe('t1');
    expect(totpItem.issuer).toBe('GitHub');

    const unsealedTotp = shapeTotpSecret(
      { $id: 't2', issuer: 'EncryptedIssuer' },
      { looksEncrypted: () => true, hasMek: false }
    );
    expect(unsealedTotp.issuer).toBe('Encrypted Code');
  });

  it('goals contract helpers', () => {
    const goal = shapeGoal({ $id: 'g1', title: 'Goal 1', isPublic: true, isGuest: false });
    expect(goal.id).toBe('g1');
    expect(goal.title).toBe('Goal 1');

    const row = buildGoalCreateRow('user-1', {
      title: ' New Goal ',
      summary: 'Goal Summary',
      status: 'todo',
      priority: 'high',
      isPublic: true,
      isGuest: true,
      tags: ['tag1'],
      isPinned: true,
      isAgentic: true,
    });
    expect(row.title).toBe('New Goal');
    expect(row.description).toBe('Goal Summary');
    expect(row.priority).toBe('high');

    const patch = buildGoalUpdatePatch({
      title: 'Updated Goal',
      status: 'done',
      description: 'Desc',
      summary: 'Sum',
      priority: 'urgent',
      dueDate: '2025-12-31',
      isPublic: false,
      isGuest: false,
      isPinned: false,
      isAgentic: false,
      tags: ['t2'],
    });
    expect(patch.title).toBe('Updated Goal');
    expect(patch.status).toBe('done');
    expect(patch.completedAt).toBeDefined();

    const patchNotDone = buildGoalUpdatePatch({
      status: 'in_progress',
      summary: 'Summary update',
    });
    expect(patchNotDone.completedAt).toBeNull();

    expect(resolveWorkspaceId({ workspaceId: 'ws-100' })).toBe('ws-100');
    expect(resolveWorkspaceId({ projectId: 'p-200' })).toBe('p-200');
    expect(resolveWorkspaceId({})).toBeNull();
  });

  it('workspaces & projects contract helpers', () => {
    const ws = shapeWorkspace({ $id: 'w1', name: 'Workspace One' }, { isShared: true, role: 'admin' });
    expect(ws.id).toBe('w1');
    expect(ws.title).toBe('Workspace One');
    expect(ws.isShared).toBe(true);

    const collab = shapeWorkspaceCollaborator({ $id: 'c1', userId: 'u1', permission: 'admin' });
    expect(collab.id).toBe('c1');
    expect(collab.role).toBe('admin');

    const proj = shapeWorkspaceProject({ $id: 'p1', name: 'Project One' }, 'w1');
    expect(proj.id).toBe('p1');
    expect(proj.parentWorkspaceId).toBe('w1');
  });

  it('notes & threads contract helpers', () => {
    const note = shapeNote({ $id: 'n1', title: 'Idea 1' });
    expect(note.id).toBe('n1');

    const thread = shapeThread({ $id: 'th1', title: 'Thread 1' });
    expect(thread.id).toBe('th1');

    const msg = shapeThreadMessage({ $id: 'tm1', threadId: 'th1', content: 'hello' });
    expect(msg.id).toBe('tm1');

    const legacyComment = shapeLegacyThreadComment({ $id: 'lc1', userId: 'u1', content: 'legacy' }, 'th1');
    expect(legacyComment.id).toBe('lc1');
    expect(legacyComment.legacy).toBe(true);
  });

  it('auth contract helpers', () => {
    const authProfile = shapeProfile({ userId: 'u1', kind: 'user', scopes: ['read'] });
    expect(authProfile.id).toBe('u1');

    const tokenMe = shapeTokenMe({ kind: 'session', userId: 'u1', scopes: ['read'] });
    expect(tokenMe.userId).toBe('u1');

    const tokenMePat = shapeTokenMe({ kind: 'pat', userId: 'u1', scopes: ['read'], patId: 'pat-1' });
    expect(tokenMePat.patId).toBe('pat-1');

    const catalog = shapeTokenScopeCatalog(['read', 'write']);
    expect(catalog.scopes).toEqual(['read', 'write']);

    const refresh = shapeTokenRefreshResult({ scopes: ['read'] }, 'hint-text');
    expect(refresh.hint).toBe('hint-text');
  });

  it('chats, events, flows, forms, moments, tags, trash contract helpers', () => {
    const chatListItem = shapeChatListItem({ $id: 'c1', name: 'General', participants: ['u1', 'u2'] });
    expect(chatListItem.id).toBe('c1');

    const chatDetail = shapeChatDetail({ $id: 'c1', name: 'General', participants: ['u1'] });
    expect(chatDetail.participants).toEqual(['u1']);

    const chatMsg = shapeChatMessage({ $id: 'm1', content: 'hello', isEncrypted: true }, true);
    expect(chatMsg.id).toBe('m1');
    expect(chatMsg.isEncrypted).toBe(true);

    const eventListItem = shapeEventListItem({ $id: 'e1', title: 'Launch' });
    expect(eventListItem.id).toBe('e1');

    const eventDetail = shapeEventDetail({ $id: 'e1', title: 'Launch' });
    expect(eventDetail.title).toBe('Launch');

    expect(() => resolveFlowCreateFields({})).toThrow('name required');
    const flowFields = resolveFlowCreateFields({ name: 'My Flow' });
    expect(flowFields.name).toBe('My Flow');

    const flowItem = shapeFlowListItem({ $id: 'fl1', name: 'Flow 1', steps: '[]' });
    expect(flowItem.id).toBe('fl1');

    const flowInstall = shapeFlowInstallListItem({ $id: 'i1', flowId: 'fl1' });
    expect(flowInstall.flowId).toBe('fl1');

    const formItem = shapeFormListItem({ $id: 'fm1', title: 'Feedback' });
    expect(formItem.id).toBe('fm1');

    const formDetail = shapeFormDetail({ $id: 'fm1', title: 'Feedback', schema: '[]' });
    expect(formDetail.fields).toEqual([]);

    const moment = shapeMoment({ $id: 'm1', caption: 'Great day' });
    expect(moment.id).toBe('m1');

    const momentNostr = shapeMomentCommentNostr({ id: 'n1', content: 'test', pubkey: 'p1', created_at: 1000 });
    expect(momentNostr.id).toBe('n1');

    const momentEco = shapeMomentCommentEcosystem({ $id: 'e1', caption: 'test' });
    expect(momentEco.id).toBe('e1');

    const momentCreated = shapeMomentCommentCreated({ id: 'c1', content: 'text', userId: 'u1', createdAt: 'now' });
    expect(momentCreated.id).toBe('c1');

    const tag = shapeTag({ $id: 't1', name: 'release', metadata: '{"color":"#fff","description":"desc"}' });
    expect(tag.id).toBe('t1');
    expect(tag.color).toBe('#fff');

    const tagObjectMeta = shapeTag({ $id: 't2', metadata: { color: '#000', description: 'desc2' } });
    expect(tagObjectMeta.color).toBe('#000');

    expect(shapeTrashNoteItem({ $id: 'tr1', title: 'Note 1', content: 'Note content' }).kind).toBe('note');
    expect(shapeTrashNoteItem({ id: 'tr1_alt', summary: 'Summary' }).summary).toBe('Summary');

    expect(shapeTrashGoalItem({ $id: 'tr2', title: 'Goal 1', updatedAt: '2025-01-01' }).kind).toBe('goal');
    expect(shapeTrashVaultItem({ $id: 'tr3', name: 'Secret 1', username: 'usr', url: 'https://site.com' }).kind).toBe('vault');
    expect(shapeTrashEventItem({ $id: 'tr4', name: 'Event 1' }).kind).toBe('event');
    expect(shapeTrashFormItem({ $id: 'tr5', name: 'Form 1' }).kind).toBe('form');
  });
});
