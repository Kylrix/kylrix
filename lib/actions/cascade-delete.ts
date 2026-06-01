'use server';

import { Query } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createSystemClient, createSystemTablesDB } from '@/lib/appwrite-admin';

/**
 * Helper to wipe both key mappings and polymorphic collaborators for any resource.
 */
async function wipeCollaboratorsAndKeys(
  tables: any,
  resourceId: string,
  resourceType: string
) {
  const VAULT_DB = APPWRITE_CONFIG.DATABASES.VAULT;
  const FLOW_DB = APPWRITE_CONFIG.DATABASES.FLOW;
  const POLYMORPHIC_COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';

  // 1. Wipe key mappings
  try {
    const mappingsRes = await tables.listRows({
      databaseId: VAULT_DB,
      tableId: 'key_mapping',
      queries: [
        Query.equal('resourceType', resourceType),
        Query.equal('resourceId', resourceId),
        Query.limit(1000),
      ] as any,
    });

    await Promise.all(
      (mappingsRes.rows || []).map((m: any) =>
        tables.deleteRow({
          databaseId: VAULT_DB,
          tableId: 'key_mapping',
          rowId: m.$id,
        })
      )
    );
    console.log(`[Cascade Delete] Wiped ${mappingsRes.rows?.length || 0} key mappings for resource ${resourceId} (${resourceType})`);
  } catch (err) {
    console.error(`[Cascade Delete] Key mapping cleanup failed for ${resourceType} ${resourceId}:`, err);
  }

  // 2. Wipe polymorphic collaborators
  try {
    const polyCollabsRes = await tables.listRows({
      databaseId: FLOW_DB,
      tableId: POLYMORPHIC_COLLABORATORS_TABLE,
      queries: [
        Query.equal('resourceId', resourceId),
        Query.equal('resourceType', resourceType),
        Query.limit(1000),
      ] as any,
    });

    await Promise.all(
      (polyCollabsRes.rows || []).map((collab: any) =>
        tables.deleteRow({
          databaseId: FLOW_DB,
          tableId: POLYMORPHIC_COLLABORATORS_TABLE,
          rowId: collab.$id,
        })
      )
    );
    console.log(`[Cascade Delete] Wiped ${polyCollabsRes.rows?.length || 0} polymorphic collaborators for resource ${resourceId} (${resourceType})`);
  } catch (err) {
    console.error(`[Cascade Delete] Polymorphic collaborators cleanup failed for ${resourceType} ${resourceId}:`, err);
  }
}

/**
 * Helper to dynamically resolve database and table IDs based on resource entity kind.
 */
function getResourceDbAndTable(entityKind: string) {
  const lower = entityKind.toLowerCase();
  if (lower === 'note') {
    return { databaseId: APPWRITE_CONFIG.DATABASES.NOTE, tableId: APPWRITE_CONFIG.TABLES.NOTE.NOTES };
  }
  if (lower === 'goal' || lower === 'task') {
    return { databaseId: APPWRITE_CONFIG.DATABASES.FLOW, tableId: APPWRITE_CONFIG.TABLES.FLOW.TASKS };
  }
  if (lower === 'password' || lower === 'credential' || lower === 'secret') {
    return { databaseId: APPWRITE_CONFIG.DATABASES.VAULT, tableId: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS };
  }
  if (lower === 'totp') {
    return { databaseId: APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER, tableId: 'totpSecrets' };
  }
  if (lower === 'event') {
    return { databaseId: APPWRITE_CONFIG.DATABASES.KYLRIXFLOW, tableId: 'events' };
  }
  if (lower === 'form') {
    return { databaseId: APPWRITE_CONFIG.DATABASES.FLOW, tableId: APPWRITE_CONFIG.TABLES.FLOW.FORMS };
  }
  return null;
}

import { getActor } from './secure-ops';

// ... (rest of imports)

/**
 * Centrally and recursively deletes all connected, linked, or owned child resources
 * when a parent row is deleted.
 * Follows "The Golden Rule of Server Action Security".
 */
