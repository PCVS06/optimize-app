import { test } from "node:test";
import assert from "node:assert/strict";
import {
  connectionConfig,
  graphUrl,
  isReadRequest,
  publicConnection,
  beginConnection,
  finishConnection,
  accessToken,
  graphRequest,
} from "./microsoft-api.mjs";
const clientId = "a0b12345-a123-4123-a123-123456789012";
test("Graph requests stay on the supported Microsoft origin and resource boundary", () => {
  assert.equal(
    graphUrl("me/messages?$top=5").href,
    "https://graph.microsoft.com/v1.0/me/messages?$top=5",
  );
  for (const value of [
    "https://attacker.test/v1.0/me",
    "//attacker.test/me",
    "https://user:pass@graph.microsoft.com/v1.0/me",
    "/beta/me",
    "/v1.0/applications",
    "/v1.0/../beta/me",
  ])
    assert.throws(() => graphUrl(value));
  assert.equal(isReadRequest("POST", graphUrl("search/query")), true);
  assert.equal(isReadRequest("POST", graphUrl("me/sendMail")), false);
});
test("service selection and public status never reveal connection secrets", () => {
  const config = connectionConfig({ clientId, services: ["outlook", "calendar"] });
  assert.ok(config.scopes.includes("Mail.Send"));
  assert.ok(!config.scopes.includes("Chat.ReadWrite"));
  assert.throws(() => connectionConfig({ clientId, tenant: "../common" }));
  assert.throws(() => connectionConfig({ clientId: "" }));
  const status = JSON.stringify(
    publicConnection({
      ...config,
      token: { access: "SECRET_ACCESS", refresh: "SECRET_REFRESH" },
      pending: { device_code: "SECRET_DEVICE" },
    }),
  );
  assert.ok(!status.includes("SECRET"));
});
test("device sign-in handles pending, slow-down, refresh and token isolation", async () => {
  const previousFetch = globalThis.fetch;
  const calls = [];
  const replies = [
    {
      device_code: "device-secret",
      user_code: "USER-CODE",
      verification_uri: "https://microsoft.com/devicelogin",
      expires_in: 900,
      interval: 5,
    },
    { error: "authorization_pending" },
    { error: "slow_down" },
    {
      access_token: "first-access",
      refresh_token: "first-refresh",
      expires_in: 3600,
      scope: "User.Read",
    },
    { access_token: "second-access", refresh_token: "second-refresh", expires_in: 3600 },
  ];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const value = replies.shift();
    return Response.json(value, { status: value.error ? 400 : 200 });
  };
  try {
    let state = await beginConnection(connectionConfig({ clientId }));
    assert.equal(state.pending.user_code, "USER-CODE");
    assert.equal((await finishConnection(state)).waiting, true);
    assert.equal(calls.length, 1, "early polling makes no network request");
    state.pending.nextPollAt = 0;
    let result = await finishConnection(state);
    assert.equal(result.waiting, true);
    result.state.pending.nextPollAt = 0;
    result = await finishConnection(result.state);
    assert.equal(result.state.pending.interval, 10);
    result.state.pending.nextPollAt = 0;
    result = await finishConnection(result.state);
    assert.equal(result.waiting, false);
    assert.equal(result.state.pending, undefined);
    let cached;
    result.state.token.expiresAt = 0;
    assert.equal(
      await accessToken(result.state, async (value) => {
        cached = value;
      }),
      "second-access",
    );
    assert.equal(cached.token.refresh, "second-refresh");
    assert.equal(calls.at(-1).init.body.get("grant_type"), "refresh_token");
    assert.ok(
      calls.every(({ url }) => new URL(url).origin === "https://login.microsoftonline.com"),
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});
test("Graph conflicts and rate limits never trigger an automatic write retry", async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return new Response(null, { status: 412 });
    };
    await assert.rejects(
      graphRequest({
        token: "fixture",
        method: "PATCH",
        url: graphUrl("me/messages/fixture"),
        etag: "old",
      }),
      /changed/,
    );
    assert.equal(calls, 1);
    globalThis.fetch = async () => {
      calls++;
      return new Response(null, { status: 429, headers: { "retry-after": "12" } });
    };
    await assert.rejects(
      graphRequest({ token: "fixture", method: "POST", url: graphUrl("me/sendMail") }),
      /12/,
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
