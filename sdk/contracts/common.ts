/** Shared MCP JSON Schema fragments. */
export const MCP_SUCCESS_OUTPUT = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
  },
} as const;

export const MCP_EMPTY_INPUT = {
  type: 'object',
  properties: {},
} as const;

export const MCP_LIMIT_INPUT = {
  type: 'object',
  properties: {
    limit: { type: 'number', description: 'Maximum items to return' },
  },
} as const;

export const MCP_WORKSPACE_LIMIT_INPUT = {
  type: 'object',
  properties: {
    workspaceId: { type: 'string', description: 'Optional workspace ID filter' },
    limit: { type: 'number', description: 'Maximum items to return' },
  },
} as const;

export const MCP_ID_INPUT = (description: string) =>
  ({
    type: 'object',
    properties: {
      id: { type: 'string', description },
    },
    required: ['id'],
  }) as const;

export const mcpItemsOutput = (itemSchema: Record<string, unknown>) =>
  ({
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: itemSchema,
      },
    },
  }) as const;
