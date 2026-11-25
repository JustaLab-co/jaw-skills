---
name: jaw-cli
description: Usage guide for the JAW CLI (@jaw.id/cli), its local MCP server, and the hosted JAW MCP server at mcp.jaw.id. Use this skill when driving a JAW.id smart account from a terminal, a chat app or as an agent, choosing between the hosted MCP and the CLI, asking the owner to approve a transfer, swap, bridge or signature, granting a permission or a session so an agent can act without a browser, paying HTTP endpoints that answer 402 with x402, configuring the CLI, sending transactions, signing messages, managing permissions, or when asked about JAW CLI commands, spend limits, or the payment ledger.
---

# JAW CLI and MCP

A terminal interface, a local MCP server and a hosted MCP server for JAW.id passkey-authenticated smart accounts.

Written against `@jaw.id/cli@0.12.3` and the hosted server as it stood at that release. In the jaw-skills repo, `scripts/check-tools.mjs` fails when either server's tools and these docs disagree.

## When to use

- Installing and configuring `@jaw.id/cli`
- Granting a session so an agent can act without a passkey per operation
- Paying an endpoint that answers `402 Payment Required`
- Sending transactions, signing messages, managing permissions
- Choosing between the hosted MCP server and the CLI
- Connecting a chat app or agent to `mcp.jaw.id`, and knowing which tool does what
- Asking the owner to approve a transfer, swap, bridge, signature or permission
- Setting up the local MCP server
- Reading the payment ledger, or explaining why a payment was refused
- Debugging a CLI error

## Hosted MCP or CLI

| Use | When |
| --- | --- |
| Hosted MCP, `https://mcp.jaw.id/mcp` | The agent runs in a chat app or coding agent that supports remote MCP servers, with no shell or no local browser. The owner approves on whatever device holds their passkey. Swaps, bridges, add funds, token lookup, DeFi positions, linked accounts. See <rules/hosted-mcp.md>. |
| CLI, or `jaw mcp` | A shell and a local browser are available: scripts, CI, a terminal agent. Raw RPC methods, the local payment ledger, a `grantCeiling` set by a human at a terminal. See the command reference below and <rules/mcp.md>. |

Pick one per task. A permission or session granted through one does not exist on the other, and `jaw_grant_permissions` and `jaw_session_status` exist on both with different meanings.

## The two ways the CLI acts

**Through the browser.** Every call that touches the account opens `keys.jaw.id` and waits for a passkey. This is `jaw rpc call <method>`. Nothing is stored that could act on its own.

**Through a session.** `jaw session setup`, or `jaw_grant_permissions` from `jaw mcp`, generates a key on this machine and grants it a permission on the account once the owner approves. From then on the key signs without a prompt, and what it can do is bounded by that permission, which a contract enforces. This is what makes an agent autonomous, and it is why the permission matters more than anything else on this page.

## Key facts

- **Package:** `@jaw.id/cli`, binary `jaw`
- **A session is EIP-7702.** The session key IS the account that sends the operations. There is no second address to fund, and a session created by an older CLI that used one is refused with instructions to recreate it.
- **A session pays its own gas in USDC**, through JAW's ERC-20 paymaster. The account never needs a native token. The grant seeds the session with enough for its first operation, and every refill leaves a reserve behind for the next one.
- **Session mode signs four methods:** `eth_accounts`, `eth_requestAccounts`, `wallet_sendCalls`, `wallet_getCallsStatus`. `personal_sign` and `eth_signTypedData_v4` are refused on purpose: a signature is not a call, so it never reaches a spend cap or the ledger. Use the browser for those.
- **Config file:** `~/.jaw/config.json`. Resolution order: CLI flag, environment variable, config file, default.
- **For agents:** pass `-o json` and `-y` on every invocation.
- **`wallet_sendCalls` over `eth_sendTransaction`:** it batches, it takes a paymaster, and it is what a permission executes through.

## Command reference

### jaw rpc call <method> [params]

Any JAW.id RPC method. `params` is a JSON string.

| Flag | Short | Default | Description |
| --- | --- | --- | --- |
| `--output` | `-o` | `human` | `json` or `human`. Use `json` for agents. |
| `--chain` | `-c` | config | Chain id |
| `--api-key` | | config | JAW API key |
| `--timeout` | `-t` | `120` | Request timeout in seconds |
| `--yes` | `-y` | `false` | Skip confirmations |
| `--quiet` | `-q` | `false` | Suppress non-essential output |
| `--session` | `-s` | `false` | Sign with the local session key, no browser |

### jaw session <setup|add|status|revoke>

```bash
# Grant a session that can pay for APIs: a USDC transfer capped per period
jaw session setup --chain 8453 --x402 --limit 25/day --expiry 14

# Grant a hand-written permission instead
jaw session setup --chain 8453 --permissions ./permissions.json

# Add to what the session already holds
jaw session add --x402 --limit 50/day

# What the session is, and what the chain says about its permission
jaw session status

# End it: revoke on chain and delete the local key
jaw session revoke

# Delete the local session even if a permission could not be revoked
jaw session revoke --force
```

`--limit` is `<amount>/<period>`, where the period is `minute`, `hour`, `day`, `week`, `month`, `year` or `forever`. It only applies with `--x402`; with `--permissions`, put the cap in the permission. `--force` leaves the unrevoked permissions live on chain until they expire, and prints their ids.

### jaw x402 <pay|status|log>

```bash
# Dry run: chooses an option and stops before spending
jaw x402 pay https://api.example.com/resource

# Actually pay
jaw x402 pay https://api.example.com/resource --pay

# A POST with a body, capped for this call in base units (0.05 USDC)
jaw x402 pay https://api.example.com/resource --pay --method POST --body '{"q":1}' --max-amount 50000

# Whose funds, which caps, what has been spent
jaw x402 status

# The payment ledger: the last 20 refused attempts
jaw x402 log --limit 20 --status refused
```

### jaw config <show|set|write>

```bash
jaw config set apiKey=YOUR_KEY defaultChain=8453
jaw config set grantCeiling=10/day
jaw config show -o json
jaw config write ./my-config.json
```

### jaw mcp

Starts the MCP server over stdio.

### jaw disconnect

Closes the relay session and the browser tab.

### jaw version

Prints the installed version.

## Rule index

### 1. Setup

- <rules/installation.md> Installing the CLI and first-run setup
- <rules/configuration.md> Configuration keys, environment variables, external prerequisites

### 2. Operations

- <rules/ens-resolution.md> Resolving ENS names to addresses before transacting
- <rules/transactions.md> Sending ETH, ERC-20 tokens, batches, checking status
- <rules/signing.md> Signing messages and typed data
- <rules/permissions.md> Granting, revoking and querying permissions

### 3. Autonomy

- <rules/session.md> Granting a session, what it can do, funding it, lifecycle, errors
- <rules/x402.md> Paying an endpoint that answers 402, and what bounds it

### 4. Agent integration

- <rules/hosted-mcp.md> The hosted MCP server: connecting, scopes, every tool, what the owner approves, the limits
- <rules/mcp.md> The local MCP server (`jaw mcp`): setup, the tools, the resources

### 5. Reference

- <rules/api-reference.md> Per-method reference with parameter schemas and examples

## How to use

Read the rule file for what you are doing. Each one carries correct usage, the mistakes that are easy to make, and what is enforced rather than advised.
