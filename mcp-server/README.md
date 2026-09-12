# @webobsidian/mcp-server

An [MCP](https://modelcontextprotocol.io) server that wraps WebObsidian's [Agent API](../docs/AGENT_API.md)
(`/api/v1`) so any MCP host (Claude Desktop, Claude Code, etc.) can read/write/search a vault as
tools, without a custom "agent skill" or hand-written REST calls.

It's a thin client: no new server endpoints, no new settings — just a stdio process that forwards
tool calls to a WebObsidian instance you already have running.

## Setup

1. Start WebObsidian (locally or self-hosted) and create an API key in **Settings → API Keys**
   with the scopes you need (`read` / `write` / `search`).
2. Build this workspace: `npm run build` (from the repo root, or `npm --workspace mcp-server run build`).
3. Add it to your MCP host, pointing at the built entrypoint (`mcp-server/dist/index.js`) with the
   two required environment variables:

```jsonc
// e.g. Claude Desktop's claude_desktop_config.json / Claude Code's mcpServers config
{
  "mcpServers": {
    "webobsidian": {
      "command": "node",
      "args": ["/absolute/path/to/webobsidian/mcp-server/dist/index.js"],
      "env": {
        "WEBOBSIDIAN_BASE_URL": "http://localhost:8787",
        "WEBOBSIDIAN_API_KEY": "wok_your_key_here"
      }
    }
  }
}
```

Or with the Claude Code CLI:

```bash
claude mcp add webobsidian \
  --env WEBOBSIDIAN_BASE_URL=http://localhost:8787 \
  --env WEBOBSIDIAN_API_KEY=wok_your_key_here \
  -- node /absolute/path/to/webobsidian/mcp-server/dist/index.js
```

| Env var | Default | Required |
|---|---|---|
| `WEBOBSIDIAN_BASE_URL` | `http://localhost:8787` | no |
| `WEBOBSIDIAN_API_KEY` | – | **yes** |

## Tools

| Tool | Agent API endpoint | Scope needed |
|---|---|---|
| `list_notes` | `GET /api/v1/notes` | read |
| `read_note` | `GET /api/v1/notes/{path}` | read |
| `write_note` | `PUT /api/v1/notes/{path}` | write |
| `append_note` | `PATCH /api/v1/notes/{path}` | write |
| `delete_note` | `DELETE /api/v1/notes/{path}` | write |
| `search_notes` | `GET /api/v1/search` | search |
| `get_backlinks` | `GET /api/v1/backlinks` | read |
| `list_tags` | `GET /api/v1/tags` | read |

API errors (bad/missing scope, note not found, rate limit) surface as MCP tool errors with the
original Agent API message — nothing is retried or swallowed.

## Dev

```bash
npm --workspace mcp-server run dev        # run with tsx, no build step
npm --workspace mcp-server run typecheck
npm --workspace mcp-server run build
```
