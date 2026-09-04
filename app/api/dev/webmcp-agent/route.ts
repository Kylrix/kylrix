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
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL_NAME || 'gemini-2.0-flash',
      systemInstruction: [
        "You are an AI agent testing browser-native WebMCP tools embedded in the user's Kylrix app.",
        "You have access to tools registered on window/navigator via WebMCP.",
        "When the user makes a request that requires creating or querying app resources (notes, goals, workspaces, events, etc.), invoke the appropriate tool call.",
        `Today's date is: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`
      ].join(' ')
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
