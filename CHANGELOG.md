# What's Changed

<!-- Keep only the latest release notes here. Do not include a version number or
append older releases. Replace the entries below when publishing a new release. -->

- Return all matching API sources in recommended order, retaining test-directory
  deprioritization and preferring `core/java/` among equally matching sources.
- **Breaking:** `resolve` now returns `candidates` instead of a single `result`;
  shared name resolvers return candidate arrays. Query and generation results
  include candidate metadata, and `--source-path` selects a matching source.
- Add a compact source picker inside the web search field using the shared
  Popover component. Preserve the selected source while editing references when
  it remains a candidate, and persist the selection in shared URLs.
- Isolate query caches by source path and invalidate previous query cache data.
- Replace `unplugin-import-defer` with native dynamic parser imports.
- Cache web Android version metadata for seven days in the ignored `.cache`
  directory, with an explicit cache version for invalidation.
- Update CLI documentation and the release-matched Skill for multi-source queries.
- Reorganize workspace packages at the repository root and manage the Skills
  dependency through the workspace catalog.
