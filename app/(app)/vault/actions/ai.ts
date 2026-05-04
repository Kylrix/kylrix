"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIRequestPayload, AIResponse } from "@/lib/ai/types";

// Initialize Gemini
// Note: GOOGLE_API_KEY must be set in environment variables
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const MODEL_NAME = process.env.GEMINI_MODEL_NAME || "gemini-2.0-flash";

export async function generateAIContent(payload: AIRequestPayload): Promise<AIResponse> {
  if (!process.env.GOOGLE_API_KEY) {
    return { success: false, error: "AI Service not configured (Missing API Key)" };
  }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    let prompt = "";

    // Prompt Engineering Layer
    switch (payload.mode) {
      case 'VAULT_ORGANIZE':
        prompt = `
          You are a Data Organizer. I will provide a list of website names and URLs.
          Group them into logical folders (e.g., 'Finance', 'Social', 'Streaming', 'Dev', 'Shopping', 'Work').
          Return ONLY a JSON object where keys are Folder Names and values are arrays of IDs.
          Do not include markdown formatting like \`\`\`json. Just the raw JSON string.
          Input: ${JSON.stringify(payload.data)}
        `;
        break;

      case 'PASSWORD_AUDIT':
        const passwordData = payload.data as { password?: string };
        prompt = `
          Analyze the entropy and strength of this password string. 
          Return a JSON with: 
          - score (1-10)
          - timeToCrack (estimated)
          - feedback (specific suggestions to improve)
          Do not repeat the password in the response.
          Input: "${passwordData?.password || ""}"
        `;
        break;

      case 'URL_SAFETY':
        const urlData = payload.data as { url?: string };
        prompt = `
          Analyze this URL for potential phishing or security risks.
          URL: "${urlData?.url || ""}"
          Return a JSON with:
          - safe (boolean)
          - riskLevel (Low, Medium, High)
          - reason (short explanation)
        `;
        break;
        
      case 'GENERAL_QUERY':
        prompt = payload.prompt || "";
        break;

      case 'COMMAND_INTENT':
        prompt = `
          You are an AI Commander for a Password Manager.
          Interpret the user's intent and return a JSON object with a specific "action".
          
          Supported Actions:
          1. "CREATE_CREDENTIAL": User wants to add a new login. 
             Extract "name" (e.g. Netflix) and "url" (e.g. https://netflix.com) if possible.
             Return JSON: { "action": "CREATE_CREDENTIAL", "data": { "name": "...", "url": "..." } }
             
          2. "GENERATE_PASSWORD": User wants a password.
             Return JSON: { "action": "GENERATE_PASSWORD", "data": {} }

          3. "NAVIGATE": User wants to go to a page.
             Target pages: "dashboard", "settings", "import", "totp", "sharing".
             Return JSON: { "action": "NAVIGATE", "data": { "target": "..." } }
             
          4. "UNKNOWN": If the request is unclear or unrelated to app actions.
             Return JSON: { "action": "UNKNOWN", "response": "..." } (Put a friendly helpful message in response)

          Rules:
          - RETURN ONLY RAW JSON. NO MARKDOWN.
          - Never ask for secrets.
          - If the user provides a password in the prompt, IGNORE IT.
          
          User Prompt: "${payload.prompt || ""}"
        `;
        break;

      default:
        return { success: false, error: "Invalid mode" };
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Cleanup markdown if Gemini adds it despite instructions
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    return { success: true, data: text };
  } catch (error: unknown) {
    console.error("AI Generation Error:", error);
    return { success: false, error: "Failed to generate AI response" };
  }
}

