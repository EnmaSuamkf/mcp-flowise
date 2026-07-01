#!/usr/bin/env node
/**
 * mcp-flowise-install
 * Installs mcp-flowise into the MCP config of the specified client.
 *
 * Usage:
 *   npx @suamkf08/mcp-flowise-install --client claude
 *   npx @suamkf08/mcp-flowise-install --client cursor
 *   npx @suamkf08/mcp-flowise-install --client free-code
 *   npx @suamkf08/mcp-flowise-install --client vscode
 *   npx @suamkf08/mcp-flowise-install --client windsurf
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");

const HOME = os.homedir();
const PLATFORM = process.platform;

const CONFIG_PATHS = {
  claude: {
    darwin: path.join(HOME, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
    win32: path.join(process.env.APPDATA || "", "Claude", "claude_desktop_config.json"),
    linux: path.join(HOME, ".config", "Claude", "claude_desktop_config.json"),
  },
  cursor: {
    darwin: path.join(HOME, ".cursor", "mcp.json"),
    win32: path.join(HOME, ".cursor", "mcp.json"),
    linux: path.join(HOME, ".cursor", "mcp.json"),
  },
  "free-code": {
    darwin: path.join(HOME, ".free-code", "agent", "mcp.json"),
    win32: path.join(HOME, ".free-code", "agent", "mcp.json"),
    linux: path.join(HOME, ".free-code", "agent", "mcp.json"),
  },
  vscode: {
    darwin: path.join(HOME, "Library", "Application Support", "Code", "User", "mcp.json"),
    win32: path.join(process.env.APPDATA || "", "Code", "User", "mcp.json"),
    linux: path.join(HOME, ".config", "Code", "User", "mcp.json"),
  },
  windsurf: {
    darwin: path.join(HOME, ".codeium", "windsurf", "mcp_config.json"),
    win32: path.join(HOME, ".codeium", "windsurf", "mcp_config.json"),
    linux: path.join(HOME, ".codeium", "windsurf", "mcp_config.json"),
  },
};

const SUPPORTED_CLIENTS = Object.keys(CONFIG_PATHS);

function getConfigPath(client) {
  const paths = CONFIG_PATHS[client];
  if (!paths) return null;
  return paths[PLATFORM] || paths["linux"];
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

function readConfig(configPath) {
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    console.error(`Warning: could not parse ${configPath}, will overwrite.`);
    return {};
  }
}

function writeConfig(configPath, data) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function main() {
  const args = process.argv.slice(2);
  const clientIdx = args.indexOf("--client");
  let client = clientIdx !== -1 ? args[clientIdx + 1] : null;

  if (!client) {
    console.log("Available clients: " + SUPPORTED_CLIENTS.join(", "));
    client = await ask("Which client do you want to install mcp-flowise into? ");
  }

  client = client.toLowerCase();

  if (!SUPPORTED_CLIENTS.includes(client)) {
    console.error(`Unknown client: ${client}`);
    console.error("Supported clients: " + SUPPORTED_CLIENTS.join(", "));
    process.exit(1);
  }

  const configPath = getConfigPath(client);
  console.log(`\nConfig file: ${configPath}`);

  // Ask for Flowise config
  const endpoint = await ask("Flowise API endpoint [http://localhost:3000]: ") || "http://localhost:3000";
  const apiKey = await ask("Flowise API key (leave empty if auth disabled): ");

  const config = readConfig(configPath);

  if (!config.mcpServers) config.mcpServers = {};

  if (config.mcpServers["mcp-flowise"]) {
    const overwrite = await ask("mcp-flowise is already in the config. Overwrite? [y/N]: ");
    if (!overwrite.toLowerCase().startsWith("y")) {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  config.mcpServers["mcp-flowise"] = {
    command: "npx",
    args: ["-y", "@suamkf08/mcp-flowise"],
    env: {
      FLOWISE_API_ENDPOINT: endpoint,
      ...(apiKey ? { FLOWISE_API_KEY: apiKey } : {}),
    },
  };

  writeConfig(configPath, config);

  console.log(`\n✓ mcp-flowise installed into ${client} config at:`);
  console.log(`  ${configPath}`);
  console.log("\nRestart your client to pick up the changes.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
