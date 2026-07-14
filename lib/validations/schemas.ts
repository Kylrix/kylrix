import { z } from 'zod';

export const IDSchema = z.string().min(1).max(128);
export const DatabaseIDSchema = z.string().min(1).max(128);
export const TableIDSchema = z.string().min(1).max(128);
export const JWTSchema = z.string().optional();

export const CRUDParamsSchema = z.object({
  databaseId: DatabaseIDSchema,
  tableId: TableIDSchema,
  rowId: IDSchema,
});

export const ListParamsSchema = z.object({
  databaseId: DatabaseIDSchema,
  tableId: TableIDSchema,
  queries: z.array(z.string()).optional(),
});

export const MutatePermissionsSchema = z.object({
  action: z.enum(['grant', 'revoke', 'pin_ghost_note']).default('grant'),
  rowId: IDSchema.optional(),
  noteIds: z.union([z.string(), z.array(z.string())]).optional(),
  resourceId: IDSchema.optional(),
  resourceIds: z.array(IDSchema).optional(),
  wrappedKey: z.string().optional(),
  ghostSecret: z.string().optional(),
  resourceType: z.string().optional(),
  metadata: z.string().nullable().optional(),
});

export const CreateRowSchema = z.object({
  databaseId: DatabaseIDSchema,
  tableId: TableIDSchema,
  data: z.record(z.string(), z.any()),
  permissions: z.array(z.string()).optional(),
});

export const UpdateRowSchema = z.object({
  databaseId: DatabaseIDSchema,
  tableId: TableIDSchema,
  rowId: IDSchema,
  data: z.record(z.string(), z.any()),
  permissions: z.array(z.string()).optional(),
});

export const NoteSchema = z.object({
  title: z.string().min(1).max(512),
  content: z.string().optional(),
  format: z.enum(['markdown', 'text']).default('markdown'),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  isGuest: z.boolean().optional(),
  metadata: z.string().nullable().optional(),
  article: z.boolean().optional().nullable(),
});

export const ProjectSchema = z.object({
  title: z.string().min(1).max(255),
  summary: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  color: z.string().optional(),
  visibility: z.enum(['private', 'public']).optional(),
  status: z.enum(['active', 'paused', 'archived', 'completed', 'on_hold']).optional(),
  isPublic: z.boolean().optional(),
  isGuest: z.boolean().optional(),
  isPinned: z.boolean().optional().nullable(),
  metadata: z.string().nullable().optional(),
});

export const EventSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export const FormSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  schema: z.string().optional(),
  settings: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export const CallParamsSchema = z.object({
  callId: IDSchema,
  status: z.string().optional(),
});

export const DiscussionParamsSchema = z.object({
  taskId: IDSchema.optional(),
  projectId: IDSchema.optional(),
  title: z.string().optional(),
});

export const TelegramParamsSchema = z.object({
  chatId: z.union([z.string(), z.number()]),
  message: z.string().min(1),
  parseMode: z.enum(['Markdown', 'HTML', 'MarkdownV2']).default('Markdown'),
});

export const CallInputSchema = z.object({
  conversationId: IDSchema,
  participantIds: z.array(IDSchema).min(1),
  type: z.enum(['audio', 'video']).default('audio'),
  title: z.string().optional(),
  durationMinutes: z.number().optional().default(120),
  scope: z.enum(['direct', 'group']).optional(),
});

export const ChatMessageSchema = z.object({
  conversationId: IDSchema,
  content: z.string().min(1),
  type: z.string().default('text'),
  attachments: z.array(z.string()).optional(),
  replyTo: z.string().optional(),
});

export const ReactionSchema = z.object({
  conversationId: IDSchema,
  messageId: IDSchema,
  emoji: z.string().min(1),
  action: z.enum(['POST', 'DELETE']),
});

export const JoinRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PATCH', 'DELETE']),
  resourceType: z.string(),
  resourceId: IDSchema,
  requesterId: IDSchema.optional(),
  action: z.enum(['accept', 'reject']).optional(),
});

export const TokenOperationSchema = z.object({
  operation: z.enum(['mint', 'transfer', 'fine', 'claim']),
  userId: IDSchema,
  amount: z.number().positive(),
  metadata: z.record(z.string(), z.any()).optional(),
  jwt: JWTSchema,
});

export const TelemetrySchema = z.object({
  action: z.string(),
  app: z.string(),
  niche: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const EphemeralNoteSchema = z.object({
  noteId: IDSchema,
  secret: z.string().min(1),
});

export const SuggestionParamsSchema = z.object({
  sourceApp: z.string(),
  sourceType: z.string(),
  sourceId: z.string().nullable(),
});






