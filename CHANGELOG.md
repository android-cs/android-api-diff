# What's Changed

<!-- Keep only the latest release notes here. Do not include a version number or
append older releases. Replace the entries below when publishing a new release. -->

- Preserve signatures that exist only in part of an Android release instead of
  dropping them during code generation.
- Emit lifecycle annotations only when every signature spans complete Android
  API boundaries; otherwise keep exact tag-range comments.
