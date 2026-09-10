import {
  WikiWriteInputSchema,
  type WikiPage,
  type WikiWriteInput,
} from "@getpaseo/protocol/optimize-wiki";

interface WikiEditorState {
  title: string;
  body: string;
  parentId: string | null;
  parentTitle: string;
  status: "editing" | "saving";
  error: string | null;
  canSave: boolean;
}
interface WikiEditorOptions {
  page?: WikiPage;
  parentTitle?: string;
  initial?: { title?: string; body?: string; parentId?: string | null };
  write: (input: WikiWriteInput) => Promise<WikiPage>;
}

export function openWikiEditor({
  page,
  write,
  parentTitle = "Top level",
  initial,
}: WikiEditorOptions) {
  const listeners = new Set<() => void>();
  let state: WikiEditorState = {
    title: initial?.title ?? page?.title ?? "",
    body: initial?.body ?? page?.body ?? "",
    parentId: initial?.parentId === undefined ? (page?.parentId ?? null) : initial.parentId,
    parentTitle,
    status: "editing",
    error: null,
    canSave: false,
  };
  function publish(patch: Partial<WikiEditorState>) {
    state = { ...state, ...patch };
    state.canSave =
      state.status === "editing" &&
      Boolean(state.title.trim()) &&
      state.title.trim().length <= 160 &&
      state.body.length <= 100_000 &&
      (state.title !== page?.title ||
        state.body !== page?.body ||
        state.parentId !== (page?.parentId ?? null));
    listeners.forEach((listener) => listener());
  }
  publish({});
  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setTitle(title: string) {
      if (state.status !== "saving") publish({ title, error: null });
    },
    setParent(parentId: string | null, label: string) {
      if (state.status !== "saving") publish({ parentId, parentTitle: label, error: null });
    },
    setBody(body: string) {
      if (state.status !== "saving") publish({ body, error: null });
    },
    async save(): Promise<WikiPage | null> {
      if (!state.canSave) return null;
      publish({ status: "saving", error: null });
      try {
        const saved = await write(
          WikiWriteInputSchema.parse({
            id: page?.id,
            expectedRevision: page?.revision ?? null,
            title: state.title,
            body: state.body,
            parentId: state.parentId,
          }),
        );
        return saved;
      } catch (error) {
        publish({
          status: "editing",
          error:
            error instanceof Error
              ? error.message
              : "Could not save this page. Your draft is kept.",
        });
        return null;
      }
    },
  };
}
