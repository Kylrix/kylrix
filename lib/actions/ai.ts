"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIRequestPayload, AIResponse } from "@/lib/ai/types";
import { getActor } from "@/lib/actions/secure-ops";
import { hasPaidKylrixPlan } from "@/lib/utils";
import { createSystemTablesDB } from "@/lib/appwrite-admin";
import { Query, ID } from "node-appwrite";

const MODEL_NAME = process.env.GEMINI_MODEL_NAME || "gemini-2.0-flash";

export async function generateAIContent(payload: AIRequestPayload): Promise<AIResponse> {
  const activeKey = payload.byokKey || process.env.GOOGLE_API_KEY;
  if (!activeKey) {
    return { success: false, error: "AI Service not configured. Please supply your own private API Key in Settings." };
  }

  let actor: any = null;
  const isBYOK = Boolean(payload.byokKey);
  let tables: any = null;
  let balanceRow: any = null;

  // Compute checking for ecosystem users (non-BYOK)
  if (!isBYOK) {
    actor = await getActor();
    if (!actor) {
      return { success: false, error: "Please log in to use ecosystem AI services." };
    }

    if (!hasPaidKylrixPlan(actor)) {
      return { success: false, error: "Ecosystem AI is only available to Pro subscribers. Upgrade or supply your own private AI key in Settings." };
    }

    try {
      tables = createSystemTablesDB();
      const res = await tables.listRows({
        databaseId: 'whisperrflow',
        tableId: 'compute_balances',
        queries: [
          Query.equal('userId', actor.$id),
          Query.limit(1)
        ]
      });

      if (res.rows.length === 0) {
        // Initialize Pro user compute profile
        balanceRow = await tables.createRow({
          databaseId: 'whisperrflow',
          tableId: 'compute_balances',
          rowId: ID.unique(),
          data: {
            userId: actor.$id,
            tier: 'pro',
            balance: 100000,
            lastResetAt: new Date().toISOString()
          }
        });
      } else {
        balanceRow = res.rows[0];
      }

      if (balanceRow.balance <= 0) {
        return { success: false, error: "You have exceeded your dynamic compute token allocation. Please configure your own private key in Settings or request a refill." };
      }
    } catch (err: any) {
      console.error('[AI Billing Check Exception]', err);
      // Fail-safe: log but do not block users if there's a transient database issue
    }
  }

  try {
    const genAI = new GoogleGenerativeAI(activeKey);
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

    // Debit tokens for ecosystem users (non-BYOK)
    if (!isBYOK && tables && balanceRow) {
      try {
        const promptLength = prompt.length || 0;
        const estimatedPromptTokens = Math.ceil(promptLength / 4) + 120;
        const estimatedCompletionTokens = Math.ceil(text.length / 4);
        const totalTokens = estimatedPromptTokens + estimatedCompletionTokens;

        const newBalance = Math.max(0, balanceRow.balance - totalTokens);
        await tables.updateRow({
          databaseId: 'whisperrflow',
          tableId: 'compute_balances',
          rowId: balanceRow.$id,
          data: {
            balance: newBalance
          }
        });

        await tables.createRow({
          databaseId: 'whisperrflow',
          tableId: 'compute_ledger',
          rowId: ID.unique(),
          data: {
            userId: actor.$id,
            tokensConsumed: totalTokens,
            timestamp: new Date().toISOString()
          }
        });
      } catch (err) {
        console.error('[AI Billing Debit Exception]', err);
      }
    }

    return { success: true, data: text };
  } catch (error: unknown) {
    console.error("AI Generation Error:", error);
    return { success: false, error: "Failed to generate AI response" };
  }
}
