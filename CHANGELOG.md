# What's Changed

<!-- Keep only the latest release notes here. Do not include a version number or
append older releases. Replace the entries below when publishing a new release. -->

- Initialize generated interface fields with `RemapStub.value()` so the Java
  source compiles without embedding or inlining literal constants.
- Omit redundant `static` and `final` modifiers from generated interface
  fields while keeping class-field output unchanged.
