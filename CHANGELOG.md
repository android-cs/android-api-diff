# What's Changed

<!-- Keep only the latest release notes here. Do not include a version number or
append older releases. Replace the entries below when publishing a new release. -->

- Generate primitive interface constants from their original initializers when
  supported constant-expression syntax and tokens agree across checked versions,
  avoiding `RemapStub.value()` for those fields.
- Validate expressions with the Java syntax tree and compare tokens while
  ignoring whitespace and comments. Preserve fallback behavior for differing or
  missing initializers, constant references, unsupported syntax, and reference types.
- Preserve Java and AIDL constant initializers in query results, handle multiple
  Java interface constant declarators and array dimensions, and invalidate derived
  caches while retaining downloaded source text.
- Add parser, query, and code-generation regression tests, including
  `IBinder.SHELL_COMMAND_TRANSACTION` and formatting-only version differences.
- Document four interface constant access strategies in the release-matched
  Skill, including non-final static fields in platform implementing-class stubs.
