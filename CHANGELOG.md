# What's Changed

<!-- Keep only the latest release notes here. Do not include a version number or
append older releases. Replace the entries below when publishing a new release. -->

- Make the Codex Skill project-scoped by default and report its resolved path
  and scope; keep global installation available through explicit opt-in.
- Add symmetric `android-api-diff skill install` and `skill remove` commands so
  project or global Skills can be managed independently from the CLI.
- Remove the former top-level `install` command; install and upgrade the CLI
  through npm or pnpm.
- Run Skill management through an exact-version `skills` dependency and
  verify Codex paths plus the Skill lock record after removal.
- Reject symlinked project targets, disable manager telemetry, and propagate
  SIGTERM while a Skill operation is running.
- Limit upstream Skill removal to Codex, then clean only the verified
  canonical/Codex paths so unrelated agent directories are never mutated.
