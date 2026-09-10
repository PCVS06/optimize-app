import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { registerMcp } from "./mcp.mjs";

test("stock Pi bridge discovers host Wiki tools and forwards a publish through authenticated MCP", async () => {
  let published = null;
  const api = createServer(async (req, res) => {
    if (req.headers.authorization !== "Bearer fixture-capability") {
      res.writeHead(401).end();
      return;
    }
    const server = new McpServer({ name: "fixture", version: "1" });
    server.registerTool(
      "optimize_wiki_write",
      { inputSchema: { title: z.string(), body: z.string(), expectedRevision: z.null() } },
      async (input) => {
        published = input;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ...input, id: "fixture-id", revision: "new-revision" }),
            },
          ],
        };
      },
    );
    server.registerTool("coding_operation", { inputSchema: {} }, async () => ({ content: [] }));
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });
  await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
  const directory = await mkdtemp(path.join(tmpdir(), "optimize-bridge-"));
  const configPath = path.join(directory, "mcp.json");
  await writeFile(
    configPath,
    JSON.stringify({
      mcpServers: {
        paseo: {
          url: `http://127.0.0.1:${api.address().port}/mcp/agents`,
          headers: { Authorization: "Bearer fixture-capability" },
        },
      },
    }),
  );
  const handlers = new Map(),
    tools = new Map(),
    commands = new Map(),
    notices = [];
  const pi = {
    registerFlag() {},
    getFlag: () => configPath,
    registerCommand: (name, tool) => commands.set(name, tool),
    on: (name, fn) => handlers.set(name, fn),
    registerTool: (tool) => tools.set(tool.name, tool),
  };
  registerMcp(pi);
  try {
    await handlers.get("session_start")({}, { ui: { notify: (...args) => notices.push(args) } });
    assert.deepEqual(notices, []);
    assert.ok(commands.has("optimize-tools"));
    assert.ok(tools.has("optimize_wiki_write"));
    assert.ok(!tools.has("coding_operation"));
    const input = {
      title: "Product reference",
      body: "## Summary\nVerified information",
      expectedRevision: null,
    };
    const result = await tools.get("optimize_wiki_write").execute("call-1", input);
    assert.deepEqual(published, input);
    assert.equal(JSON.parse(result.content[0].text).revision, "new-revision");
  } finally {
    await handlers.get("session_shutdown")();
    await new Promise((resolve) => api.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
