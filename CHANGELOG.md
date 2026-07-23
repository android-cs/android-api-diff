# What's Changed

<!-- Keep only the latest release notes here. Do not include a version number or
append older releases. Replace the entries below when publishing a new release. -->

- Replace the Java/AIDL struct-list parser APIs with file-level parsers that
  return package, filtered imports, and structs.
- Track each member's signature imports by index and preserve them across
  Android-version queries and generated Java code.
- Generate constants as uninitialized `static` fields so callers do not inline
  compile-time values.
- Render concrete class methods returning `void` with an empty body.
