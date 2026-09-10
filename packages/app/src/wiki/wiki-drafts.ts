import { z } from "zod";
import { WikiPageSchema } from "@getpaseo/protocol/optimize-wiki";

export const WikiDraftSchema = z.object({
  page: WikiPageSchema.optional(),
  title: z.string().max(160),
  body: z.string().max(200000),
  parentId: z.string().uuid().nullable(),
  parentTitle: z.string(),
  updatedAt: z.string().optional(),
});
export type WikiDraft = z.infer<typeof WikiDraftSchema>;
export interface WikiDraftEntry {
  id: string;
  draft: WikiDraft | null;
}
export function wikiDraftPrefix(serverId: string): string {
  return `optimize.wiki.draft.${serverId}.`;
}
export function wikiDraftKey(serverId: string, draftId: string): string {
  return `${wikiDraftPrefix(serverId)}${draftId}`;
}
export function parseWikiDrafts(
  serverId: string,
  entries: readonly (readonly [string, string | null])[],
): WikiDraftEntry[] {
  const prefix = wikiDraftPrefix(serverId);
  const drafts: WikiDraftEntry[] = [];
  for (const [key, raw] of entries) {
    if (!key.startsWith(prefix) || !raw) continue;
    try {
      drafts.push({ id: key.slice(prefix.length), draft: WikiDraftSchema.parse(JSON.parse(raw)) });
    } catch {
      drafts.push({ id: key.slice(prefix.length), draft: null });
    }
  }
  return drafts.sort((a, b) => (b.draft?.updatedAt ?? "").localeCompare(a.draft?.updatedAt ?? ""));
}
