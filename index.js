#!/usr/bin/env node
/**
 * Thin Node.js wrapper that launches mcp-flowise (Python) via uvx.
 * This lets Smithery CLI install it with:
 *   npx -y @smithery/cli install @pabloacastaneda86/mcp-flowise --client claude
 */

const { spawn } = require("child_process");

const env = {
  ...process.env,
  FLOWISE_API_ENDPOINT: process.env.FLOWISE_API_ENDPOINT || "http://localhost:3000",
  FLOWISE_API_KEY: process.env.FLOWISE_API_KEY || "",
  FLOWISE_DYNAMIC: process.env.FLOWISE_DYNAMIC || "false",
  FLOWISE_WHITELIST_ID: process.env.FLOWISE_WHITELIST_ID || "",
  FLOWISE_BLACKLIST_ID: process.env.FLOWISE_BLACKLIST_ID || "",
  FLOWISE_WHITELIST_NAME_REGEX: process.env.FLOWISE_WHITELIST_NAME_REGEX || "",
  FLOWISE_BLACKLIST_NAME_REGEX: process.env.FLOWISE_BLACKLIST_NAME_REGEX || "",
};

const child = spawn("uvx", ["mcp-flowise"], {
  stdio: "inherit",
  env,
});

child.on("error", (err) => {
  if (err.code === "ENOENT") {
    console.error(
      "[mcp-flowise] Error: 'uvx' not found.\n" +
      "Install uv first: https://docs.astral.sh/uv/getting-started/installation/\n" +
      "  macOS/Linux: curl -LsSf https://astral.sh/uv/install.sh | sh\n" +
      "  Windows:     powershell -c \"irm https://astral.sh/uv/install.ps1 | iex\""
    );
  } else {
    console.error("[mcp-flowise] Failed to start:", err.message);
  }
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
