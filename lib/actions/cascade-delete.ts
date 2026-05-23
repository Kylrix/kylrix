'use server';

import { Query } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createSystemTablesDB } from '@/lib/appwrite-admin';

/**
 * Centrally and recursively deletes all connected, linked, or owned child resources
 * when a parent document is deleted, minimizing database roundtrips by using pagination
 * and parallel execution.
 */
export async function executeCascadeDeleteSecure(
  databaseId: string,
  tableId: string,
  rowId: string
): Promise<void> {
  const tables = createSystemTablesDB();
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

  // --- 1. CASCADE FOR NOTES ---
  if (databaseId === NOTE_DB && tableId === NOTE_TABLE) {
    console.log(`[Cascade Delete] Triggered note cascade cleanup for: ${rowId}`);

    // A. Delete Comments & Comment Reactions
    try {
      const commentsRes = await tables.listRows({
        databaseId,
        tableId: COMMENTS_TABLE,
        queries: [Query.equal('noteId', rowId), Query.limit(1000)] as any,
      });

      const commentIds = (commentsRes.rows as any[]).map((c) => c.$id).filter(Boolean);
      if (commentIds.length > 0) {
        // Delete all reactions attached to these comments
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
        queries: [Query.equal('noteId', rowId), Query.limit(1000)] as any,
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
  }

  // --- 2. CASCADE FOR PROJECTS ---
  else if (databaseId === CHAT_DB && tableId === 'projects') {
    console.log(`[Cascade Delete] Triggered project cascade cleanup for: ${rowId}`);

    try {
      const objectsRes = await tables.listRows({
        databaseId,
        tableId: 'project_objects',
        queries: [Query.equal('projectId', rowId), Query.limit(1000)] as any,
      });

      await Promise.all(
        objectsRes.rows.map((obj: any) =>
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
  }

  // --- 4. CASCADE FOR EVENTS ---
  else if (databaseId === FLOW_DB && tableId === EVENTS_TABLE) {
    console.log(`[Cascade Delete] Triggered event cascade cleanup for: ${rowId}`);

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

    try {
      const POLYMORPHIC_COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
      const polyCollabsRes = await tables.listRows({
        databaseId: FLOW_DB,
        tableId: POLYMORPHIC_COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceId', rowId),
          Query.equal('resourceType', 'event'),
          Query.limit(1000),
        ] as any,
      });
      await Promise.all(
        polyCollabsRes.rows.map((collab: any) =>
          tables.deleteRow({
            databaseId: FLOW_DB,
            tableId: POLYMORPHIC_COLLABORATORS_TABLE,
            rowId: collab.$id,
          })
        )
      );
    } catch (err) {
      console.error('[Cascade Delete] Polymorphic event collaborators cleanup failed:', err);
    }
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

    try {
      const POLYMORPHIC_COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
      const polyCollabsRes = await tables.listRows({
        databaseId: FLOW_DB,
        tableId: POLYMORPHIC_COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceId', rowId),
          Query.equal('resourceType', 'call'),
          Query.limit(1000),
        ] as any,
      });
      await Promise.all(
        polyCollabsRes.rows.map((collab: any) =>
          tables.deleteRow({
            databaseId: FLOW_DB,
            tableId: POLYMORPHIC_COLLABORATORS_TABLE,
            rowId: collab.$id,
          })
        )
      );
    } catch (err) {
      console.error('[Cascade Delete] Polymorphic call cohosts cleanup failed:', err);
    }
  }

  // --- 6. CASCADE FOR TASKS ---
  else if (databaseId === FLOW_DB && tableId === APPWRITE_CONFIG.TABLES.FLOW.TASKS) {
    console.log(`[Cascade Delete] Triggered task cascade cleanup for: ${rowId}`);

    try {
      const POLYMORPHIC_COLLABORATORS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.COLLABORATORS || 'Collaborators';
      const polyCollabsRes = await tables.listRows({
        databaseId: FLOW_DB,
        tableId: POLYMORPHIC_COLLABORATORS_TABLE,
        queries: [
          Query.equal('resourceId', rowId),
          Query.equal('resourceType', 'task'),
          Query.limit(1000),
        ] as any,
      });
      await Promise.all(
        polyCollabsRes.rows.map((collab: any) =>
          tables.deleteRow({
            databaseId: FLOW_DB,
            tableId: POLYMORPHIC_COLLABORATORS_TABLE,
            rowId: collab.$id,
          })
        )
      );
    } catch (err) {
      console.error('[Cascade Delete] Polymorphic task assignees cleanup failed:', err);
    }
  }
}
