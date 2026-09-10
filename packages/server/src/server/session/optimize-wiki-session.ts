import type { Logger } from "pino";
import type { SessionInboundMessage, SessionOutboundMessage } from "../messages.js";
import { getOptimizeWikiStore, WikiError, type OptimizeWikiStore } from "../optimize-wiki.js";

interface WikiSessionOptions {
  paseoHome: string;
  emit: (message: SessionOutboundMessage) => void;
  logger: Logger;
}
type WikiRequest = Extract<
  SessionInboundMessage,
  {
    type:
      | "wiki.trash.request"
      | "wiki.archive.request"
      | "wiki.history.request"
      | "wiki.revision.request"
      | "wiki.index.request"
      | "wiki.search.request"
      | "wiki.read.request"
      | "wiki.write.request";
  }
>;

const responseTypes = {
  "wiki.trash.request": "wiki.trash.response",
  "wiki.archive.request": "wiki.archive.response",
  "wiki.history.request": "wiki.history.response",
  "wiki.revision.request": "wiki.revision.response",
  "wiki.index.request": "wiki.index.response",
  "wiki.search.request": "wiki.search.response",
  "wiki.read.request": "wiki.read.response",
  "wiki.write.request": "wiki.write.response",
} as const;

export class OptimizeWikiSession {
  private readonly store: OptimizeWikiStore;
  constructor(private readonly options: WikiSessionOptions) {
    this.store = getOptimizeWikiStore(options.paseoHome);
  }

  async handle(message: WikiRequest): Promise<void> {
    const requestId = message.requestId;
    try {
      switch (message.type) {
        case "wiki.trash.request":
          this.options.emit({
            type: "wiki.trash.response",
            payload: { requestId, ok: true, ...(await this.store.trash(message)) },
          });
          return;
        case "wiki.archive.request":
          this.options.emit({
            type: "wiki.archive.response",
            payload: { requestId, ok: true, page: await this.store.archive(message) },
          });
          return;
        case "wiki.history.request":
          this.options.emit({
            type: "wiki.history.response",
            payload: {
              requestId,
              ok: true,
              ...(await this.store.history(message.id, message.offset)),
            },
          });
          return;
        case "wiki.revision.request":
          this.options.emit({
            type: "wiki.revision.response",
            payload: {
              requestId,
              ok: true,
              page: await this.store.readRevision(message.id, message.revision),
            },
          });
          return;
        case "wiki.index.request":
          this.options.emit({
            type: "wiki.index.response",
            payload: { requestId, ok: true, pages: await this.store.index() },
          });
          return;
        case "wiki.search.request":
          this.options.emit({
            type: "wiki.search.response",
            payload: { requestId, ok: true, ...(await this.store.search(message)) },
          });
          return;
        case "wiki.read.request":
          this.options.emit({
            type: "wiki.read.response",
            payload: { requestId, ok: true, page: await this.store.read(message.id) },
          });
          return;
        case "wiki.write.request":
          this.options.emit({
            type: "wiki.write.response",
            payload: { requestId, ok: true, page: await this.store.write(message) },
          });
          return;
      }
    } catch (error) {
      this.options.logger.warn(
        { err: error, operation: message.type },
        "Optimize Wiki request failed",
      );
      this.options.emit({
        type: responseTypes[message.type],
        payload: {
          requestId,
          ok: false,
          error:
            error instanceof WikiError
              ? { code: error.code, message: error.message }
              : {
                  code: "unavailable",
                  message:
                    "The Wiki could not be saved or loaded. Your draft is kept. Check the connection and try again.",
                },
        },
      });
    }
  }
}
