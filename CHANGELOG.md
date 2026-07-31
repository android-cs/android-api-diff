# What's Changed

<!-- Keep only the latest release notes here. Do not include a version number or
append older releases. Replace the entries below when publishing a new release. -->

- Add a cached `source` CLI command that returns complete Java/AIDL file
  content for an exact Android release tag.
- Use `msft-mirror-aosp/platform.frameworks.base` consistently for GitHub
  source pages, raw downloads, and available Android tags.
- Include a GitHub source URL template in `resolve`, `query`, and generated-code
  source metadata.
- Preserve API overloads whose signatures differ through imported type names.
