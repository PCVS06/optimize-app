import { registerMcp } from "./mcp.mjs";
import { registerComputer } from "./computer.mjs";
import { registerMicrosoft } from "./microsoft.mjs";
export default function optimize(pi) {
  registerMcp(pi);
  registerComputer(pi);
  registerMicrosoft(pi);
}
