---
name: why.scrapped-byok-ai
description: Document the architectural decision to scrap the Bring Your Own Key (BYOK) AI model in Kylrix, explaining the conflicts with E2EE boundaries, decryption key UX, and background unmanned agent automation.
---

# Why: Scrapping the Bring Your Own Key (BYOK) AI Model

During the early stages of Kylrix development, we laid down foundations to support **Bring Your Own Key (BYOK) AI models**, allowing users to supply their own Google Gemini or OpenAI API keys. We have explicitly scrapped this design choice in favor of a unified ecosystem API key. 

This document details the critical security, user experience (UX), and agentic execution reasons behind this pivot.

---

## 1. The E2EE Architectural Boundary Conflict

Kylrix is designed with strict boundaries separating low-risk workspaces from high-risk client-side End-to-End Encrypted (E2EE) vaults. Storing external API keys in the database introduces severe architectural friction:

* **Zero-Knowledge Compromise**: If we stored API keys in the database unencrypted, they would be vulnerable to server-side scraping or database exposure.
* **E2EE Decryption UX**: If we encrypted the API keys client-side (using AES-GCM via the user's MasterPass), the user would be forced to supply their master password *every single time* they triggered an AI prompt, generated a note summary, or initiated an agentic command. This friction completely destroys real-time user momentum.

---

## 2. The Unmanned Agent Execution Nightmare

The most fatal flaw of BYOK in an agentic suite is its complete incompatibility with **unmanned background agents**:

```
[User is Offline] ---> [Cron/Event Triggers Workflow] 
                          |
                          v
               [Unmanned Background Agent]
                          |
                          v (Needs API Key to run LLM reasoning)
               [Attempting to Decrypt BYOK Key] 
                          |
                          +---> ERROR: MasterPass/Decryption Key is locked!
```

* **Zero-User Interactivity**: Unmanned background agents must perform asynchronous operations (such as compiling daily rollups, running automated database maintenance, or syncing integrations) in the user's absolute absence.
* **The Trust Paradox**: In a secure E2EE system, the server does not store the user's master decryption key in memory or disk. Consequently, when the user is offline, background agents have **no physical way** to decrypt the user's BYOK API key, rendering unmanned automated operations mathematically impossible.

---

## 3. The Unified Ecosystem Solution

To solve this paradox while maintaining strict security, Kylrix utilizes a unified, server-side capped **Ecosystem API Key** coupled with the strict actor auditing system:

```typescript
// Unified Agentic AI Generation (App-level Gateway)
export async function generateAgentAction(prompt: string, userJwt: string) {
  const actor = await verifyActor(userJwt); // Strict identity verification
  
  // Escalated access using the global server-side credential
  const apiKey = process.env.GOOGLE_API_KEY; 
  if (!apiKey) {
    throw new Error("System AI Gateway is temporarily unconfigured.");
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  return await model.generateContent(prompt);
}
```

By routing all LLM calls through a verified server-side gateway:
1. **Zero Client Friction**: Users never have to configure, decrypt, or copy-paste external API keys.
2. **Continuous Automation**: Unmanned background agents can execute event-driven workflows at any time, utilizing the server's securely stored environment keys.
3. **Strict Audit Logs**: Every invocation is strictly tied to the verified user's Actor ID (`userId`), keeping ledger activities transparent and fully auditable without credential leakage.
