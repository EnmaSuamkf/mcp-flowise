#!/usr/bin/env node
/**
 * mcp-flowise-install
 * Installs mcp-flowise into the MCP config of the specified client.
 *
 * Usage (the installer ships as the `mcp-flowise-install` bin inside the
 * `@suamkf08/mcp-flowise` package — there is no separate install package):
 *   npx -y -p @suamkf08/mcp-flowise mcp-flowise-install --client claude
 *   npx -y -p @suamkf08/mcp-flowise mcp-flowise-install --client cursor
 *   npx -y -p @suamkf08/mcp-flowise mcp-flowise-install --client free-code
 *   npx -y -p @suamkf08/mcp-flowise mcp-flowise-install --client vscode
 *   npx -y -p @suamkf08/mcp-flowise mcp-flowise-install --client windsurf
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

// Claude Code (the CLI) keeps its own user-scoped config separate from the
// Claude Desktop app config above. Installing for "claude" targets the
// desktop app only, so we mirror the same server into the CLI's user config
// (`claude mcp add -s user`) to make it available across all projects.
const CLAUDE_CODE_USER_CONFIG = path.join(HOME, ".claude.json");

function getConfigPath(client) {
  const paths = CONFIG_PATHS[client];
  if (!paths) return null;
  return paths[PLATFORM] || paths["linux"];
}

// Prompting that works in both interactive (TTY) and non-interactive (piped/
// redirected) stdin. rl.question() on non-TTY input hangs or silently drops
// pending questions when stdin hits EOF, so the script can exit without
// writing the config. When stdin is not a TTY we pre-read it once and consume
// one line per question; in a TTY we reuse a single readline interface.
let rl = null;
let stdinLines = null;

async function readStdinLines() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text.split(/\r?\n/);
}

async function ask(question) {
  if (!process.stdin.isTTY) {
    if (stdinLines === null) stdinLines = await readStdinLines();
    const ans = stdinLines.shift() ?? "";
    process.stdout.write(question + ans + "\n");
    return ans.trim();
  }
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  return new Promise((resolve) => rl.question(question, (ans) => resolve(ans.trim())));
}

function closePrompt() {
  if (rl) { rl.close(); rl = null; }
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

function installIntoClaudeCodeUserConfig(endpoint, apiKey) {
  const config = readConfig(CLAUDE_CODE_USER_CONFIG);
  if (!config.mcpServers) config.mcpServers = {};

  config.mcpServers["mcp-flowise"] = {
    type: "stdio",
    command: "npx",
    args: ["-y", "@suamkf08/mcp-flowise"],
    env: {
      FLOWISE_API_ENDPOINT: endpoint,
      ...(apiKey ? { FLOWISE_API_KEY: apiKey } : {}),
    },
  };

  writeConfig(CLAUDE_CODE_USER_CONFIG, config);
  console.log(`\n✓ mcp-flowise also installed into Claude Code (CLI) user config at:`);
  console.log(`  ${CLAUDE_CODE_USER_CONFIG}`);
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
      closePrompt();
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

  if (client === "claude") {
    installIntoClaudeCodeUserConfig(endpoint, apiKey);
  }

  closePrompt();

  console.log(`\n✓ mcp-flowise installed into ${client} config at:`);
  console.log(`  ${configPath}`);
  console.log("\nRestart your client to pick up the changes.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
