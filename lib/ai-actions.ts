import { Notes } from '@/types/appwrite';
import { generateAIContent } from '@/lib/actions/ai';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { createTaskFromNote } from '@/lib/appwrite';

export async function generateAIAction(note: Notes, action: 'summarize' | 'grammar' | 'expand') {
  const systemInstructions = {
    summarize: "Summarize the following note concisely while preserving key details. Use bullet points if helpful.",
    grammar: "Improve the grammar and clarity of the following note while keeping the original intent and tone.",
    expand: "Expand on the ideas in this note, providing more detail and structure."
  };

  const prompt = `Note Title: ${note.title}\nNote Content:\n${note.content}`;

  const result = await generateAIContent({
    mode: 'GENERIC_CHAT',
    prompt,
    systemInstruction: systemInstructions[action]
  });

  if (!result.success) {
    throw new Error(result.error || 'AI Action failed');
  }

  return result.data;
}

/**
 * Gathers surrounding context ("reads the room") by fetching recent note titles and snippets
 * from local cache or RxDB so the AI can understand the broader workspace context.
 */
export async function readTheRoom(currentNoteId?: string): Promise<string[]> {
  try {
    if (typeof window === 'undefined') return [];

    // 1. Attempt to fetch from LocalEngine note lists or RxDB
    const { getCurrentUser } = await import('@/lib/appwrite/client');
    const user = await getCurrentUser().catch(() => null);
    const uid = user?.$id || 'guest';

    const cachedList =
      (await LocalEngine.cacheGet<any[]>(`f_notes_list_${uid}`).catch(() => null)) ||
      (await LocalEngine.cacheGet<any[]>(`f_ideas_${uid}`).catch(() => null));

    let candidateRows: any[] = (Array.isArray(cachedList) ? cachedList : (cachedList as any)?.rows) || [];

    if (!candidateRows.length) {
      const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
      const db = await getRxDB().catch(() => null);
      if (db?.notes) {
        const docs = await db.notes.find({ selector: { _deleted: { $ne: true } } }).exec().catch(() => []);
        candidateRows = docs.map((d: any) => (d.toJSON ? d.toJSON() : d));
      }
    }

    const titles = candidateRows
      .filter((n: any) => (n.$id || n.id) !== currentNoteId)
      .map((n: any) => String(n.title || '').trim())
      .filter(Boolean)
      .slice(0, 10);

    return titles;
  } catch (err) {
    console.warn('[readTheRoom] Failed to gather room context:', err);
    return [];
  }
}

export interface ConvertOptions {
  activeWorkspaceId?: string | null;
  projectId?: string | null;
  isWorkspace?: boolean;
}

/**
 * Converts a note into one or multiple agentic Goals in Flow.
 * Respects workspace context (attaching activeWorkspaceId/projectId/isWorkspace) and allows creating multiple items.
 */
