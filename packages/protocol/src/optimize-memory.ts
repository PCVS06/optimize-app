import { z } from "zod";

export const MemoryRecordSchema = z.object({
  id: z.string().uuid(),
  revision: z.string().uuid(),
  projectId: z.string().nullable(),
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(6000),
  source: z.string().max(1000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;
export const MemoryListInputSchema = z.object({
  projectId: z.string().nullable(),
  query: z.string().max(300).optional(),
  offset: z.number().int().min(0).optional(),
});
export const MemoryWriteInputSchema = MemoryRecordSchema.pick({
  projectId: true,
  title: true,
  body: true,
  source: true,
}).extend({
  id: z.string().uuid().optional(),
  expectedRevision: z.string().uuid().nullable(),
});
export const MemoryRemoveInputSchema = z.object({
  id: z.string().uuid(),
  expectedRevision: z.string().uuid(),
});
export type MemoryWriteInput = z.infer<typeof MemoryWriteInputSchema>;
export type MemoryListInput = z.infer<typeof MemoryListInputSchema>;
export type MemoryRemoveInput = z.infer<typeof MemoryRemoveInputSchema>;
export const MemoryListRequestSchema = MemoryListInputSchema.extend({
  type: z.literal("memory.list.request"),
  requestId: z.string(),
});
export const MemoryWriteRequestSchema = MemoryWriteInputSchema.extend({
  type: z.literal("memory.write.request"),
  requestId: z.string(),
});
export const MemoryRemoveRequestSchema = MemoryRemoveInputSchema.extend({
  type: z.literal("memory.remove.request"),
  requestId: z.string(),
});
const MemoryFailureSchema = z.object({
  requestId: z.string(),
  ok: z.literal(false),
  error: z.string(),
});
export const MemoryListResponseSchema = z.object({
  type: z.literal("memory.list.response"),
  payload: z.union([
    z.object({
      requestId: z.string(),
      ok: z.literal(true),
      records: z.array(MemoryRecordSchema),
      total: z.number(),
      nextOffset: z.number().nullable(),
    }),
    MemoryFailureSchema,
  ]),
});
export const MemoryWriteResponseSchema = z.object({
  type: z.literal("memory.write.response"),
  payload: z.union([
    z.object({ requestId: z.string(), ok: z.literal(true), record: MemoryRecordSchema }),
    MemoryFailureSchema,
  ]),
});
export const MemoryRemoveResponseSchema = z.object({
  type: z.literal("memory.remove.response"),
  payload: z.union([z.object({ requestId: z.string(), ok: z.literal(true) }), MemoryFailureSchema]),
});
