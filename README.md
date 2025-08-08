# `waf-mcp-remote`

A drop-in wrapper around [`mcp-remote`](https://github.com/geelen/mcp-remote) that intercepts generic WAF blocking responses and converts them into valid MCP JSON-RPC SSE error events.  
It wraps the original [`mcp-remote`](https://github.com/geelen/mcp-remote) CLI under the hood and currently supports only [Streamable HTTP protocol](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http) (not HTTP+SSE).

> **Note:** This project is experimental—use it at your own risk.

## Why is this necessary?

When a Web Application Firewall (WAF) flags a request to your MCP streaming endpoint, it typically returns an HTML block page.  
That breaks any client expecting a continuous JSON-RPC SSE stream, causing errors or hangs.

`waf-mcp-remote`:

1. **Catches WAF responses:** Detects non-JSON HTML block pages.
2. **Suppresses the block page:** Terminates the HTML response.
3. **Emits a JSON-RPC error event:** Sends a clean SSE-compatible JSON-RPC error so your client and AI analytics can handle it gracefully.

Use it to test or adopt MCP streaming without disabling your WAF or confusing end users.

## Installation

```bash
npm install -g @f5devcentral/waf-mcp-remote
```

Or via `npx`:

```bash
npx @f5devcentral/waf-mcp-remote <server-url> [options]
```

## Environment Variables

You can set these environment variables to configure `waf-mcp-remote`:
- `WAF_STATUS_CODE`: Override the WAF block status code (default: `0`).
- `WAF_RESPONSE_PATTERN`: Regex pattern to match against WAF block page content (default: `\bYour support ID is:? ([\w-]+)\b`).
- `WAF_RESPONSE_PATTERN_FLAGS`: Regex flags for the WAF response pattern (default: ``).

## Usage

Replace calls to `mcp-remote` in your MCP client config with `waf-mcp-remote`. Example for a JSON config:

```json
{
  "mcpServers": {
    "protected-remote": {
      "command": "npx",
      "args": [
        "@f5devcentral/waf-mcp-remote",
        "https://remote.mcp.server/mcp"
      ],
      "env": {
        "WAF_STATUS_CODE": "403",
        "NODE_TLS_REJECT_UNAUTHORIZED": "0"
      }
    }
  }
}
```

## CLI Options

All flags from `mcp-remote` still apply. In addition, `waf-mcp-remote` supports:

- `--debug`         : Enable verbose logs (`~/.mcp-auth/{server_hash}_debug.log`).
- `--header`        : Add custom headers to each request (e.g. `--header "Authorization: Bearer $TOKEN"`).
- `--allow-http`    : Permit HTTP (non-HTTPS) endpoints in trusted networks.

> **Tip:** With `npx`, pass `-y` to auto-accept installations: `npx -y @f5devcentral/waf-mcp-remote <url>`.

## Transport Strategies

Control HTTP vs SSE order just like `mcp-remote`:

```bash
npx @f5devcentral/waf-mcp-remote https://example/stream --transport <mode>
```

- `http-only` (default)
- `http-first` (convert to http-only)
- `sse-first` (not supported)
- `sse-only` (not supported)

## OAuth Configuration

Use any standard `mcp-remote` OAuth flags:

- `--static-oauth-client-metadata`  : JSON string or `@`-file path
- `--static-oauth-client-info`      : via `MCP_REMOTE_CLIENT_ID`/`MCP_REMOTE_CLIENT_SECRET`
- `--host`                          : Override OAuth callback host
- Append a port after the URL to change redirect port

## Troubleshooting

- **Silent client**: Ensure you’re targeting an HTTP stream endpoint (not SSE).

- **Unexpected HTML**: Confirm your WAF’s block page isn’t non-standard.

- **State issues**: Clear auth state with:

  ```bash
  rm -rf ~/.mcp-auth
  ```

- **Node version**: Requires Node.js 18+.

## Contributing

Feel free to open issues or PRs in the [waf-mcp-remote repo](https://github.com/f5devcentral/waf-mcp-remote). Contributions welcome!

---

*Wraps **`mcp-remote`** - add WAF-aware streaming to your MCP clients in one command.*

