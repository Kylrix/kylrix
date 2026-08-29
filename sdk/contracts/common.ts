/** Shared MCP output fragments reused across resource tools. */
export const MCP_SUCCESS_OUTPUT = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
  },
} as const;
