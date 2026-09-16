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

/**
 * Converts a note into an agentic Goal.
 * Reads the room for context, prompts AI to craft a goal (title, description, priority),
 * and creates the goal task. Falls back to standard task creation if AI is disabled/unsupported.
 */
export async function convertNoteToGoalAgentic(note: Notes) {
  // Always attempt fallback first if note title/content are missing
  const roomTitles = await readTheRoom(note.$id);

  const systemInstruction = `You are Kylrix AI, an agentic goal architect.
Your task is to analyze an Idea/Note in the context of the user's recent surrounding ideas ("reading the room") and craft a high-impact, actionable Goal for Kylrix Flow.

Return ONLY a JSON object (no markdown code blocks, raw JSON) in the following format:
{
  "title": "Clear, Action-Oriented Goal Title",
  "description": "Comprehensive description detailing what needs to be achieved, derived key steps, and how it connects with surrounding context.",
  "priority": "low | medium | high"
}`;

  const prompt = `TARGET NOTE TO CONVERT:
Title: ${note.title || 'Untitled Idea'}
Content: ${note.content || 'No content'}

SURROUNDING ROOM CONTEXT (OTHER RECENT IDEAS IN WORKSPACE):
${roomTitles.length > 0 ? roomTitles.map((t) => `- ${t}`).join('\n') : 'No other recent ideas.'}`;

  try {
    const aiRes = await generateAIContent({
      mode: 'GENERIC_CHAT',
      prompt,
      systemInstruction,
    });

    if (aiRes.success && aiRes.data) {
      let jsonText = aiRes.data.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonText);

      if (parsed.title) {
        const goalData: Notes = {
          ...note,
          title: parsed.title,
          content: `${parsed.description || note.content || ''}\n\n--- Agentic Origin: Idea (${note.$id}) | Priority: ${parsed.priority || 'medium'} ---`,
        };
        return await createTaskFromNote(goalData);
      }
    }
  } catch (err) {
    console.warn('[convertNoteToGoalAgentic] AI goal synthesis failed or not available, falling back to standard note creation:', err);
  }

  // Resilient fallback to standard note conversion
  return await createTaskFromNote(note);
}
