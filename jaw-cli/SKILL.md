---
name: jaw-cli
description: Usage guide for the JAW CLI (@jaw.id/cli) and its MCP server. Use this skill when driving a JAW.id smart account from a terminal or as an agent, granting a session so an agent can act without a browser, paying HTTP endpoints that answer 402 with x402, configuring the CLI, sending transactions, signing messages, managing permissions, or when asked about JAW CLI commands, spend limits, or the payment ledger.
---

# JAW CLI

A terminal interface and MCP server for JAW.id passkey-authenticated smart accounts.

## When to use

- Installing and configuring `@jaw.id/cli`
- Granting a session so an agent can act without a passkey per operation
- Paying an endpoint that answers `402 Payment Required`
- Sending transactions, signing messages, managing permissions
- Setting up the MCP server, and knowing which tool does what
- Reading the payment ledger, or explaining why a payment was refused
- Debugging a CLI error

## The two ways to use it

**Through the browser.** Every call that touches the account opens `keys.jaw.id` and waits for a passkey. This is `jaw rpc call <method>`. Nothing is stored that could act on its own.

**Through a session.** `jaw session setup` generates a key on this machine and grants it a permission on the account. From then on the key signs without a prompt, and what it can do is bounded by that permission, which a contract enforces. This is what makes an agent autonomous, and it is why the permission matters more than anything else on this page.

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
```

`--limit` is `<amount>/<period>`, where the period is `minute`, `hour`, `day`, `week`, `month`, `year` or `forever`.

### jaw x402 <pay|status|log>

```bash
# Dry run: chooses an option and stops before spending
jaw x402 pay https://api.example.com/resource

# Actually pay
jaw x402 pay https://api.example.com/resource --pay

# Whose funds, which caps, what has been spent
jaw x402 status

# The payment ledger
jaw x402 log
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

- <rules/mcp.md> MCP server setup, the tools, the resources

### 5. Reference

- <rules/api-reference.md> Per-method reference with parameter schemas and examples

## How to use

Read the rule file for what you are doing. Each one carries correct usage, the mistakes that are easy to make, and what is enforced rather than advised.
