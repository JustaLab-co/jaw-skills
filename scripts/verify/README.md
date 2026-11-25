# Verifying the jaw-cli skill

How to prove the `jaw-cli` skill still matches what the CLI and the hosted MCP server expose. CI runs steps 1 and 2 on every pull request and every Monday.

## 1. Unit tests

```bash
node --test scripts/*.test.mjs
```

Covers the table parser, the comparison, reading the CLI pin, listing tools from a stdio server (a fake one in `scripts/fixtures/`), reading tool names from a jaw-agent ref, and that the committed docs match the committed manifest.

## 2. Live check against the CLI

```bash
node scripts/check-tools.mjs
```

Needs Node 22 and pnpm. It runs `jaw mcp` from the `@jaw.id/cli` version pinned in `jaw-cli/SKILL.md`, asks it for `tools/list`, and compares the names with the table in `jaw-cli/rules/mcp.md`. Then it compares `jaw-cli/rules/hosted-mcp.md` with `scripts/hosted-tools.json`. Transitive dependencies must be at least seven days old; `@jaw.id/*` packages are exempt.

Expected: `ok: <n> CLI tools, <n> hosted tools` and exit 0. Anything else names the file and the tools on each side, and exits 1.

## 3. Refresh the hosted manifest

The hosted server needs OAuth and its source is private, so this repo checks against a committed copy of its tool names. Refresh it from a jaw-agent checkout when the hosted server changes:

```bash
git -C <jaw-agent checkout> fetch origin
node scripts/check-tools.mjs --refresh-hosted <jaw-agent checkout> origin/main
git diff scripts/hosted-tools.json
```

The manifest records the commit it came from. A diff means the docs need the same change: add or remove the row in `jaw-cli/rules/hosted-mcp.md`, then run step 2.

## 4. When the CLI releases

Bump the version in the "Written against" line of `jaw-cli/SKILL.md` and run step 2. A failure lists the tools to document or remove in `jaw-cli/rules/mcp.md`. Read the release's command flags too: the check covers tool names, not flags or limits.

## What this does not catch

A limit changing under the same tool name (calls per batch, the per-payment cap, the approval window). The docs say the tool description is authoritative for those. Review them by hand when refreshing the manifest.
