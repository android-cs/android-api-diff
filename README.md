# android-api-diff

**<https://diff.songe.li>**

An online tool to show Android Java/AIDL files api changes between different android inner versions

## CLI + Agent Skill

Install or upgrade the global CLI:

```sh
npm install --global android-api-diff@latest
```

Then, from the root of a project that needs Android API inspection, install its
release-matched Codex Skill:

```sh
android-api-diff skill install
```

The Skill is project-scoped by default. Global installation is an explicit
opt-in. CLI and Skill lifecycles remain separate:

```sh
android-api-diff skill install --skill-scope global
android-api-diff skill remove
```

[CLI usage, Skill setup, and MCP migration guide](./CLI.md)
