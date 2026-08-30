import { z } from 'zod';

export const IDSchema = z.string().min(1).max(128);
const DatabaseIDSchema = z.string().min(1).max(128);
const TableIDSchema = z.string().min(1).max(128);
export const JWTSchema = z.string().optional();

export const CRUDParamsSchema = z.object({
  databaseId: DatabaseIDSchema,
  tableId: TableIDSchema,
  rowId: IDSchema});

export const ListParamsSchema = z.object({
  databaseId: DatabaseIDSchema,
  tableId: TableIDSchema,
  queries: z.array(z.string()).optional()});

export const MutatePermissionsSchema = z.object({
  action: z.enum(['grant', 'revoke', 'pin_thread_note']).default('grant'),
  rowId: IDSchema.optional(),
  noteIds: z.union([z.string(), z.array(z.string())]).optional(),
  resourceId: IDSchema.optional(),
  resourceIds: z.array(IDSchema).optional(),
  wrappedKey: z.string().optional(),
  threadSecret: z.string().optional(),
  resourceType: z.string().optional(),
  metadata: z.string().nullable().optional()});

export const CreateRowSchema = z.object({
  databaseId: DatabaseIDSchema,
  tableId: TableIDSchema,
  data: z.record(z.string(), z.any()),
  permissions: z.array(z.string()).optional()});

export const UpdateRowSchema = z.object({
  databaseId: DatabaseIDSchema,
  tableId: TableIDSchema,
  rowId: IDSchema,
  data: z.record(z.string(), z.any()),
  permissions: z.array(z.string()).optional()});

export const NoteSchema = z.object({
  title: z.string().min(1).max(206),
  content: z.string().optional(),
  format: z.enum(['markdown', 'text']).default('markdown'),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  isGuest: z.boolean().optional(),
  metadata: z.string().nullable().optional(),
  article: z.boolean().optional().nullable()});

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
  kind: z.enum(['workspace', 'project']).optional(),
  parentProjectId: z.string().max(64).optional().nullable(),
  metadata: z.string().nullable().optional()});






export const CallInputSchema = z.object({
  conversationId: IDSchema,
  participantIds: z.array(IDSchema).min(1),
  type: z.enum(['audio', 'video']).default('audio'),
  title: z.string().optional(),
  durationMinutes: z.number().optional().default(120),
  scope: z.enum(['direct', 'group']).optional()});

export const ChatMessageSchema = z.object({
  conversationId: IDSchema,
  content: z.string().min(1),
  type: z.string().default('text'),
  attachments: z.array(z.string()).optional(),
  replyTo: z.string().optional(),
  isBookmark: z.boolean().optional()});

export const ReactionSchema = z.object({
  conversationId: IDSchema,
  messageId: IDSchema,
  emoji: z.string().min(1),
  action: z.enum(['POST', 'DELETE'])});

export const JoinRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PATCH', 'DELETE']),
  resourceType: z.string(),
  resourceId: IDSchema,
  requesterId: IDSchema.optional(),
  action: z.enum(['accept', 'reject']).optional()});




export const SuggestionParamsSchema = z.object({
  sourceApp: z.string(),
  sourceType: z.string(),
  sourceId: z.string().nullable()});






