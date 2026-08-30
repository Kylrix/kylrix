import { MCP_TOOLS } from './tool-catalog';
import { mcpToolHandlers } from './dispatch';

/** Ensures every catalogued MCP tool has a handler (and vice versa). */
export function validateMcpToolRegistry(): { ok: true } | { ok: false; missingHandlers: string[]; orphanHandlers: string[] } {
  const toolNames = new Set(MCP_TOOLS.map((t) => t.name));
  const handlerNames = new Set(Object.keys(mcpToolHandlers));

  const missingHandlers = [...toolNames].filter((n) => !handlerNames.has(n));
  const orphanHandlers = [...handlerNames].filter((n) => !toolNames.has(n));

  if (missingHandlers.length || orphanHandlers.length) {
    return { ok: false, missingHandlers, orphanHandlers };
  }
  return { ok: true };
}
