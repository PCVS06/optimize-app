import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const contents = path.join(root, "pi-runtime/native/Optimize Automation.app/Contents");
mkdirSync(path.join(contents, "MacOS"), { recursive: true });
writeFileSync(
  path.join(contents, "Info.plist"),
  `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>bike.optimize.automation</string><key>CFBundleName</key><string>Optimize Automation</string><key>CFBundleExecutable</key><string>Optimize Automation</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>LSUIElement</key><true/><key>NSScreenCaptureUsageDescription</key><string>Optimize uses your screen only when you enable computer use in a conversation.</string></dict></plist>`,
);
const arch = process.env.OPTIMIZE_BUILD_ARCH ?? process.arch;
execFileSync(
  "/usr/bin/xcrun",
  [
    "swiftc",
    "-O",
    "-target",
    `${arch}-apple-macosx13.0`,
    path.join(root, "native/optimize-automation.swift"),
    "-o",
    path.join(contents, "MacOS/Optimize Automation"),
  ],
  { stdio: "inherit" },
);
