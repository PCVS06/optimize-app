import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const mark = await fs.readFile("branding/optimize-mark.svg", "utf8");
const symbol = mark.replace(/<svg[^>]*>/, "").replace("</svg>", "");
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect x="32" y="32" width="960" height="960" rx="220" fill="#2B2B2B"/><svg x="185" y="185" width="654" height="654" viewBox="20 65 175 175" fill="#F72626">${symbol}</svg></svg>`;

async function png(destination, size, svg = icon) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(destination);
}

await png("packages/desktop/assets/icon.png", 1024);
await png("packages/desktop/assets/icon-dev.png", 1024);
for (const name of ["icon", "splash-icon", "android-icon-foreground", "notification-icon"]) {
  await png(`packages/app/assets/images/${name}.png`, 1024, name === "icon" ? icon : mark);
}
await png("packages/app/assets/images/favicon.png", 64);
await png("packages/app/public/apple-touch-icon.png", 180);
await png("packages/app/public/pwa-icon-192.png", 192);
await png("packages/app/public/pwa-icon-512.png", 512);
for (const appearance of ["light", "dark"]) {
  for (const state of ["", "-running", "-attention"]) {
    const dotColor = state === "-running" ? "#268AE0" : "#F59E0B";
    const badge = state
      ? `<circle cx="850" cy="174" r="125" fill="${dotColor}" stroke="#2B2B2B" stroke-width="36"/>`
      : "";
    const svg = icon.replace(/<\/svg>$/, `${badge}</svg>`);
    const destination = `packages/app/assets/images/favicon-${appearance}${state}`;
    await fs.writeFile(`${destination}.svg`, svg);
    await png(`${destination}.png`, 64, svg);
  }
}
// PNG-compressed ICO keeps the Windows icon reproducible without a platform toolchain.
const icoPng = await sharp(Buffer.from(icon)).resize(256, 256).png().toBuffer();
const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(1, 4);
icoHeader.writeUInt16LE(1, 10);
icoHeader.writeUInt16LE(32, 12);
icoHeader.writeUInt32LE(icoPng.length, 14);
icoHeader.writeUInt32LE(22, 18);
await fs.writeFile("packages/desktop/assets/icon.ico", Buffer.concat([icoHeader, icoPng]));

if (process.platform === "darwin") {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "optimize-icon-"));
  const iconset = path.join(temporary, "Optimize.iconset");
  await fs.mkdir(iconset);
  try {
    for (const size of [16, 32, 128, 256, 512]) {
      await png(path.join(iconset, `icon_${size}x${size}.png`), size);
      await png(path.join(iconset, `icon_${size}x${size}@2x.png`), size * 2);
    }
    execFileSync("iconutil", ["-c", "icns", iconset, "-o", "packages/desktop/assets/icon.icns"]);
  } finally {
    await fs.rm(temporary, { recursive: true });
  }
}
