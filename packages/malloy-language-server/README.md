# @malloydata/malloy-language-server

A standalone Language Server Protocol (LSP) implementation for the Malloy language. This enables Malloy language support in any LSP-compatible editor including Claude Code, Neovim, Emacs, VS Code, and more.

## Installation

```bash
npm install -g @malloydata/malloy-language-server
```

## Usage

The language server communicates over stdio:

```bash
malloy-lsp --stdio
```

## Editor Configuration

### Claude Code

Create a `.lsp.json` file in your project root:

```json
{
  "malloy": {
    "command": "malloy-lsp",
    "args": ["--stdio"],
    "extensionToLanguage": {
      ".malloy": "malloy"
    }
  }
}
```

### Neovim (nvim-lspconfig)

```lua
require('lspconfig').malloy.setup{
  cmd = { "malloy-lsp", "--stdio" },
  filetypes = { "malloy" },
  root_dir = function(fname)
    return vim.fn.getcwd()
  end,
}
```

### Emacs (lsp-mode)

```elisp
(add-to-list 'lsp-language-id-configuration '(malloy-mode . "malloy"))
(lsp-register-client
  (make-lsp-client
    :new-connection (lsp-stdio-connection '("malloy-lsp" "--stdio"))
    :major-modes '(malloy-mode)
    :server-id 'malloy-lsp))
```

## Configuration

Create a `malloy-config.json` file in your workspace root to configure database connections.

### DuckDB (Local)

```json
{
  "connections": {
    "duckdb": {
      "databasePath": ":memory:",
      "workingDirectory": "."
    }
  }
}
```

| Option | Description | Default |
|--------|-------------|---------|
| `databasePath` | Path to DuckDB database file or `:memory:` | `:memory:` |
| `workingDirectory` | Working directory for relative paths | Workspace root |

### Publisher Connections (Credible)

For Credible-managed connections, use the `cred` CLI to export your connections:

```bash
# Login and set project
cred login myorg
cred set project myproject

# Export connections to malloy-config.json
cred export-connections
```

This generates a config file with Publisher connections:

```json
{
  "connections": {
    "my_bigquery": {
      "type": "publisher",
      "connectionUri": "https://myorg.data.ms2.co/api/v0/projects/myproj/connections/my_bigquery",
      "accessToken": "eyJ..."
    },
    "my_snowflake": {
      "type": "publisher",
      "connectionUri": "https://myorg.data.ms2.co/api/v0/projects/myproj/connections/my_snowflake",
      "accessToken": "eyJ..."
    }
  }
}
```

Publisher connections proxy schema lookups and queries through the Credible data plane, supporting BigQuery, Snowflake, Postgres, Trino, MySQL, and more.

When Publisher connections are configured, the first one becomes the default connection. DuckDB remains available as a fallback

## Features

- **Diagnostics**: Real-time syntax and semantic error reporting
- **Document Symbols**: Outline view of sources, queries, and fields
- **Completions**: Context-aware suggestions for keywords and properties
- **Hover**: Type information and documentation
- **Go to Definition**: Navigate to source, field, and import definitions

## License

MIT
