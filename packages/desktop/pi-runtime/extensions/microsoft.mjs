import { Type } from "typebox";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { native, textResult } from "./native.mjs";
import {
  connectionConfig,
  serviceScopes,
  beginConnection,
  finishConnection,
  accessToken,
  graphUrl,
  graphRequest,
  isReadRequest,
  publicConnection,
} from "./microsoft-api.mjs";
async function load() {
  const { value } = await native({ action: "credential-read" });
  return value ? JSON.parse(value) : null;
}
async function save(state) {
  await native({ action: "credential-write", value: JSON.stringify(state) });
}
async function start(input, ctx, signal) {
  const config = connectionConfig(input);
  if (
    !(await ctx.ui.confirm(
      "Connect Microsoft 365",
      `Sign in to Optimize using your Microsoft account. Requested services: ${config.services.join(", ")}. Microsoft will show the exact permissions. Only proceed if this app registration belongs to your company.`,
    ))
  )
    throw new Error("Microsoft connection declined.");
  const state = await beginConnection(config, signal);
  await save(state);
  return {
    verificationUri: state.pending.verification_uri,
    userCode: state.pending.user_code,
    expiresAt: state.pending.expiresAt,
    instruction:
      "Open the Microsoft sign-in page yourself, enter this code, sign in and consent. Then ask Optimize to finish connecting. Never send passwords or MFA codes to the assistant.",
  };
}
async function finish(signal) {
  const state = await load();
  if (!state) throw new Error("Start Microsoft sign-in first.");
  const result = await finishConnection(state, signal);
  await save(result.state);
  return {
    ...publicConnection(result.state),
    waiting: result.waiting,
    message: result.waiting
      ? "Complete Microsoft sign-in, then try again after the displayed interval."
      : "Microsoft 365 connected.",
    retryAfterSeconds: result.state.pending?.interval,
  };
}
function scrubDownloadUrls(_key, value) {
  if (_key === "@microsoft.graph.downloadUrl") return undefined;
  return value;
}
async function download(response, downloadTo, ctx, signal) {
  let content = response;
  if (response.status === 302) {
    const target = new URL(response.headers.get("location"));
    if (target.protocol !== "https:" || target.username || target.password)
      throw new Error("Microsoft returned an invalid download URL.");
    content = await fetch(target, { signal, redirect: "error" }); // The Graph token is never forwarded to a download host.
  }
  if (!content.ok) throw new Error(`Microsoft download failed (${content.status}).`);
  const chunks = [];
  let size = 0;
  for await (const chunk of content.body) {
    size += chunk.length;
    if (size > 25_000_000) {
      await content.body.cancel().catch(() => {});
      throw new Error("Download exceeds the 25 MB limit.");
    }
    chunks.push(chunk);
  }
  const destination = path.resolve(ctx.cwd, downloadTo);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.concat(chunks), { flag: "wx", mode: 0o600 });
  return textResult({ savedTo: destination, bytes: size });
}
async function requestBody(params, cwd) {
  let body = params.body;
  let contentType = params.contentType ?? (body ? "application/json" : undefined);
  if (body && contentType === "application/json") JSON.parse(body);
  if (params.uploadFrom) {
    body = await readFile(path.resolve(cwd, params.uploadFrom));
    if (body.length > 25_000_000) throw new Error("This upload supports files up to 25 MB.");
    contentType = params.contentType ?? "application/octet-stream";
  }
  return { body, contentType };
}
async function perform(params, ctx, signal) {
  const url = graphUrl(params.path);
  const method = params.method ?? "GET";
  if (params.downloadTo && method !== "GET") throw new Error("Downloads require GET.");
  if (params.uploadFrom && isReadRequest(method, url))
    throw new Error("Uploads require a write method.");
  if (params.uploadFrom && params.body) throw new Error("Choose a JSON body or file upload.");
  if (!isReadRequest(method, url)) {
    const preview = params.uploadFrom
      ? `Upload file: ${path.resolve(ctx.cwd, params.uploadFrom)}`
      : (params.body ?? "No request body");
    if (
      !(await ctx.ui.confirm(
        "Apply Microsoft 365 change?",
        `${method} ${url.pathname}${url.search}\n\n${preview}\n\nThis may send a message, change a file, or notify other people. Confirm only the requested action.`,
      ))
    )
      throw new Error("Microsoft change declined.");
  }
  const { body, contentType } = await requestBody(params, ctx.cwd);
  const token = await accessToken(await load(), save, signal);
  const response = await graphRequest({
    token,
    method,
    url,
    body,
    contentType,
    etag: params.etag,
    signal,
    redirect: params.downloadTo ? "manual" : "error",
  });
  if (params.downloadTo) return download(response, params.downloadTo, ctx, signal);
  return responseResult(response);
}
async function responseResult(response) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.length;
    if (size > 90000)
      throw new Error(
        "Microsoft response is too large. Narrow the query with $select, $top, dates or a specific item, then retry.",
      );
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  if (!body.trim()) return textResult({ status: response.status });
  const contentType = response.headers.get("content-type");
  const value = contentType?.includes("json") ? JSON.parse(body) : { contentType, text: body };
  return textResult(JSON.stringify(value, scrubDownloadUrls));
}

