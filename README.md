# mcp-flowise

MCP server that exposes the **chatflows of your local Flowise** as tools for
free-code (or any MCP client). Standalone and minimalist.

## Tools

**Simple mode (default):**
- `list_chatflows()` — lists the chatflows (`id` + `name`).
- `create_prediction(chatflow_id, question)` — runs a chatflow.

**Dynamic mode (`FLOWISE_DYNAMIC=true`):**
- Registers one tool per chatflow at startup, e.g. `flowise_support_bot(question)`.

## Requirements

- Python 3.10+
- [`uv`](https://docs.astral.sh/uv/) (recommended) or `pip`
- A running Flowise instance (default `http://localhost:3000`)

## Configuration

Copy `.env.example` to `.env` and fill in at least `FLOWISE_API_ENDPOINT` and,
if your Flowise has auth enabled, `FLOWISE_API_KEY` (Flowise → Settings → API Keys).

## Run it manually (for testing)

```bash
cd mcp-flowise
uv run mcp-flowise        # starts over stdio; Ctrl+C to quit
# or, without uv:
pip install -e . && mcp-flowise
```

To inspect it with the MCP Inspector:

```bash
uv run mcp dev mcp_flowise/server.py
```

## Connect it to free-code

Add the server to `~/.free-code/agent/mcp.json` (or import it with `/mcp-import`):

```json
{
  "mcpServers": {
    "flowise": {
      "command": "uvx",
      "args": ["--from", "/absolute/path/to/repo/mcp-flowise", "mcp-flowise"],
      "env": {
        "FLOWISE_API_ENDPOINT": "http://localhost:3000",
        "FLOWISE_API_KEY": ""
      }
    }
  }
}
```

Then in free-code:

```
/mcp enable flowise
/reload
```

New servers start disabled, which is why you need `/mcp enable` and `/reload`
(or a new session) for the tools to show up.

## Notes on the Flowise API

- List: `GET {endpoint}/api/v1/chatflows`
- Predict: `POST {endpoint}/api/v1/prediction/{chatflowId}` with `{"question": "..."}`
- Auth: `Authorization: Bearer <FLOWISE_API_KEY>` header (if enabled).