export async function convertNoteToGoalAgentic(note: Notes, options?: ConvertOptions) {
  const roomTitles = await readTheRoom(note.$id);

  const systemInstruction = `You are Kylrix AI, an agentic goal architect.
Your task is to analyze an Idea/Note in the context of the user's workspace ideas and synthesize actionable Goals for Kylrix Flow. You may produce ONE OR MULTIPLE high-leverage goals if the idea encompasses multiple distinct outcomes.

Return ONLY a JSON array of goal objects (no markdown blocks, raw JSON) in the format:
[
  {
    "title": "Action-Oriented Goal Title",
    "description": "Comprehensive description detailing targets and steps.",
    "priority": "low | medium | high"
  }
]`;

  const prompt = `TARGET NOTE TO CONVERT:
Title: ${note.title || 'Untitled Idea'}
Content: ${note.content || 'No content'}

SURROUNDING ROOM CONTEXT:
${roomTitles.length > 0 ? roomTitles.map((t) => `- ${t}`).join('\n') : 'No other recent ideas.'}`;

  try {
    const aiRes = await generateAIContent({
      mode: 'GENERIC_CHAT',
      prompt,
      systemInstruction,
    });

    if (aiRes.success && aiRes.data) {
      let jsonText = aiRes.data.replace(/```json/g, '').replace(/```/g, '').trim();
      let parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        parsed = [parsed];
      }

      const createdTasks = [];
      const projectId = options?.projectId || (note as any).projectId || options?.activeWorkspaceId || undefined;
      const isWorkspace = Boolean(options?.isWorkspace || (note as any).isWorkspace || projectId);

      for (const item of parsed) {
        if (item?.title) {
          const { $id, ...cleanNote } = note as any;
          const goalData: any = {
            ...cleanNote,
            title: item.title,
            content: `${item.description || note.content || ''}\n\n--- Agentic Origin: Idea (${note.$id || ''}) | Priority: ${item.priority || 'medium'} ---`,
            ...(projectId ? { projectId } : {}),
            ...(isWorkspace ? { isWorkspace: true } : {}),
          };
          const created = await createTaskFromNote(goalData);
          createdTasks.push(created);
        }
      }

      if (createdTasks.length > 0) {
        return createdTasks.length === 1 ? createdTasks[0] : createdTasks;
      }
    }
  } catch (err) {
    console.warn('[convertNoteToGoalAgentic] AI goal synthesis failed or not available, falling back to standard conversion:', err);
  }

  // Fallback with workspace context preserved
  const fallbackNote = {
    ...note,
    ...(options?.projectId ? { projectId: options.projectId } : {}),
    ...(options?.isWorkspace ? { isWorkspace: true } : {}),
  };
  return await createTaskFromNote(fallbackNote as Notes);
}

/**
 * Converts a goal or event into ideas/notes, preserving workspace context and supporting multiple creation.
 */
export async function convertObjectToIdeasAgentic(
  sourceObject: { id: string; title: string; content?: string; description?: string; type: 'goal' | 'event' },
  options?: ConvertOptions
) {
  const { unifiedCreate } = await import('@/lib/services/unified-object-service');
  const projectId = options?.projectId || options?.activeWorkspaceId || undefined;
  const isWorkspace = Boolean(options?.isWorkspace || projectId);

  const systemInstruction = `You are Kylrix AI, an agentic synthesis architect.
Analyze the provided ${sourceObject.type} and extract core ideas, research points, and key takeaways into structured Ideas/Notes. You can generate multiple distinct ideas if relevant.

Return ONLY a JSON array of idea objects:
[
  {
    "title": "Idea Title",
    "content": "Detailed conceptual breakdown and insights.",
    "tags": ["from:${sourceObject.type}"]
  }
]`;

  const prompt = `SOURCE OBJECT (${sourceObject.type.toUpperCase()}):
Title: ${sourceObject.title}
Content/Description: ${sourceObject.content || sourceObject.description || 'No description provided.'}`;

  try {
    const aiRes = await generateAIContent({
      mode: 'GENERIC_CHAT',
      prompt,
      systemInstruction,
    });

    if (aiRes.success && aiRes.data) {
      let jsonText = aiRes.data.replace(/```json/g, '').replace(/```/g, '').trim();
      let parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) parsed = [parsed];

      const createdIdeas = [];
      for (const item of parsed) {
        if (item?.title) {
          const payload: any = {
            title: item.title,
            content: `${item.content || ''}\n\n--- Converted from ${sourceObject.type}: ${sourceObject.title} ---`,
            tags: Array.isArray(item.tags) ? item.tags : [`from:${sourceObject.type}`],
            ...(projectId ? { projectId } : {}),
            ...(isWorkspace ? { isWorkspace: true } : {}),
          };
          const created = await unifiedCreate('note', payload);
          createdIdeas.push(created);
        }
      }
      if (createdIdeas.length > 0) return createdIdeas;
    }
  } catch (err) {
    console.warn('[convertObjectToIdeasAgentic] AI synthesis failed, fallback to direct creation:', err);
  }

  // Fallback single idea
  const fallback = await unifiedCreate('note', {
    title: `Idea from ${sourceObject.type}: ${sourceObject.title}`,
    content: sourceObject.content || sourceObject.description || '',
    tags: [`from:${sourceObject.type}`],
    ...(projectId ? { projectId } : {}),
    ...(isWorkspace ? { isWorkspace: true } : {}),
  });
  return [fallback];
}
