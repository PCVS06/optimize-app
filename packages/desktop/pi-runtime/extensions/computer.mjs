import { Type } from "typebox";
import { native, textResult } from "./native.mjs";
export function registerComputer(pi) {
  let enabled = false;
  let observedApp = null;
  pi.registerCommand("computer", {
    description: "Enable or stop Mac computer use for this conversation",
    handler: async (args, ctx) => {
      if (args.trim() === "off") {
        enabled = false;
        observedApp = null;
        ctx.ui.notify("Computer use stopped.", "info");
        return;
      }
      enabled = await ctx.ui.confirm(
        "Computer use",
        "Allow this conversation to see your main display and operate Mac apps? You can stop with /computer off. macOS also requires Screen Recording and Accessibility for Optimize Automation.",
      );
      if (enabled)
        ctx.ui.notify(
          JSON.stringify(await native({ action: "permissions", prompt: true })),
          "info",
        );
    },
  });
  pi.registerTool({
    name: "optimize_computer",
    label: "Use Mac apps",
    description:
      "Observe or operate the main Mac display. Read the optimize-computer skill first. Requires explicit session consent and macOS permissions. Observe before actions; coordinates are logical display points from the latest observation. Actions return a fresh screenshot. Use stop to revoke this conversation's access.",
    parameters: Type.Object({
      action: Type.Union(
        ["status", "observe", "open", "click", "type", "key", "scroll", "stop"].map((value) =>
          Type.Literal(value),
        ),
      ),
      x: Type.Optional(Type.Number()),
      y: Type.Optional(Type.Number()),
      text: Type.Optional(Type.String({ maxLength: 20000 })),
      key: Type.Optional(Type.String()),
      modifiers: Type.Optional(Type.Array(Type.String())),
      button: Type.Optional(Type.Union([Type.Literal("left"), Type.Literal("right")])),
      clicks: Type.Optional(Type.Integer({ minimum: 1, maximum: 2 })),
      delta: Type.Optional(Type.Integer({ minimum: -2000, maximum: 2000 })),
      bundleId: Type.Optional(Type.String()),
    }),
    async execute(_id, params, signal, _update, ctx) {
      if (params.action === "stop") {
        enabled = false;
        observedApp = null;
        return textResult("Computer use stopped.");
      }
      if (params.action === "status")
        return textResult({ enabled, ...(await native({ action: "permissions" }, signal)) });
      if (!enabled) {
        enabled = await ctx.ui.confirm(
          "Allow computer use?",
          "Optimize will see your main display and control Mac apps for this conversation. Stop at any time with /computer off.",
        );
        if (!enabled) throw new Error("Computer use was declined.");
        await native({ action: "permissions", prompt: true }, signal);
      }
      const changesApp = params.action !== "observe" && params.action !== "open";
      if (changesApp && !observedApp)
        throw new Error("Observe the display before operating an app.");
      const result = await native(
        { ...params, expectedApp: changesApp ? observedApp : undefined },
        signal,
      );
      observedApp = result.bundleId ?? null;
      const { image, ...state } = result;
      const content = [{ type: "text", text: JSON.stringify(state) }];
      if (image) content.push({ type: "image", data: image, mimeType: "image/png" });
      return { content, details: {} };
    },
  });
}
