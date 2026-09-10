import AsyncStorage from "@react-native-async-storage/async-storage";
import { MemoryRecordSchema, type MemoryRecord } from "@getpaseo/protocol/optimize-memory";
export interface MemoryDraft {
  record: MemoryRecord | null;
  projectId: string | null;
  title: string;
  body: string;
  source: string;
}
const queues = new Map<string, Promise<unknown>>();
function key(serverId: string) {
  return `optimize-memory-draft:${serverId}`;
}
function enqueue<T>(serverId: string, write: () => Promise<T>): Promise<T> {
  const name = key(serverId);
  const next = (queues.get(name) ?? Promise.resolve()).then(write, write);
  queues.set(
    name,
    next.catch(() => undefined),
  );
  return next;
}
export function saveMemoryDraft(serverId: string, draft: MemoryDraft) {
  return enqueue(serverId, () => AsyncStorage.setItem(key(serverId), JSON.stringify(draft)));
}
export function clearMemoryDraft(serverId: string) {
  return enqueue(serverId, () => AsyncStorage.removeItem(key(serverId)));
}
export async function readMemoryDraft(serverId: string): Promise<MemoryDraft | null> {
  await queues.get(key(serverId));
  const raw = await AsyncStorage.getItem(key(serverId));
  if (!raw) return null;
  const draft: unknown = JSON.parse(raw);
  if (
    !draft ||
    typeof draft !== "object" ||
    !("title" in draft) ||
    typeof draft.title !== "string" ||
    !("body" in draft) ||
    typeof draft.body !== "string" ||
    !("source" in draft) ||
    typeof draft.source !== "string" ||
    !("projectId" in draft) ||
    (draft.projectId !== null && typeof draft.projectId !== "string") ||
    !("record" in draft)
  )
    throw new Error("A saved memory draft could not be read. It has been kept on this Mac.");
  const record = draft.record === null ? null : MemoryRecordSchema.parse(draft.record);
  return {
    record,
    projectId: draft.projectId,
    title: draft.title,
    body: draft.body,
    source: draft.source,
  };
}
