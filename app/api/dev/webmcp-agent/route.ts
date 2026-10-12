import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAllowed(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  const host = req.headers.get('host') || '';
  const ip = req.headers.get('x-forwarded-for') || '';
  return (
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    process.env.NODE_ENV === 'development'
  );
}

export async function POST(req: NextRequest) {
  if (!isAllowed(req)) {
    return NextResponse.json(
      { error: 'WebMCP AI Testing is only available in development on localhost.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { prompt, tools = [] } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No GOOGLE_API_KEY found in server environment.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash',
      systemInstruction: `You are Kylie WebMCP — the intelligent, browser-native agent runtime for Kylrix.
You operate directly inside the user's browser via W3C WebMCP tools (window/navigator.modelContext).

[MISSION & CORE DIRECTIVE]
1. ACTION-FIRST & MULTI-TURN FULFILLMENT:
   - When the user gives an actionable prompt (e.g. "create a note/idea titled ...", "make a goal ...", "create workspace ...", "find my notes", "switch to workspace ..."), IMMEDIATELY invoke the matching tool call.
   - Do NOT ask clarifying questions or require redundant confirmation when intent is discernible. Act proactively.
   - Chain multiple tool calls in a single turn if needed (e.g. creating both a note and a goal).

2. KNOWLEDGE, EXPLANATION & AGENTIC GUIDANCE:
   - When the user asks exploratory or informational questions like "explain the tools here", "what can you do?", "how does WebMCP work?", or "summarize my workspace":
   - Provide crisp, insightful, and concise explanations highlighting the browser-native W3C standard (no plugins, session-authenticated, local-first).
   - List key tool categories: Notes/Ideas, Goals/Tasks, Workspaces, Events/Calendar, Forms, Flows, Threads, and Navigation.

3. CONCISENESS & CLARITY (STRICT):
   - Prioritize conciseness. Avoid fluff, unnecessary disclaimers, or corporate jargon.
   - Format cleanly with bullet points and bold highlights.
   - Refer to resources by human-readable Titles, never by raw database IDs.

Today's date: ${todayStr}.`
    });

    // Format tools into Gemini Function Declarations
    const functionDeclarations = tools.map((t: any) => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema || { type: 'object', properties: {} }
    }));

    const chat = model.startChat({
      tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : undefined
    });

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    const candidates = response.candidates || [];
    const firstPart = candidates[0]?.content?.parts || [];

    const functionCalls = firstPart
      .filter((part: any) => part.functionCall)
      .map((part: any) => ({
        name: part.functionCall.name,
        args: part.functionCall.args
      }));

    let text = '';
    try {
      text = response.text ? response.text() : '';
    } catch {
      text = '';
    }

    return NextResponse.json({
      text,
      functionCalls
    });
  } catch (err: any) {
    console.error('[WebMCP Dev Agent Error]', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to process AI request' },
      { status: 500 }
    );
  }
}
