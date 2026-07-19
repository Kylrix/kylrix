export type AnalysisMode = 
  | 'URL_SAFETY'       // Context: Only URL
  | 'VAULT_ORGANIZE'   // Context: Name, URL, Category (NO Secrets)
  | 'PASSWORD_AUDIT'   // Context: Password string only (Ephemeral)
  | 'GENERAL_QUERY'    // Context: User prompt
  | 'GENERIC_CHAT'     // Context: User prompt + Chat history
  | 'COMMAND_INTENT';  // Context: User prompt -> structured command

export interface AIRequestPayload {
  mode: AnalysisMode;
  data?: unknown; // Sanitized data
  prompt?: string; // Optional custom prompt
  byokKey?: string; // Optional user decrypted API key
  localContext?: any; // Compiled browser context summary
  history?: any[]; // Optional chat history
  systemInstruction?: string; // Optional system instruction override
  jwt?: string; // Optional JWT token for authentication context
}

export interface AIResponse {
  success: boolean;
  data?: string;
  error?: string;
}

export interface AIProvider {
  name: string;
  generate(payload: AIRequestPayload): Promise<AIResponse>;
}
