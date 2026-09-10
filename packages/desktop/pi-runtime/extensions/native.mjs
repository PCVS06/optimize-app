import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const executable = fileURLToPath(
  new URL("../native/Optimize Automation.app/Contents/MacOS/Optimize Automation", import.meta.url),
);
export function native(input, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [], { stdio: ["pipe", "pipe", "pipe"], signal });
    let output = "";
    let errors = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.length > 32_000_000) child.kill();
    });
    child.stderr.on("data", (chunk) => {
      errors = (errors + chunk).slice(-2000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`Optimize Automation failed (${code}): ${errors}`));
      try {
        const result = JSON.parse(output);
        if (result.error) reject(new Error(result.error));
        else resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify(input));
  });
}
export function textResult(value) {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }],
    details: {},
  };
}
