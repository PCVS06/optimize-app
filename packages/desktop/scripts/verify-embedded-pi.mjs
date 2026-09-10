import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const appPath = path.resolve(process.argv[2] ?? "packages/desktop/release/mac-arm64/Optimize.app");
const bin = path.join(appPath, "Contents/Resources/bin");
const runtime = path.join(appPath, "Contents/Resources/pi-runtime");
const expected = JSON.parse(readFileSync(path.join(runtime, "package.json"), "utf8")).dependencies;
const agentHome = mkdtempSync(path.join(tmpdir(), "optimize-embedded-pi-"));
// Only macOS system tools are on PATH. The app must provide Pi, Node and npm itself.
const env = {
  PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
  SHELL: "/bin/sh",
  PI_CODING_AGENT_DIR: agentHome,
};
try {
  const version = (name) =>
    execFileSync(path.join(bin, name), ["--version"], {
      env,
      encoding: "utf8",
      timeout: 20000,
    }).trim();
  assert.equal(version("pi"), expected["@earendil-works/pi-coding-agent"]);
  assert.match(version("node"), /^v24\./);
  assert.equal(version("npm"), expected.npm);
  await new Promise((resolve, reject) => {
    const child = spawn(
      path.join(bin, "pi"),
      ["--mode", "rpc", "--no-session", "--no-extensions", "--no-skills", "--no-context-files"],
      { env, stdio: ["pipe", "pipe", "pipe"] },
    );
    let buffer = "";
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill("SIGTERM");
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };
    const timeout = setTimeout(
      () => finish(new Error("Embedded Pi did not answer its state RPC")),
      30000,
    );
    child.on("error", finish);
    child.on("exit", (code) => {
      if (!settled) finish(new Error(`Embedded Pi exited before responding (${code})`));
    });
    child.stderr.resume();
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        let response;
        try {
          response = JSON.parse(line);
        } catch {
          continue;
        }
        if (response.id === "optimize-runtime-check") {
          if (
            response.type !== "response" ||
            response.success !== true ||
            response.command !== "get_state"
          )
            finish(new Error("Embedded Pi state RPC failed"));
          else finish();
        }
      }
    });
    child.stdin.write(JSON.stringify({ id: "optimize-runtime-check", type: "get_state" }) + "\n");
  });
  console.log("Embedded Pi, Node, npm and Pi RPC verified without an external runtime.");
} finally {
  rmSync(agentHome, { recursive: true, force: true });
}
