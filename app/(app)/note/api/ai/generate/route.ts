import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { resolveCurrentUser } from "@/lib/appwrite";

export async function POST(req: Request) {
  try {
    // Audit user session
    const user = await resolveCurrentUser(req as any);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, history, systemInstruction } = await req.json();
    
    // 1. Key Source Determination & Pro Check
    const userKey = req.headers.get("x-user-gemini-key");
    const apiKey = userKey || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
    }

    // Pro Check: If using system key, user must be PRO/ORG/LIFETIME
    if (!userKey) {
      const plan = user.prefs?.subscriptionTier || 'FREE';
      const isPro = ['PRO', 'ORG', 'LIFETIME'].includes(plan);
      if (!isPro) {
        return NextResponse.json({ 
          error: "AI features require a Pro account. Upgrade to continue or provide your own API key in settings." 
        }, { status: 403 });
      }
    }

    // 2. Initialize Model
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL_NAME || "gemini-2.0-flash";
    
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: systemInstruction || "You are Kylrixbot, an intelligent assistant for Kylrix Note, a premium, secure note-taking app. You represent 'Quiet Power' and 'The Glass Monolith' aesthetic. Be concise, professional, and helpful."
    });

    // 3. Handle Chat vs Single Prompt
    if (history && history.length > 0) {
      const chat = model.startChat({ 
        history: history.map((h: any) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content || h.text }]
        }))
      });
      const result = await chat.sendMessage(prompt);
      return NextResponse.json({ text: result.response.text() });
    } else {
      const result = await model.generateContent(prompt);
      return NextResponse.json({ text: result.response.text() });
    }
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
