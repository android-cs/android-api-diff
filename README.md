# android-api-diff

**<https://diff.songe.li>**

An online tool to show Android Java/AIDL files api changes between different android inner versions

## Packages

- `packages/api-parser` (`@android-cs/api-parser`): parses Android Java/AIDL source into API structs.
- `packages/api-query` (`@android-cs/api-query`): platform-neutral API resolver and cross-version query core.
- `packages/api-diff-mcp` (`@android-cs/api-diff-mcp`): stdio MCP v2 server for AI clients.
- `web` (`@android-cs/web`): Vue UI for browser usage.

## MCP

Run the local MCP server with:

```sh
pnpm -F @android-cs/api-diff-mcp start
```

Useful environment variables:

- `ANDROID_API_DIFF_CACHE_DIR`: override the Node file cache directory.

Tools:

- `generate_android_api_code`: generate a Java hidden-API skeleton from cross-version signature ranges.
- `resolve_android_api`: resolve an API name to file, target path, and target kind.
- `query_android_api`: query compact cross-version signature ranges and source coordinates.
- `warm_android_api_cache`: preload results for a list of API names.

![img](https://e.gkd.li/b191a715-9014-4f43-b566-1104f6a1b1f0)

![img](https://e.gkd.li/f9796b1c-f372-481c-ac61-8af570e23abd)
