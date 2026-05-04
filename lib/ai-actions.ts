import { Notes } from "@/types/appwrite";

export async function generateAIAction(note: Notes, action: 'summarize' | 'grammar' | 'expand') {
  const systemInstructions = {
    summarize: "Summarize the following note concisely while preserving key details. Use bullet points if helpful.",
    grammar: "Improve the grammar and clarity of the following note while keeping the original intent and tone.",
    expand: "Expand on the ideas in this note, providing more detail and structure."
  };

  const prompt = `Note Title: ${note.title}\nNote Content:\n${note.content}`;

  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      systemInstruction: systemInstructions[action]
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'AI Action failed');
  }

  const data = await response.json();
  return data.text;
}
