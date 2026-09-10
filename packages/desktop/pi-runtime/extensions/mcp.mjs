import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export function registerMcp(pi) {
  const connections = [];
  pi.registerFlag("mcp-config", {
    description: "Optimize managed tool connections",
    type: "string",
  });
  pi.registerCommand("optimize-tools", {
    description: "Show the built-in Optimize tool connection status",
    handler: async (_args, ctx) =>
      ctx.ui.notify(`${connections.length} tool connection(s) active.`, "info"),
  });
  pi.on("session_start", async (_event, ctx) => {
    const configPath = pi.getFlag("mcp-config");
    if (!configPath) return;
    const config = JSON.parse(await readFile(configPath, "utf8"));
    for (const [name, server] of Object.entries(config.mcpServers ?? {})) {
      const client = new Client({ name: "optimize", version: "0.8.0" });
      try {
        const transport = server.url
          ? new StreamableHTTPClientTransport(new URL(server.url), {
              requestInit: { headers: server.headers },
            })
          : new StdioClientTransport({
              command: server.command,
              args: server.args,
              env: { ...process.env, ...server.env },
              stderr: "pipe",
            });
        await client.connect(transport);
        let cursor;
        do {
          const page = await client.listTools({ cursor });
          for (const tool of page.tools) registerRemoteTool(pi, client, name, tool);
          cursor = page.nextCursor;
        } while (cursor);
        connections.push(client);
      } catch (error) {
        await client.close().catch(() => {});
        ctx.ui.notify(`Tool connection ${name} failed: ${error.message}`, "error");
      }
    }
  });
  pi.on("session_shutdown", async () => {
    await Promise.allSettled(connections.splice(0).map((client) => client.close()));
  });
}

function registerRemoteTool(pi, client, name, tool) {
  // The company app exposes knowledge and browser tools from its own host.
  if (name === "paseo" && !/^(optimize_wiki_|browser_)/.test(tool.name)) return;
  const toolName =
    name === "paseo" ? tool.name : `${name}_${tool.name}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  pi.registerTool({
    name: toolName,
    label: tool.title ?? tool.name,
    description: tool.description ?? tool.name,
    parameters: tool.inputSchema,
    async execute(_id, params, signal) {
      const result = await client.callTool({ name: tool.name, arguments: params }, undefined, {
        signal,
      });
      if (result.isError) throw new Error(JSON.stringify(result.content));
      return { content: result.content, details: {} };
    },
  });
}
