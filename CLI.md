# android-api-diff CLI

[`android-api-diff`](https://www.npmjs.com/package/android-api-diff) lets
developers and AI agents inspect Android framework Java/AIDL APIs across
platform versions and generate Java hidden-API code without a continuously
running MCP server. It requires Node.js 26.5.0 or newer.

The CLI downloads Android tag metadata and Java/AIDL source files on demand,
then keeps query data in a local content-addressed SQLite cache.

## Install and upgrade

Install or upgrade the CLI and install the matching Codex Skill globally with
one command:

```sh
npx android-api-diff@latest install
```

The installer delegates CLI version detection and upgrades to npm. It installs
the Skill from the Git tag matching the published CLI version, so their
instructions stay in sync.

To install only the CLI, use pnpm:

```sh
pnpm add -g android-api-diff@latest
```

The same command upgrades an existing installation. npm users can run:

```sh
npm install -g android-api-diff@latest
```

The CLI does not implement its own version check.

## Use the commands

```sh
android-api-diff resolve "ContentObserver()"
android-api-diff query "IActivityManager.getTasks" --min-sdk 28
android-api-diff generate "ActivityThread.currentApplication" --min-sdk 28
android-api-diff preload "ContentObserver()" "IActivityManager.getTasks" --min-sdk 28
```

| Command    | Use it for                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------- |
| `resolve`  | Resolve an API name to its source file and target kind without fetching historical versions. |
| `query`    | Inspect exact signatures, tag ranges, missing reasons, and source metadata across versions.  |
| `generate` | Generate Java hidden-API code. This command performs the cross-version query itself.         |
| `preload`  | Preload query results for one or more APIs before a larger task.                             |

Use `ClassName()` to inspect all constructors of a class, for example
`ContentObserver()`. The existing `ClassName#ClassName` form is also accepted.
For an ambiguous nested all-uppercase class name, use the explicit form, such
as `Outer.URL#URL`.

`--format json` is the default and is intended for scripts and AI agents. It
writes one success object to stdout:

```json
{
  "ok": true,
  "command": "query",
  "result": {}
}
```

Use `--format pretty` for a more readable terminal representation. Errors are
written as structured JSON to stderr and return a nonzero exit code. Progress
is shown on stderr only when it is attached to a terminal, so piped JSON stays
clean.

Range endpoints describe the first or last Android tag checked in the current
query snapshot. `last-checked` does not mean that the tag is permanently final.

## Advanced installation

### Keep the Skill in one Codex project

The one-command installer above installs the Skill globally. To keep the Skill
local to only the current project instead, install it directly from the
repository:

```sh
npx --yes skills add https://github.com/android-cs/android-api-diff/tree/main/skills/android-api-diff --agent codex --yes
```

### Retry a failed Skill installation

If `android-api-diff install` reports that the CLI succeeded but the Skill
failed, run the exact retry command from its structured error message. That
command keeps the Skill pinned to the same release as the installed CLI.

The Skill routes natural-language requests to the narrowest CLI command. In
particular, code-generation requests call `generate` directly instead of
running a redundant `query` first.

Example requests:

- `Inspect how IActivityManager.getTasks changes from minSdk 28.`
- `Inspect all ContentObserver() constructor overloads.`
- `Generate Java code for ActivityThread.currentApplication with minSdk 28.`
- `Resolve android.app.IActivityManager to its frameworks/base source file.`

## Migrate from the MCP server

Remove the old Codex registration:

```sh
codex mcp remove android-api-diff
```

Then run `npx android-api-diff@latest install`. For another AI client, remove
the `android-api-diff` entry from its `mcpServers` configuration before
restarting it.

The old `@android-cs/api-diff-mcp` package remains as a registry history
artifact, but the release workflow no longer publishes it. New integrations
should use `android-api-diff` plus the project-local Skill.

## Cache and local development

Set `ANDROID_API_DIFF_CACHE_DIR` to override the Node.js cache directory. Cache
values are stored as Brotli-compressed BLOBs. Custom cache roots are never
recursively migrated or deleted automatically.

To run the CLI from this repository:

```sh
pnpm install
pnpm -F android-api-diff start query "IActivityManager.getTasks" --min-sdk 28
```
