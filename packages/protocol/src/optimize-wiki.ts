import { z } from "zod";

export const WikiPageIdSchema = z.string().uuid();
export const WikiPageContentSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().max(100_000),
  parentId: WikiPageIdSchema.nullable().optional(),
});
export const WikiPageSchema = WikiPageContentSchema.extend({
  id: WikiPageIdSchema,
  revision: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const WikiPageSummarySchema = WikiPageSchema.omit({ body: true }).extend({
  excerpt: z.string(),
});
export const WikiSearchInputSchema = z.object({
  query: z.string().max(300).optional(),
  offset: z.number().int().min(0).optional(),
});
export const WikiWriteInputSchema = WikiPageContentSchema.extend({
  id: WikiPageIdSchema.optional(),
  expectedRevision: z.string().uuid().nullable(),
});
export const WikiErrorSchema = z.object({
  code: z.enum(["not_found", "conflict", "invalid", "unavailable"]),
  message: z.string(),
});
export type WikiPage = z.infer<typeof WikiPageSchema>;
export type WikiPageSummary = z.infer<typeof WikiPageSummarySchema>;
export type WikiSearchInput = z.infer<typeof WikiSearchInputSchema>;
export type WikiWriteInput = z.infer<typeof WikiWriteInputSchema>;

export const WikiSearchRequestSchema = WikiSearchInputSchema.extend({
  type: z.literal("wiki.search.request"),
  requestId: z.string(),
});
export const WikiReadRequestSchema = z.object({
  type: z.literal("wiki.read.request"),
  requestId: z.string(),
  id: WikiPageIdSchema,
});
export const WikiWriteRequestSchema = WikiWriteInputSchema.extend({
  type: z.literal("wiki.write.request"),
  requestId: z.string(),
});
export const WikiSearchResponseSchema = z.object({
  type: z.literal("wiki.search.response"),
  payload: z.union([
    z.object({
      requestId: z.string(),
      ok: z.literal(true),
      pages: z.array(WikiPageSummarySchema),
      total: z.number().int(),
      nextOffset: z.number().int().nullable(),
    }),
    z.object({ requestId: z.string(), ok: z.literal(false), error: WikiErrorSchema }),
  ]),
});
export const WikiReadResponseSchema = z.object({
  type: z.literal("wiki.read.response"),
  payload: z.union([
    z.object({ requestId: z.string(), ok: z.literal(true), page: WikiPageSchema }),
    z.object({ requestId: z.string(), ok: z.literal(false), error: WikiErrorSchema }),
  ]),
});
export const WikiWriteResponseSchema = z.object({
  type: z.literal("wiki.write.response"),
  payload: z.union([
    z.object({ requestId: z.string(), ok: z.literal(true), page: WikiPageSchema }),
    z.object({ requestId: z.string(), ok: z.literal(false), error: WikiErrorSchema }),
  ]),
});

export const WikiIndexEntrySchema = z.object({
  id: WikiPageIdSchema,
  title: z.string(),
  parentId: WikiPageIdSchema.nullable(),
  updatedAt: z.string(),
  links: z.array(z.string()),
});
export type WikiIndexEntry = z.infer<typeof WikiIndexEntrySchema>;
export const WikiIndexRequestSchema = z.object({
  type: z.literal("wiki.index.request"),
  requestId: z.string(),
});
export const WikiIndexResponseSchema = z.object({
  type: z.literal("wiki.index.response"),
  // zod-aot currently emits boolean discriminators as string switch cases.
  // Match the other Wiki responses so source and compiled validators agree.
  payload: z.union([
    z.object({ requestId: z.string(), ok: z.literal(true), pages: z.array(WikiIndexEntrySchema) }),
    z.object({ requestId: z.string(), ok: z.literal(false), error: WikiErrorSchema }),
  ]),
});
