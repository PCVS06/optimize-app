import { describe, expect, it } from "vitest";
import { getBuiltInLaunchOrder } from "./catalog";
describe("company tab catalog", () => {
  it("offers conversations and browsing without developer tools", () => {
    expect(getBuiltInLaunchOrder("primary")).toEqual(["agent", "browser"]);
    expect(getBuiltInLaunchOrder("supporting")).toEqual(["browser", "agent"]);
  });
});
