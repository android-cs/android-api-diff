# Changelog

## 0.0.3

- Store MCP responses in a content-addressed SQLite cache with Brotli compression, deduplication, reference tracking, and automatic repair.
- Migrate legacy cache entries safely while keeping custom cache roots isolated from recursive migration or deletion.
- Require Node.js 24.15 or newer for the MCP server.
