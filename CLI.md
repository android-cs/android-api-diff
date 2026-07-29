# android-api-diff CLI

[`android-api-diff`](https://www.npmjs.com/package/android-api-diff) lets
developers and AI agents inspect Android framework Java/AIDL APIs across
platform versions and generate Java hidden-API code without a continuously
running MCP server. It requires Node.js 26.5.0 or newer.

The CLI downloads Android tag metadata and Java/AIDL source files on demand,
then keeps query data in a local content-addressed SQLite cache.

## Install and upgrade

Install or upgrade the global CLI with pnpm:

```sh
pnpm add --global android-api-diff@latest
```

The same command upgrades an existing installation. npm users can run:

```sh
npm install --global android-api-diff@latest
```

Then, from the root of a project that needs Android API inspection, install the
matching Codex Skill:

```sh
android-api-diff skill install
```

The Skill comes from the Git tag matching the installed CLI version, so their
instructions stay in sync. Skill changes run through the exact `skills` CLI
version bundled with `android-api-diff`, so a target project's dependencies or
npm configuration cannot replace the Skill manager. The project root is the
nearest Git or Gradle root, and the successful JSON result reports the resolved
Skill path and scope.

To make the Skill available across all projects instead, opt in explicitly:

```sh
android-api-diff skill install --skill-scope global
```

Install and remove change only the matching Skill:

```sh
android-api-diff skill install
android-api-diff skill remove
```

Both commands default to the current project. Add `--skill-scope global` to
manage the global Skill. Skill removal targets the canonical and Codex-visible
installation without mutating other agents' directories. It reports success
only after those paths are gone and the matching lock record has been removed.

The CLI does not implement its own version check.
After upgrading the CLI with npm or pnpm, run `android-api-diff skill install`
again in each project that should receive the new Skill instructions.

## Use the commands

```sh
android-api-diff resolve "ContentObserver()"
android-api-diff query "IActivityManager.getTasks" --min-sdk 28
android-api-diff generate "ActivityThread.currentApplication" --min-sdk 28
android-api-diff preload "ContentObserver()" "IActivityManager.getTasks" --min-sdk 28
```

| Command         | Use it for                                                                                   |
| --------------- | -------------------------------------------------------------------------------------------- |
| `resolve`       | Resolve an API name to its source file and target kind without fetching historical versions. |
| `query`         | Inspect exact signatures, tag ranges, missing reasons, and source metadata across versions.  |
| `generate`      | Generate Java hidden-API code. This command performs the cross-version query itself.         |
| `preload`       | Preload query results for one or more APIs before a larger task.                             |
| `skill install` | Install the release-matched Codex Skill without changing the CLI.                            |
| `skill remove`  | Remove the project or global Skill without uninstalling the CLI.                             |

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

Member-query results are organized by `result.overloads`. Each overload has a
stable `overloadId`, its latest checked `signature` and structured `member`, and
independent version `ranges`. Top-level `result.ranges[].overloadIds` describes
which overloads were available together. An overload range can report
`overload-not-found` when the member name exists but that parameter signature
does not.

Range endpoints describe the first or last Android tag checked in the current
query snapshot. `last-checked` does not mean that the tag is permanently final.

## Advanced installation

### Migrate an existing global Skill

Changing the installer default does not remove an existing global Skill. Remove
it explicitly once:

```sh
android-api-diff skill remove --skill-scope global
```

Then install from each project that needs the Skill:

```sh
android-api-diff skill install
```

### Retry a failed Skill installation

If `android-api-diff skill install` or `skill remove` fails, run the exact retry
command from its structured error message. The install command keeps the Skill
pinned to the same release as the installed CLI and, for project scope, names
the project directory from which to run it.

### Uninstall the CLI

Removing a Skill leaves the global CLI available. To remove the CLI as well:

```sh
npm uninstall --global android-api-diff
```

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

Then install the CLI and run `android-api-diff skill install` from the project
root. For another AI client, remove the `android-api-diff` entry from its
`mcpServers` configuration before restarting it.

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
