# What's Changed

<!-- Keep only the latest release notes here. Do not include a version number or
append older releases. Replace the entries below when publishing a new release. -->

- Organize member-query output around individual `overloads`, with stable
  identities, latest signatures, structured members, and independent version
  ranges.
- Distinguish a missing parameter signature with `overload-not-found`, and
  expose the overloads available together through top-level range IDs.
- Add a non-persistent Web selector for switching between all Java overloads
  and one specific signature while keeping the aggregate view as the default.
- Keep hidden-API code generation, cache invalidation, CLI documentation, and
  the release-matched Codex Skill aligned with the new result model.
