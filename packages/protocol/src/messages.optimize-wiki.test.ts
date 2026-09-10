import { expect, test } from "vitest";
import { WikiIndexResponseSchema } from "./optimize-wiki.js";
import { validateWSOutboundMessage } from "./validation/ws-outbound.js";

test.each([
  { requestId: "wiki-empty", ok: true, pages: [] },
  {
    requestId: "wiki-linked",
    ok: true,
    pages: [
      {
        id: "7ab122a2-a36d-4525-8792-99e460ee4158",
        title: "Product care",
        parentId: null,
        updatedAt: "2026-09-10T12:00:00.000Z",
        links: ["Products"],
      },
    ],
  },
  {
    requestId: "wiki-error",
    ok: false,
    error: { code: "unavailable", message: "Storage unavailable" },
  },
])("accepts Wiki index payload $requestId through the compiled wire validator", (payload) => {
  const message = { type: "wiki.index.response", payload };
  expect(WikiIndexResponseSchema.safeParse(message).success).toBe(true);
  expect(validateWSOutboundMessage({ type: "session", message })).toEqual({
    success: true,
    data: { type: "session", message },
  });
});
