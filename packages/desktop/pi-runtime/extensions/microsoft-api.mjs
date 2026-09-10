const authority = "https://login.microsoftonline.com";
export const serviceScopes = {
  outlook: ["Mail.ReadWrite", "Mail.Send", "Contacts.ReadWrite"],
  calendar: ["Calendars.ReadWrite"],
  files: ["Files.ReadWrite.All", "Sites.ReadWrite.All"],
  teams: [
    "Team.ReadBasic.All",
    "Channel.ReadBasic.All",
    "ChannelMessage.Read.All",
    "ChannelMessage.Send",
    "Chat.ReadWrite",
  ],
  notes: ["Notes.ReadWrite"],
  tasks: ["Tasks.ReadWrite"],
};
export function connectionConfig(input) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.clientId ?? ""))
    throw new Error("Enter your Optimize application's Microsoft Entra client ID.");
  const tenant = input.tenant || "organizations";
  if (!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i.test(tenant) || tenant.includes(".."))
    throw new Error("Invalid Microsoft tenant ID or domain.");
  const services = input.services ?? Object.keys(serviceScopes);
  if (!services.length || services.some((name) => !serviceScopes[name]))
    throw new Error("Select supported Microsoft services.");
  const scopes = [
    ...new Set([
      "openid",
      "profile",
      "offline_access",
      "User.Read",
      ...services.flatMap((name) => serviceScopes[name]),
    ]),
  ];
  return { clientId: input.clientId, tenant, services, scopes };
}
async function identity(config, endpoint, params, signal) {
  const response = await fetch(`${authority}/${config.tenant}/oauth2/v2.0/${endpoint}`, {
    method: "POST",
    redirect: "error",
    signal,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, ...params }),
  });
  const value = await response.json();
  if (!response.ok && !value.error)
    throw new Error(`Microsoft sign-in failed (${response.status}).`);
  return value;
}
export async function beginConnection(config, signal) {
  const value = await identity(config, "devicecode", { scope: config.scopes.join(" ") }, signal);
  if (value.error)
    throw new Error(
      `Microsoft sign-in: ${value.error}. Check the app registration's public client setting and tenant policy.`,
    );
  if (!value.device_code || !value.user_code || !Number.isFinite(value.expires_in))
    throw new Error("Microsoft returned an incomplete sign-in response.");
  return {
    ...config,
    pending: {
      ...value,
      expiresAt: Date.now() + value.expires_in * 1000,
      nextPollAt: Date.now() + (value.interval ?? 5) * 1000,
    },
  };
}
function mergeToken(state, value) {
  if (!value.access_token || !Number.isFinite(value.expires_in))
    throw new Error("Microsoft returned an incomplete token response.");
  return {
    ...state,
    pending: undefined,
    token: {
      access: value.access_token,
      refresh: value.refresh_token ?? state.token?.refresh,
      expiresAt: Date.now() + value.expires_in * 1000,
      scope: value.scope,
    },
  };
}
export async function finishConnection(state, signal) {
  if (!state.pending) throw new Error("Start Microsoft sign-in first.");
  if (Date.now() > state.pending.expiresAt)
    throw new Error("Microsoft sign-in expired. Start again.");
  if (Date.now() < state.pending.nextPollAt) return { state, waiting: true };
  const value = await identity(
    state,
    "token",
    {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: state.pending.device_code,
    },
    signal,
  );
  if (value.error === "authorization_pending" || value.error === "slow_down") {
    const interval = (state.pending.interval ?? 5) + (value.error === "slow_down" ? 5 : 0);
    return {
      state: {
        ...state,
        pending: { ...state.pending, interval, nextPollAt: Date.now() + interval * 1000 },
      },
      waiting: true,
    };
  }
  if (value.error)
    throw new Error(
      `Microsoft sign-in: ${value.error}. Start again if the request expired or was declined.`,
    );
  return { state: mergeToken(state, value), waiting: false };
}
export async function accessToken(state, save, signal) {
  if (!state?.token) throw new Error("Connect Microsoft 365 with /microsoft first.");
  if (state.token.expiresAt > Date.now() + 60000) return state.token.access;
  if (!state.token.refresh)
    throw new Error("Microsoft sign-in expired. Reconnect with /microsoft.");
  const value = await identity(
    state,
    "token",
    {
      grant_type: "refresh_token",
      refresh_token: state.token.refresh,
      scope: state.scopes.join(" "),
    },
    signal,
  );
  if (value.error) throw new Error(`Microsoft session: ${value.error}. Reconnect with /microsoft.`);
  const renewed = mergeToken(state, value);
  await save(renewed);
  return renewed.token.access;
}
export function graphUrl(input) {
  const url = new URL(input, "https://graph.microsoft.com/v1.0/");
  if (
    url.origin !== "https://graph.microsoft.com" ||
    url.username ||
    url.password ||
    url.hash ||
    !url.pathname.startsWith("/v1.0/")
  )
    throw new Error("Use Microsoft Graph v1.0 paths or a Graph nextLink on graph.microsoft.com.");
  const resource = url.pathname.slice(6).split("/")[0];
  if (
    ![
      "me",
      "users",
      "drives",
      "sites",
      "teams",
      "chats",
      "groups",
      "planner",
      "search",
      "$metadata",
    ].includes(resource)
  )
    throw new Error("This Graph resource is outside the Optimize Microsoft 365 connector.");
  return url;
}
export function isReadRequest(method, url) {
  return method === "GET" || (method === "POST" && url.pathname === "/v1.0/search/query");
}
export async function graphRequest({
  token,
  method,
  url,
  body,
  contentType,
  etag,
  signal,
  redirect = "error",
}) {
  const response = await fetch(url, {
    method,
    redirect,
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(contentType ? { "Content-Type": contentType } : {}),
      ...(etag ? { "If-Match": etag } : {}),
    },
    ...(method === "GET" ? {} : { body }),
  });
  if (response.status === 429)
    throw new Error(
      `Microsoft rate limit. Retry after ${response.headers.get("retry-after") ?? "the indicated"} seconds; no write was retried.`,
    );
  if (response.status === 412)
    throw new Error(
      "The Microsoft item changed. Read the latest version and reconcile before writing.",
    );
  if (!response.ok && response.status !== 302) {
    const value = await response.json().catch(() => ({}));
    throw new Error(
      `Microsoft Graph ${response.status}: ${value.error?.code ?? "request_failed"}. ${response.status === 403 ? "This service requires the account's permission and possibly administrator consent." : ""}`,
    );
  }
  return response;
}
export function publicConnection(state) {
  return {
    connected: Boolean(state?.token),
    clientId: state?.clientId ?? null,
    tenant: state?.tenant ?? null,
    services: state?.services ?? [],
    grantedScopes: state?.token?.scope ?? null,
    pending: Boolean(state?.pending),
  };
}