export function registerMicrosoft(pi) {
  pi.registerCommand("microsoft", {
    description: "Connect Microsoft 365, check status, finish sign-in or disconnect",
    handler: async (args, ctx) => {
      try {
        const action = args.trim();
        if (action === "disconnect") {
          if (
            await ctx.ui.confirm(
              "Disconnect Microsoft 365?",
              "Remove this Mac's saved Microsoft connection?",
            )
          ) {
            await native({ action: "credential-delete" });
            ctx.ui.notify("Microsoft 365 disconnected on this Mac.", "info");
          }
          return;
        }
        if (action === "finish") {
          ctx.ui.notify(JSON.stringify(await finish()), "info");
          return;
        }
        const saved = await load();
        if (saved?.token || action === "status") {
          ctx.ui.notify(JSON.stringify(publicConnection(saved)), "info");
          return;
        }
        if (saved?.pending) {
          ctx.ui.notify(JSON.stringify(await finish()), "info");
          return;
        }
        const clientId = await ctx.ui.input(
          "Optimize Microsoft app ID",
          "Application (client) ID from your company's Microsoft Entra app registration",
        );
        if (!clientId) return;
        const tenant = await ctx.ui.input(
          "Microsoft tenant",
          "Tenant ID or company domain; blank uses organizations",
        );
        const response = await start({ clientId, tenant: tenant ?? "organizations" }, ctx);
        ctx.ui.notify(
          `Open ${response.verificationUri} and enter ${response.userCode}. After sign-in, run /microsoft finish.`,
          "info",
        );
      } catch (error) {
        ctx.ui.notify(error.message, "error");
      }
    },
  });
  pi.registerTool({
    name: "optimize_microsoft_connection",
    label: "Connect Microsoft 365",
    description:
      "Read the optimize-microsoft skill. Check status, start user-operated Microsoft sign-in, finish sign-in after the user approves, or disconnect. Requires the company's own Entra application client ID. Tokens stay in the Mac Keychain.",
    parameters: Type.Object({
      action: Type.Union(
        ["status", "start", "finish", "disconnect"].map((value) => Type.Literal(value)),
      ),
      clientId: Type.Optional(Type.String()),
      tenant: Type.Optional(Type.String()),
      services: Type.Optional(
        Type.Array(Type.Union(Object.keys(serviceScopes).map((value) => Type.Literal(value)))),
      ),
    }),
    async execute(_id, params, signal, _update, ctx) {
      switch (params.action) {
        case "status":
          return textResult(publicConnection(await load()));
        case "start":
          return textResult(await start(params, ctx, signal));
        case "finish":
          return textResult(await finish(signal));
        case "disconnect":
          if (
            !(await ctx.ui.confirm(
              "Disconnect Microsoft 365?",
              "Remove this Mac's saved Microsoft connection?",
            ))
          )
            throw new Error("Disconnect declined.");
          await native({ action: "credential-delete" }, signal);
          return textResult("Disconnected on this Mac.");
      }
    },
  });
  pi.registerTool({
    name: "optimize_microsoft_request",
    label: "Microsoft 365",
    description:
      "Read the optimize-microsoft skill before use. Call Microsoft Graph v1.0 for Outlook, contacts, calendars, OneDrive, SharePoint, Teams, OneNote, To Do/Planner and Excel workbook operations within the signed-in user's permissions. Use Graph documentation for exact endpoints. Mutations show a confirmation; writes are never automatically retried. Word/PowerPoint files can be downloaded/uploaded and edited in their Mac apps using computer use. Use $select/$top and follow @odata.nextLink. The connector does not grant tenant administrator powers.",
    parameters: Type.Object({
      path: Type.String(),
      method: Type.Optional(
        Type.Union(["GET", "POST", "PATCH", "PUT", "DELETE"].map((value) => Type.Literal(value))),
      ),
      body: Type.Optional(Type.String({ maxLength: 100000, description: "JSON request body" })),
      etag: Type.Optional(
        Type.String({ description: "Latest item's eTag for conditional updates" }),
      ),
      downloadTo: Type.Optional(Type.String()),
      uploadFrom: Type.Optional(Type.String()),
      contentType: Type.Optional(Type.String()),
    }),
    execute: (_id, params, signal, _update, ctx) => perform(params, ctx, signal),
  });
}
