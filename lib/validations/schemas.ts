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
  data: z.record(z.any()),
  permissions: z.array(z.string()).optional(),
});

export const UpdateRowSchema = z.object({
  databaseId: DatabaseIDSchema,
  tableId: TableIDSchema,
  rowId: IDSchema,
  data: z.record(z.any()),
  permissions: z.array(z.string()).optional(),
});