export async function executeCascadeDeleteSecure(
  databaseId: string,
  tableId: string,
  rowId: string,
  projectDeleteMode: 'detach' | 'created_within' | 'all' = 'detach',
  jwt?: string
): Promise<void> {
  const actor = await getActor(jwt);
  if (!actor?.$id) throw new Error('Unauthorized');

  const tables = createSystemTablesDB();

  // Authorization check: Verify if the user owns the resource or is an admin
  try {
    const row = await tables.getRow<any>(databaseId, tableId, rowId);
    if (!row) return; // Already deleted
    
    const isOwner = row.userId === actor.$id || row.creatorId === actor.$id || row.ownerId === actor.$id;
    const { isUserAdmin } = await import('./admin/check-admin');
    const isAdmin = await isUserAdmin();

    if (!isOwner && !isAdmin) {
      throw new Error('Forbidden: You do not have permission to delete this resource.');
    }
  } catch (e: any) {
    if (e.message?.includes('Forbidden')) throw e;
    // If we can't fetch the row to check ownership, we might be in a recursion where the parent was already checked.
    // However, for a public entry point, we must be strict.
  }

  const { storage } = createSystemClient();
  const now = Date.now();

  const NOTE_DB = APPWRITE_CONFIG.DATABASES.NOTE;
  const NOTE_TABLE = APPWRITE_CONFIG.TABLES.NOTE.NOTES;
  const COMMENTS_TABLE = APPWRITE_CONFIG.TABLES.NOTE.COMMENTS;
  const REACTIONS_TABLE = APPWRITE_CONFIG.TABLES.NOTE.REACTIONS;
  const COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.NOTE.COLLABORATORS || 'Collaborators';
  const NOTE_TAGS_TABLE = APPWRITE_CONFIG.TABLES.NOTE.NOTE_TAGS || 'note_tags';
  const TAGS_TABLE = APPWRITE_CONFIG.TABLES.NOTE.TAGS;

  const CHAT_DB = APPWRITE_CONFIG.DATABASES.CHAT;
  const CALL_LINKS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS;

  const FLOW_DB = APPWRITE_CONFIG.DATABASES.FLOW;
  const FORMS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.FORMS;
  const EVENTS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.EVENTS;
  const GUESTS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.GUESTS;

  const VOICE_BUCKET = APPWRITE_CONFIG.BUCKETS.VOICE || 'voice';

  // --- 1. CASCADE FOR NOTES ---
  if (databaseId === NOTE_DB && tableId === NOTE_TABLE) {
    console.log(`[Cascade Delete] Triggered note cascade cleanup for: ${rowId}`);

    // A. Delete Comments & Comment Reactions & Voice Files
    try {
      const commentsRes = await tables.listRows({
        databaseId,
        tableId: COMMENTS_TABLE,
        queries: [Query.equal('noteId', rowId), Query.limit(1000)] as any,
      });

      const rows = (commentsRes.rows as any[]) || [];
      const commentIds = rows.map((c) => c.$id).filter(Boolean);

      if (commentIds.length > 0) {
        // --- 1.1 Handle Voice Note Cleanup ---
        const voiceFileIds: string[] = [];
        for (const row of rows) {
            let voiceFileId = null;
            if (row.isVoice === true) {
                // If it has the new flag, extract from metadata or content
                try {
                    const meta = JSON.parse(row.metadata || '{}');
                    voiceFileId = meta.voiceFileId;
                } catch {}
                if (!voiceFileId && row.content?.startsWith('__voice_note__:')) {
                    voiceFileId = row.content.substring('__voice_note__:'.length);
                }
            } else {
                // Legacy check
                try {
                    const meta = JSON.parse(row.metadata || '{}');
                    if (meta.type === 'voice') voiceFileId = meta.voiceFileId;
                } catch {}
                if (!voiceFileId && row.content?.startsWith('__voice_note__:')) {
                    voiceFileId = row.content.substring('__voice_note__:'.length);
                }
            }

            if (voiceFileId) voiceFileIds.push(voiceFileId);
        }

        if (voiceFileIds.length > 0) {
            console.log(`[Cascade Delete] Purging ${voiceFileIds.length} voice notes...`);
            await Promise.all(voiceFileIds.map(fid => 
                storage.deleteFile(VOICE_BUCKET, fid).catch(err => {
                    console.warn(`[Cascade Delete] Failed to delete voice file ${fid}:`, err?.message);
                })
            ));
        }

        // --- 1.2 Delete Reactions attached to these comments ---
        try {
          const reactionsRes = await tables.listRows({
            databaseId,
            tableId: REACTIONS_TABLE,
            queries: [
              Query.equal('targetType', 'comment'),
              Query.equal('targetId', commentIds),
              Query.limit(1000),
            ] as any,
          });

          await Promise.all(
            reactionsRes.rows.map((r: any) =>
              tables.deleteRow({
                databaseId,
                tableId: REACTIONS_TABLE,
                rowId: r.$id,
              })
            )
          );
        } catch (err) {
          console.error('[Cascade Delete] Note comments reactions cleanup failed:', err);
        }

        // Delete the comments themselves
        await Promise.all(
          commentIds.map((cid) =>
            tables.deleteRow({
              databaseId,
              tableId: COMMENTS_TABLE,
              rowId: cid,
            })
          )
        );
      }
    } catch (err) {
      console.error('[Cascade Delete] Note comments cleanup failed:', err);
    }

    // B. Delete Reactions on the Note itself
    try {
      const reactionsRes = await tables.listRows({
        databaseId,
        tableId: REACTIONS_TABLE,
        queries: [Query.equal('targetId', rowId), Query.limit(1000)] as any,
      });

      await Promise.all(
        reactionsRes.rows.map((r: any) =>
          tables.deleteRow({
            databaseId,
            tableId: REACTIONS_TABLE,
            rowId: r.$id,
          })
        )
      );
    } catch (err) {
      console.error('[Cascade Delete] Note direct reactions cleanup failed:', err);
    }

    // C. Delete Collaborators (Legacy and Polymorphic)
    try {
      const collaboratorsRes = await tables.listRows({
        databaseId,
        tableId: COLLABORATORS_TABLE,
        queries: [Query.equal('noteId', rowId), Query.limit(1000)] as any,
      });

      await Promise.all(
        collaboratorsRes.rows.map((collab: any) =>
          tables.deleteRow({
            databaseId,
            tableId: COLLABORATORS_TABLE,
            rowId: collab.$id,
          })
        )
      );
    } catch (err) {
      console.error('[Cascade Delete] Note legacy collaborators cleanup failed:', err);
    }

    try {
      const FLOW_DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
      const POLYMORPHIC_COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
      const polyCollabsRes = await tables.listRows({
        databaseId: FLOW_DATABASE_ID,
        tableId: POLYMORPHIC_COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceId', rowId),
          Query.equal('resourceType', 'note'),
          Query.limit(1000),
        ] as any,
      });
      await Promise.all(
        polyCollabsRes.rows.map((collab: any) =>
          tables.deleteRow({
            databaseId: FLOW_DATABASE_ID,
            tableId: POLYMORPHIC_COLLABORATORS_TABLE,
            rowId: collab.$id,
          })
        )
      );
    } catch (err) {
      console.error('[Cascade Delete] Note polymorphic collaborators cleanup failed:', err);
    }

    // D. Delete Note Tags Pivots & Decrement Tag usageCount
    try {
      const pivotsRes = await tables.listRows({
        databaseId,
        tableId: NOTE_TAGS_TABLE,
        queries: [Query.equal('resourceId', rowId), Query.equal('resourceType', 'note'), Query.limit(1000)] as any,
      });

      for (const pivot of pivotsRes.rows as any[]) {
        if (pivot.tag) {
          try {
            const tagsRes = await tables.listRows({
              databaseId,
              tableId: TAGS_TABLE,
              queries: [Query.equal('name', pivot.tag), Query.limit(1)] as any,
            });

            if (tagsRes.rows.length > 0) {
              const tagDoc = tagsRes.rows[0];
              const current = typeof tagDoc.usageCount === 'number' ? tagDoc.usageCount : 0;
              await tables.updateRow({
                databaseId,
                tableId: TAGS_TABLE,
                rowId: tagDoc.$id,
                data: { usageCount: Math.max(0, current - 1) },
              });
            }
          } catch (_) {}
        }

        // Delete the pivot entry
        await tables.deleteRow({
          databaseId,
          tableId: NOTE_TAGS_TABLE,
          rowId: pivot.$id,
        });
      }
    } catch (err) {
      console.error('[Cascade Delete] Note tags cleanup failed:', err);
    }

    // E. Delete Vault Key Mappings
    try {
      const mappingsRes = await tables.listRows({
        databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
        tableId: 'key_mapping',
        queries: [
          Query.equal('resourceType', 'note'),
          Query.equal('resourceId', rowId),
          Query.limit(1000),
        ] as any,
      });

      await Promise.all(
        mappingsRes.rows.map((m: any) =>
          tables.deleteRow({
            databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
            tableId: 'key_mapping',
            rowId: m.$id,
          })
        )
      );
    } catch (err) {
      console.error('[Cascade Delete] Note vault key mapping cleanup failed:', err);
    }

    // F. Delete Ephemeral Files for Send (isFile)
    try {
      const note = await tables.getRow<any>(databaseId, tableId, rowId);
      if (note.isFile === true || (note.isGhost === true && note.metadata?.includes('fileId'))) {
        const meta = (() => {
            try { return typeof note.metadata === 'string' ? JSON.parse(note.metadata) : note.metadata; } catch { return {}; }
        })();
        const bucketId = meta?.send_object?.bucketId || APPWRITE_CONFIG.BUCKETS.SEND_EPHEMERAL;
        const fileId = meta?.send_object?.fileId;
        if (bucketId && fileId) {
            console.log(`[Cascade Delete] Purging ephemeral file: ${fileId} from bucket: ${bucketId}`);
            await storage.deleteFile(bucketId, fileId).catch(err => {
                console.warn(`[Cascade Delete] Failed to delete ephemeral file ${fileId}:`, err?.message);
            });
        }
      }
    } catch (err) {
      console.error('[Cascade Delete] Ghost file cleanup failed:', err);
    }
  }

  // --- 2. CASCADE FOR PROJECTS ---
  else if (databaseId === CHAT_DB && tableId === 'projects') {
    console.log(`[Cascade Delete] Triggered project cascade cleanup for: ${rowId} (mode: ${projectDeleteMode})`);

    // A. Fetch project metadata to find discussion ghost note
    let discussionNoteId = '';
    try {
      const projectDoc = await tables.getRow<any>(CHAT_DB, 'projects', rowId);
      if (projectDoc?.metadata) {
        const meta = JSON.parse(projectDoc.metadata);
        discussionNoteId = meta.discussionNoteId;
      }
    } catch (err) {
      console.warn(`[Cascade Delete] Failed to fetch project metadata for discussion check:`, err);
    }

    // B. Purge discussion note (comments, reactions, voice, etc.) recursively
    if (discussionNoteId) {
      console.log(`[Cascade Delete] Purging linked project discussion ghost note: ${discussionNoteId}`);
      try {
        await executeCascadeDeleteSecure(NOTE_DB, NOTE_TABLE, discussionNoteId);
        await tables.deleteRow({
          databaseId: NOTE_DB,
          tableId: NOTE_TABLE,
          rowId: discussionNoteId,
        });
      } catch (err: any) {
        console.warn(`[Cascade Delete] Failed to delete project discussion note ${discussionNoteId}:`, err?.message);
      }
    }

    try {
      const objectsRes = await tables.listRows({
        databaseId,
        tableId: 'project_objects',
        queries: [Query.equal('projectId', rowId), Query.limit(1000)] as any,
      });

      const linkedObjects = (objectsRes.rows as any[]) || [];

      if (projectDeleteMode === 'created_within' || projectDeleteMode === 'all') {
        await Promise.all(
          linkedObjects.map(async (obj) => {
            const info = getResourceDbAndTable(obj.entityKind);
            if (!info) return;

            try {
              // 1. Fetch the actual resource row
              const resourceRow = await tables.getRow<any>(info.databaseId, info.tableId, obj.entityId);
              
              // 2. Check if we should delete it
              const isCreatedWithin = resourceRow && resourceRow.source === 'project';
              const shouldDelete = projectDeleteMode === 'all' || isCreatedWithin;

              if (shouldDelete) {
                console.log(`[Cascade Delete] Project cascade deleting linked resource: ${obj.entityId} of kind ${obj.entityKind}`);
                
                // Recurse cascade delete child elements of this resource first
                await executeCascadeDeleteSecure(info.databaseId, info.tableId, obj.entityId);

                // Delete the resource row itself
                await tables.deleteRow({
                  databaseId: info.databaseId,
                  tableId: info.tableId,
                  rowId: obj.entityId,
                });
              }
            } catch (err: any) {
              console.warn(`[Cascade Delete] Failed to fetch or delete linked resource ${obj.entityId} (${obj.entityKind}):`, err?.message);
            }
          })
        );
      }

      // In all cases, we delete the project object links (detaching them if they weren't deleted)
      await Promise.all(
        linkedObjects.map((obj) =>
          tables.deleteRow({
            databaseId,
            tableId: 'project_objects',
            rowId: obj.$id,
          })
        )
      );
    } catch (err) {
      console.error('[Cascade Delete] Project objects cleanup failed:', err);
    }

    // Wipe collaborators and key mappings for the project itself
    await wipeCollaboratorsAndKeys(tables, rowId, 'project');
  }

  // --- 3. CASCADE FOR FORMS ---
  else if (databaseId === FLOW_DB && tableId === FORMS_TABLE) {
    console.log(`[Cascade Delete] Triggered form cascade cleanup for: ${rowId}`);

    try {
      const submissionsRes = await tables.listRows({
        databaseId,
        tableId: 'formSubmissions',
        queries: [Query.equal('formId', rowId), Query.limit(1000)] as any,
      });

      await Promise.all(
        submissionsRes.rows.map((sub: any) =>
          tables.deleteRow({
            databaseId,
            tableId: 'formSubmissions',
            rowId: sub.$id,
          })
        )
      );
    } catch (err) {
      console.error('[Cascade Delete] Form submissions cleanup failed:', err);
    }

    // Wipe collaborators and key mappings for the form itself
    await wipeCollaboratorsAndKeys(tables, rowId, 'form');
  }

  // --- 4. CASCADE FOR EVENTS ---
  else if (databaseId === FLOW_DB && tableId === EVENTS_TABLE) {
    console.log(`[Cascade Delete] Triggered event cascade cleanup for: ${rowId}`);

    let meetingUrl = '';
    try {
      const eventDoc = await tables.getRow({
        databaseId: FLOW_DB,
        tableId: EVENTS_TABLE,
        rowId: rowId,
      });
      meetingUrl = eventDoc?.meetingUrl || '';
    } catch (err) {
      console.warn(`[Cascade Delete] Failed to fetch event row ${rowId} for meetingUrl:`, err);
    }

    // A. Clean up linked Call Link
    if (meetingUrl && meetingUrl.includes('/connect/call/')) {
      const parts = meetingUrl.split('/connect/call/');
      const callId = parts[parts.length - 1];
      if (callId) {
        console.log(`[Cascade Delete] Cleaning up linked call link: ${callId}`);
        try {
          await executeCascadeDeleteSecure(CHAT_DB, CALL_LINKS_TABLE, callId);
          await tables.deleteRow({
            databaseId: CHAT_DB,
            tableId: CALL_LINKS_TABLE,
            rowId: callId,
          });
        } catch (err: any) {
          console.warn(`[Cascade Delete] Failed to delete linked call ${callId}:`, err?.message);
        }
      }
    }

    // B. Clean up linked Ghost Note (Discussion Thread)
    try {
      console.log(`[Cascade Delete] Cleaning up linked event ghost huddle: ${rowId}`);
      await executeCascadeDeleteSecure(NOTE_DB, NOTE_TABLE, rowId);
      await tables.deleteRow({
        databaseId: NOTE_DB,
        tableId: NOTE_TABLE,
        rowId: rowId,
      });
    } catch (err: any) {
      // It's normal for many events to not have initialized discussions
    }

    // C. Clean up Guests/Participants
    try {
      const guestsRes = await tables.listRows({
        databaseId,
        tableId: GUESTS_TABLE,
        queries: [Query.equal('eventId', rowId), Query.limit(1000)] as any,
      });

      await Promise.all(
        guestsRes.rows.map((guest: any) =>
          tables.deleteRow({
            databaseId,
            tableId: GUESTS_TABLE,
            rowId: guest.$id,
          })
        )
      );
    } catch (err) {
      console.error('[Cascade Delete] Event guests cleanup failed:', err);
    }

    // D. Wipe collaborators and key mappings for the event itself
    await wipeCollaboratorsAndKeys(tables, rowId, 'event');
  }

  // --- 5. CASCADE FOR CALLS (HUDDLES) ---
  else if (databaseId === CHAT_DB && tableId === CALL_LINKS_TABLE) {
    console.log(`[Cascade Delete] Triggered call cascade cleanup for: ${rowId}`);

    try {
      // Find all ghost notes associated with this call
      const ghostNotesRes = await tables.listRows({
        databaseId: NOTE_DB,
        tableId: NOTE_TABLE,
        queries: [Query.contains('metadata', rowId), Query.limit(100)] as any,
      });

      for (const ghost of ghostNotesRes.rows as any[]) {
        // Recursive deletion for the note's own child items
        await executeCascadeDeleteSecure(NOTE_DB, NOTE_TABLE, ghost.$id);

        // Delete the ghost note itself
        await tables.deleteRow({
          databaseId: NOTE_DB,
          tableId: NOTE_TABLE,
          rowId: ghost.$id,
        });
      }
    } catch (err) {
      console.error('[Cascade Delete] Call ghost notes cleanup failed:', err);
    }

    // Wipe collaborators and key mappings for the huddle/call itself
    await wipeCollaboratorsAndKeys(tables, rowId, 'call');
  }

  // --- 6. CASCADE FOR TASKS ---
  else if (databaseId === FLOW_DB && tableId === APPWRITE_CONFIG.TABLES.FLOW.TASKS) {
    console.log(`[Cascade Delete] Triggered task cascade cleanup for: ${rowId}`);

    // Wipe collaborators and key mappings for the task/goal itself
    await wipeCollaboratorsAndKeys(tables, rowId, 'task');
  }

  // --- 7. CASCADE FOR CREDENTIALS/SECRETS ---
  else if (databaseId === APPWRITE_CONFIG.DATABASES.VAULT && tableId === APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS) {
    console.log(`[Cascade Delete] Triggered credential cascade cleanup for: ${rowId}`);

    try {
      const credential = await tables.getRow<any>(databaseId, tableId, rowId);
      if (credential && credential.attachments) {
        let attachmentsList: any[] = [];
        try {
          attachmentsList = typeof credential.attachments === 'string' ? JSON.parse(credential.attachments) : credential.attachments || [];
        } catch {}
        if (Array.isArray(attachmentsList)) {
          await Promise.all(
            attachmentsList.map((file: any) =>
              storage.deleteFile('vault_attachments', file.id || file.fileId).catch((err) => {
                console.warn(`[Cascade Delete] Failed to delete credential attachment file ${file.id}:`, err?.message);
              })
            )
          );
        }
      }
    } catch (err) {
      console.error('[Cascade Delete] Credential attachments cleanup failed:', err);
    }

    // Wipe collaborators and key mappings for the credential itself
    await wipeCollaboratorsAndKeys(tables, rowId, 'credential');
  }
}
