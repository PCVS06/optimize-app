import type { SessionInboundMessage, SessionOutboundMessage } from "../messages.js";
import { getOptimizeMemoryStore } from "../optimize-memory.js";
import type { ProjectRegistry } from "../workspace-registry.js";
type Request = Extract<
  SessionInboundMessage,
  { type: "memory.list.request" | "memory.write.request" | "memory.remove.request" }
>;
export class OptimizeMemorySession {
  constructor(
    private readonly options: {
      paseoHome: string;
      projects: Pick<ProjectRegistry, "get">;
      emit: (message: SessionOutboundMessage) => void;
    },
  ) {}
  async handle(message: Request): Promise<void> {
    const store = getOptimizeMemoryStore(this.options.paseoHome);
    try {
      if ("projectId" in message && message.projectId) {
        const project = await this.options.projects.get(message.projectId);
        if (!project || project.archivedAt || project.companyKind === "chats")
          throw new Error("Choose an active project for this memory.");
      }
      switch (message.type) {
        case "memory.list.request":
          this.options.emit({
            type: "memory.list.response",
            payload: { requestId: message.requestId, ok: true, ...(await store.list(message)) },
          });
          return;
        case "memory.write.request":
          this.options.emit({
            type: "memory.write.response",
            payload: { requestId: message.requestId, ok: true, record: await store.write(message) },
          });
          return;
        case "memory.remove.request":
          await store.remove(message);
          this.options.emit({
            type: "memory.remove.response",
            payload: { requestId: message.requestId, ok: true },
          });
          return;
      }
    } catch (error) {
      const type = {
        "memory.list.request": "memory.list.response",
        "memory.write.request": "memory.write.response",
        "memory.remove.request": "memory.remove.response",
      } as const;
      this.options.emit({
        type: type[message.type],
        payload: {
          requestId: message.requestId,
          ok: false,
          error: error instanceof Error ? error.message : "Memory is unavailable. Try again.",
        },
      });
    }
  }
}
