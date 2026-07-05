# mcp-flowise

MCP server that exposes the **chatflows of your local Flowise** as tools for Claude, Cursor, free-code, or any MCP client.

[![PyPI](https://img.shields.io/pypi/v/mcp-flowise)](https://pypi.org/project/mcp-flowise/)
[![npm](https://img.shields.io/npm/v/@suamkf08/mcp-flowise)](https://www.npmjs.com/package/@suamkf08/mcp-flowise)

## Tools

**Simple mode (default):**
- `list_chatflows()` — lists available chatflows (`id` + `name`).
- `create_prediction(chatflow_id, question)` — runs a chatflow and returns its response.

**Dynamic mode (`FLOWISE_DYNAMIC=true`):**
- Registers one tool per chatflow at startup, e.g. `flowise_support_bot(question)`.

## Requirements

- A running [Flowise](https://flowiseai.com/) instance (default `http://localhost:3000`)
- Node.js 18+ **or** Python 3.10+ with [uv](https://docs.astral.sh/uv/)

---

## Installation

### One-command install (any client)

```bash
npx -y -p @suamkf08/mcp-flowise mcp-flowise-install --client claude
npx -y -p @suamkf08/mcp-flowise mcp-flowise-install --client cursor
npx -y -p @suamkf08/mcp-flowise mcp-flowise-install --client free-code
npx -y -p @suamkf08/mcp-flowise mcp-flowise-install --client vscode
npx -y -p @suamkf08/mcp-flowise mcp-flowise-install --client windsurf
```

`-p @suamkf08/mcp-flowise` pulls the published package that ships the
`mcp-flowise-install` binary; `npx` then runs that binary. (There is no separate
`@suamkf08/mcp-flowise-install` package on npm — the installer lives inside
`@suamkf08/mcp-flowise`.)

The script asks for your `FLOWISE_API_ENDPOINT` and `FLOWISE_API_KEY`, writes the config automatically, and tells you where it was saved. Restart your client after running it.

---

### Manual install

#### Claude Desktop

Add this to your `claude_desktop_config.json`
(`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS,
`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

**Option A — via npm (Node.js required):**
```json
{
  "mcpServers": {
    "mcp-flowise": {
      "command": "npx",
      "args": ["-y", "@suamkf08/mcp-flowise"],
      "env": {
        "FLOWISE_API_ENDPOINT": "http://localhost:3000",
        "FLOWISE_API_KEY": ""
      }
    }
  }
}
```

**Option B — via uvx (uv required):**

Install uv first if you don't have it:
```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Then add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "mcp-flowise": {
      "command": "uvx",
      "args": ["mcp-flowise"],
      "env": {
        "FLOWISE_API_ENDPOINT": "http://localhost:3000",
        "FLOWISE_API_KEY": ""
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project (or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "mcp-flowise": {
      "command": "npx",
      "args": ["-y", "@suamkf08/mcp-flowise"],
      "env": {
        "FLOWISE_API_ENDPOINT": "http://localhost:3000",
        "FLOWISE_API_KEY": ""
      }
    }
  }
}
```

### free-code

Add to `~/.free-code/agent/mcp.json` (or import with `/mcp-import`):

```json
{
  "mcpServers": {
    "mcp-flowise": {
      "command": "npx",
      "args": ["-y", "@suamkf08/mcp-flowise"],
      "env": {
        "FLOWISE_API_ENDPOINT": "http://localhost:3000",
        "FLOWISE_API_KEY": ""
      }
    }
  }
}
```

Then enable it in free-code:
```
/mcp enable mcp-flowise
/reload
```

---

## Configuration

| Environment variable | Default | Description |
|---|---|---|
| `FLOWISE_API_ENDPOINT` | `http://localhost:3000` | Base URL of your Flowise instance |
| `FLOWISE_API_KEY` | _(empty)_ | Bearer token (Flowise → Settings → API Keys) |
| `FLOWISE_DYNAMIC` | `false` | Set to `true` to register one tool per chatflow |
| `FLOWISE_WHITELIST_ID` | _(empty)_ | Comma-separated chatflow IDs to include |
| `FLOWISE_BLACKLIST_ID` | _(empty)_ | Comma-separated chatflow IDs to exclude |
| `FLOWISE_WHITELIST_NAME_REGEX` | _(empty)_ | Only include chatflows whose name matches |
| `FLOWISE_BLACKLIST_NAME_REGEX` | _(empty)_ | Exclude chatflows whose name matches |

---

## Development

```bash
git clone https://github.com/suamkf08/mcp-flowise
cd mcp-flowise
uv run mcp-flowise        # starts over stdio; Ctrl+C to quit
```

Inspect with MCP Inspector:
```bash
uv run mcp dev mcp_flowise/server.py
```

## Flowise API reference

- List chatflows: `GET {endpoint}/api/v1/chatflows`
- Run chatflow: `POST {endpoint}/api/v1/prediction/{chatflowId}` with `{"question": "..."}`
- Auth header: `Authorization: Bearer <FLOWISE_API_KEY>`
