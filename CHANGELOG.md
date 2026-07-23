# Changelog

## 0.1.2

- Replace the Java/AIDL struct-list parser APIs with file-level parsers that
  return package, filtered imports, and structs.
- Track each member's signature imports by index and preserve them across
  Android-version queries and generated Java code.
- Generate constants as uninitialized `static` fields so callers do not inline
  compile-time values.
- Render concrete class methods returning `void` with an empty body.

## 0.1.1

- Support `ClassName()` shorthand for querying all constructor overloads.

## 0.1.0

- Reuse unchanged Android framework source across tags with conditional ETag requests.
- Share cached representations across the AOSP and android-cs GitHub mirrors.
- Coalesce concurrent downloads and persist tag-ordered ETag metadata in the SQLite cache.
