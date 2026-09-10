import { DEFAULT_TERMINAL_PROFILES } from "@getpaseo/protocol/terminal-profiles";
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveConfigFromPersisted } from "./config.js";
import { OPTIMIZE_SYSTEM_PROMPT } from "./optimize-system-prompt.js";

const directories: string[] = [];
function createHome(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), "optimize-config-"));
  directories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe("Optimize defaults", () => {
  test("uses its own loopback port and company prompt", () => {
    const config = resolveConfigFromPersisted(createHome(), {}, { env: {} });
    expect(config.listen).toBe("127.0.0.1:6771");
    expect(config.appendSystemPrompt).toBe(OPTIMIZE_SYSTEM_PROMPT);
    expect(DEFAULT_TERMINAL_PROFILES.map((profile) => profile.id)).toEqual(["pi"]);
  });

  test("updates the original company identity while preserving employee edits", () => {
    const initialPrompt = readFileSync(
      new URL("./test-fixtures/initial-optimize-system-prompt.txt", import.meta.url),
      "utf8",
    ).trim();
    const config = resolveConfigFromPersisted(
      createHome(),
      { daemon: { appendSystemPrompt: initialPrompt } },
      { env: {} },
    );
    expect(config.appendSystemPrompt).toBe(OPTIMIZE_SYSTEM_PROMPT);
    const customPrompt = initialPrompt + "\nUse our support playbook.";
    const customized = resolveConfigFromPersisted(
      createHome(),
      { daemon: { appendSystemPrompt: customPrompt } },
      { env: {} },
    );
    expect(customized.appendSystemPrompt).toBe(customPrompt);
  });

  test("honors the employee's configured endpoint and system prompt", () => {
    const config = resolveConfigFromPersisted(
      createHome(),
      { daemon: { listen: "127.0.0.1:17891", appendSystemPrompt: "Use the support playbook." } },
      { env: {} },
    );
    expect(config.listen).toBe("127.0.0.1:17891");
    expect(config.appendSystemPrompt).toBe("Use the support playbook.");
  });
});
