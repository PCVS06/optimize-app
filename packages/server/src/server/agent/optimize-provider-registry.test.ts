import { describe, expect, test } from "vitest";
import { createTestLogger } from "../../test-utils/test-logger.js";
import { buildProviderRegistry, createClientsFromRegistry } from "./provider-registry.js";

describe("Optimize Pi runtime", () => {
  test("discovers and creates only Pi in production", () => {
    const logger = createTestLogger();
    const registry = buildProviderRegistry(logger, { isDev: false });
    expect(Object.keys(registry)).toEqual(["pi"]);
    const clients = createClientsFromRegistry(registry, logger);
    expect(Object.keys(clients)).toEqual(["pi"]);
    expect(clients.pi.provider).toBe("pi");
  });

  test.each(["claude", "codex", "copilot", "opencode", "omp", "acp"])(
    "rejects a custom profile using the removed %s runtime",
    (provider) => {
      expect(() =>
        buildProviderRegistry(createTestLogger(), {
          isDev: false,
          providerOverrides: { custom: { extends: provider, command: ["unused-agent"] } },
        }),
      ).toThrow("Optimize supports only Pi");
    },
  );

  test("retains configurable Pi profiles and commands", () => {
    const registry = buildProviderRegistry(createTestLogger(), {
      isDev: false,
      providerOverrides: {
        "optimize-support": { extends: "pi", label: "Support", command: ["pi"] },
      },
    });
    expect(Object.keys(registry)).toEqual(["pi", "optimize-support"]);
    expect(registry["optimize-support"].derivedFromProviderId).toBe("pi");
    expect(registry["optimize-support"].label).toBe("Support");
  });
});
