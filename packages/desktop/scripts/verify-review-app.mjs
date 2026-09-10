import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const appPath = path.resolve(process.argv[2] ?? "packages/desktop/release/mac-arm64/Optimize.app");
const frameworksPath = path.join(appPath, "Contents/Frameworks");
const bundles = [
  appPath,
  ...readdirSync(frameworksPath)
    .filter((name) => name.endsWith(".app"))
    .map((name) => path.join(frameworksPath, name)),
];

for (const bundle of bundles) {
  const result = spawnSync("codesign", ["--display", "--verbose=4", bundle], {
    encoding: "utf8",
    timeout: 15_000,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  // Ad-hoc hardened apps fail library validation on newer macOS versions.
  assert.ok(
    !(/Signature=adhoc/.test(result.stderr) && /flags=.*\bruntime\b/.test(result.stderr)),
    `${bundle} combines ad-hoc signing and hardened runtime; rebuild the review app with hardenedRuntime=false.`,
  );
}

execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], { stdio: "inherit" });
const version = execFileSync(path.join(appPath, "Contents/MacOS/Optimize"), ["--version"], {
  encoding: "utf8",
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  timeout: 15_000,
}).trim();
assert.match(version, /^v\d+\.\d+\.\d+$/);
console.log(`Review app native launch verified (${version}).`);
