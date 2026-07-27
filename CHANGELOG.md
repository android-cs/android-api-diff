# What's Changed

<!-- Keep only the latest release notes here. Do not include a version number or
append older releases. Replace the entries below when publishing a new release. -->

- Replace the always-on MCP server with the on-demand `android-api-diff` CLI.
- Add a project-local Codex Skill that routes API inspection and code-generation
  requests to the CLI without redundant calls.
- Publish the CLI under the unscoped `android-api-diff` package name so the
  package and executable use the same name.
- Add `android-api-diff install` as a one-command global CLI and Codex Skill
  installer, with the Skill pinned to the matching release tag.
- Require Node.js 26.5.0 or newer across the workspace and published packages.
