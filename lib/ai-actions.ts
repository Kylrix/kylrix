import { Notes } from '@/types/appwrite';
import { generateAIContent } from '@/lib/actions/ai';

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
