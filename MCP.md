# android-api-diff MCP

[`@android-cs/api-diff-mcp`](https://www.npmjs.com/package/@android-cs/api-diff-mcp) lets an MCP-compatible AI client inspect Android framework Java/AIDL APIs across platform versions and generate Java code for hidden APIs. It runs locally over stdio and requires Node.js 24 or newer.

The server combines Android tag metadata from Google Source and GitHub, then downloads Java/AIDL source files only from GitHub. Long-running query, code-generation, and cache-warming calls report incremental progress when the MCP client supplies a progress token.

## Connect an MCP client

Codex users can add the published server from the command line:

```sh
codex mcp add android-api-diff -- npx -y @android-cs/api-diff-mcp@latest
```

Run `codex mcp list` or enter `/mcp` in Codex to confirm that the server is connected.

For clients that use an `mcpServers` JSON file, add:

```json
{
  "mcpServers": {
    "android-api-diff": {
      "command": "npx",
      "args": ["-y", "@android-cs/api-diff-mcp@latest"]
    }
  }
}
```

Restart the client after changing its MCP configuration.

## Use the tools

Ask the AI client in natural language. It will select the matching MCP tool. For example:

- `Inspect how IActivityManager.getTasks changes from minSdk 28.`
- `Generate Java code for ActivityThread.currentApplication with minSdk 28.`
- `Resolve android.app.IActivityManager to its frameworks/base source file.`

| Tool                        | Use it for                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| `generate_android_api_code` | Generate Java code for a hidden Android member API. It performs the cross-version query itself.     |
| `query_android_api`         | Inspect exact signatures, tag ranges, missing reasons, and source metadata across Android versions. |
| `resolve_android_api`       | Resolve an API name to its source file, target path, and target kind without fetching version data. |
| `warm_android_api_cache`    | Preload query results when you know which APIs you will inspect next.                               |

## Run from this repository

For local development, install the workspace dependencies and use the repository server instead of the npm package:

```sh
pnpm install
pnpm -F @android-cs/api-diff-mcp start
```

Set `ANDROID_API_DIFF_CACHE_DIR` to override the Node.js file cache directory.
