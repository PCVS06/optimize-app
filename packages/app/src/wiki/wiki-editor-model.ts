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
  latest: WikiPage | null;
}
interface WikiEditorOptions {
  page?: WikiPage;
  newPageId?: string;
  parentTitle?: string;
  latest?: WikiPage;
  initial?: { title?: string; body?: string; parentId?: string | null };
  write: (input: WikiWriteInput) => Promise<WikiPage>;
}

export class WikiConflictError extends Error {
  constructor(readonly latest: WikiPage) {
    super("A newer version was published. Review it below before publishing your draft.");
  }
}

export function openWikiEditor({
  page,
  newPageId,
  write,
  parentTitle = "Top level",
  initial,
  latest,
}: WikiEditorOptions) {
  const listeners = new Set<() => void>();
  let basePage = page;
  let state: WikiEditorState = {
    title: initial?.title ?? page?.title ?? "",
    body: initial?.body ?? page?.body ?? "",
    parentId: initial?.parentId === undefined ? (page?.parentId ?? null) : initial.parentId,
    parentTitle,
    status: "editing",
    error: latest
      ? "A newer version was published while this draft was closed. Review it below."
      : null,
    latest: latest ?? null,
    canSave: false,
  };
  function publish(patch: Partial<WikiEditorState>) {
    state = { ...state, ...patch };
    state.canSave =
      state.status === "editing" &&
      !state.latest &&
      Boolean(state.title.trim()) &&
      state.title.trim().length <= 160 &&
      state.body.length <= 100_000 &&
      (state.title !== basePage?.title ||
        state.body !== basePage?.body ||
        state.parentId !== (basePage?.parentId ?? null));
    listeners.forEach((listener) => listener());
  }
  publish({});
  return {
    getState: () => state,
    getBasePage: () => basePage,
    acceptLatest() {
      if (!state.latest) return;
      basePage = state.latest;
      publish({ latest: null, error: null });
    },
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
            id: basePage?.id ?? newPageId,
            expectedRevision: basePage?.revision ?? null,
            title: state.title,
            body: state.body,
            parentId: state.parentId,
          }),
        );
        return saved;
      } catch (error) {
        publish({
          status: "editing",
          latest: error instanceof WikiConflictError ? error.latest : null,
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
