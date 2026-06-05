"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIRequestPayload, AIResponse } from "@/lib/ai/types";
import { getActor } from "@/lib/actions/secure-ops";
import { hasPaidKylrixPlan } from "@/lib/utils";
import { createSystemTablesDB } from "@/lib/appwrite-admin";
import { Query, ID } from "node-appwrite";
import { TelemetryService } from "@/lib/services/telemetry";

const MODEL_NAME = process.env.GEMINI_MODEL_NAME || "gemini-2.0-flash";

function sanitizeCdrPayloadForAI(data: any): any {
  if (typeof data === 'string') {
    if (data.includes('"type":"cdr"') || data.includes("'type':'cdr'") || data.includes('"type": "cdr"')) {
      return '[Secure CDR Asset: Locked Vault Payload]';
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeCdrPayloadForAI(item));
  }
  if (data !== null && typeof data === 'object') {
    const res: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      res[key] = sanitizeCdrPayloadForAI(data[key]);
    }
    return res;
  }
  return data;
}

export async function generateAIContent(payload: AIRequestPayload): Promise<AIResponse> {
  // Input Validation & Sanitization
  if (!payload || typeof payload !== 'object') {
    return { success: false, error: "Invalid request payload." };
  }

  if (payload.data) {
    payload.data = sanitizeCdrPayloadForAI(payload.data);
  }
  if (payload.prompt) {
    payload.prompt = sanitizeCdrPayloadForAI(payload.prompt);
  }
  if (payload.history) {
    payload.history = sanitizeCdrPayloadForAI(payload.history);
  }
  
  const VALID_MODES = ['VAULT_ORGANIZE', 'PASSWORD_AUDIT', 'URL_SAFETY', 'GENERAL_QUERY', 'GENERIC_CHAT', 'COMMAND_INTENT'];
  if (!VALID_MODES.includes(payload.mode)) {
    return { success: false, error: "Invalid analysis mode." };
  }

  const activeKey = (typeof payload.byokKey === 'string' ? payload.byokKey.trim() : null) || process.env.GOOGLE_API_KEY;
  if (!activeKey) {
    return { success: false, error: "AI Service not configured. Please supply your own private API Key in Settings." };
  }

  let actor: any = null;
  const isBYOK = Boolean(payload.byokKey);
  let tables: any = null;
  let balanceRow: any = null;

  // Resolve actor for logging and gating checks
  try {
    actor = await getActor();
  } catch (e) {
    console.error('[AI getActor Exception]', e);
  }

  // Compute checking for ecosystem users (non-BYOK)
  if (!isBYOK) {
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
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      systemInstruction: payload.systemInstruction || undefined
    });
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

      case 'GENERIC_CHAT':
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

    let finalPrompt = prompt;
    if (payload.localContext) {
      const lc = payload.localContext;
      const activeNichesStr = Array.isArray(lc.activeNiches) ? lc.activeNiches.join(', ') : 'none';
      const recentAppsStr = Array.isArray(lc.recentApps) ? lc.recentApps.join(', ') : 'none';
      const flowTransitionsStr = Array.isArray(lc.flowTransitions) ? lc.flowTransitions.join(' -> ') : 'none';
      const lastSearchStr = lc.lastSearchQuery ? `"${lc.lastSearchQuery}"` : 'none';
      const workflowTraceStr = Array.isArray(lc.activeWorkflowSteps) && lc.activeWorkflowSteps.length > 0
        ? lc.activeWorkflowSteps.join('\n  -> ')
        : 'none';

      finalPrompt = `${prompt}

[OFFLINE SYSTEM ENVIRONMENT CONTEXT]
The following anonymized offline environment state has been compiled from the user's active session:
- Active Functional Areas: ${activeNichesStr}
- Recent App Switches: ${recentAppsStr}
- Session Trajectory: ${flowTransitionsStr}
- Last Search Attempt: ${lastSearchStr}
- Recorded Workflow Chain: 
  -> ${workflowTraceStr}

Please utilize this contextual memory to optimize your recommendations if relevant. If a recorded workflow chain is active, interpret the sequence of user action IDs to construct dynamic shortcut suggestions, automated procedures, or guidance tutorials to reproduce these exact steps in Kylrix while maintaining the layman-friendly posture.`;
    }

    let text = "";
    if (payload.history && payload.history.length > 0) {
      const chat = model.startChat({
        history: payload.history.map((h: any) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content || h.text }]
        }))
      });
      const result = await chat.sendMessage(finalPrompt);
      text = result.response.text();
    } else {
      const result = await model.generateContent(finalPrompt);
      const response = await result.response;
      text = response.text();
    }
    
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

    // Record Telemetry and Activity Logs
    try {
      // 1. Anonymized Telemetry
      await TelemetryService.recordTelemetry({
        niche: 'intelligence',
        app: 'gemini',
        action: 'generate_content',
        intent: payload.mode,
        metadata: {
          isBYOK,
          promptLength: prompt.length,
          responseLength: text.length
        }
      });

      // 2. Identified User Activity
      if (actor?.$id) {
        await TelemetryService.recordActivity({
          userId: actor.$id,
          niche: 'intelligence',
          app: 'gemini',
          action: 'generate_content',
          metadata: {
            mode: payload.mode,
            isBYOK
          }
        });
      }
    } catch (telemetryErr) {
      console.error('[AI Telemetry Recording Exception]', telemetryErr);
    }

    return { success: true, data: text };
  } catch (error: unknown) {
    console.error("AI Generation Error:", error);
    return { success: false, error: "Failed to generate AI response" };
  }
}

export async function getComputeBalanceAction(jwt?: string) {
  const actor = await getActor(jwt);
  if (!actor) return null;

  try {
    const systemClient = createSystemClient();
    const { users: systemUsers } = systemClient;
    
    // Fetch latest user data including prefs to ensure tier accuracy
    const fullUser = await systemUsers.get(actor.$id);
    const isPro = hasPaidKylrixPlan(fullUser);

    const tables = createSystemTablesDB();
    const res = await tables.listRows({
      databaseId: 'whisperrflow',
      tableId: 'compute_balances',
      queries: [
        Query.equal('userId', actor.$id),
        Query.limit(1)
      ]
    });

    if (res.rows.length === 0) {
      return {
        balance: isPro ? 100000 : 0,
        maxBalance: isPro ? 100000 : 0,
        tier: isPro ? 'pro' : 'free',
        percent: isPro ? 100 : 0
      };
    }

    const row = res.rows[0];
    const maxBalance = row.tier === 'pro' ? 100000 : 10000;
    const currentBalance = Number(row.balance);
    const percent = Math.min(100, Math.max(0, (currentBalance / maxBalance) * 100));

    return {
      balance: currentBalance,
      maxBalance,
      tier: row.tier,
      percent
    };
  } catch (err) {
    console.error('[getComputeBalanceAction] Failed:', err);
    return null;
  }
}
