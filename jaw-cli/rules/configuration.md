## Configuration

The CLI stores configuration in `~/.jaw/config.json` (mode 0600). You can set it up via `jaw config set` (flat keys), `jaw config write` (full JSON), or edit the file directly.

### Write full config (recommended for initial setup)

Use `jaw config write` to set the entire config at once, including nested objects:

```bash
jaw config write '{"apiKey":"YOUR_KEY","defaultChain":84532,"paymasters":{"84532":{"url":"https://api.pimlico.io/v2/84532/rpc?apikey=YOUR_PM_KEY"}},"sessionExpiry":7,"permissions":{"calls":[{"target":"0x3232323232323232323232323232323232323232","selector":"0xe0e0e0e0"}],"spends":[{"token":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","allowance":"0x16345785d8a0000","unit":"day","multiplier":1}]}}'
```

Or from a file:

```bash
jaw config write ./jaw-config.json
```

### Set individual values

```bash
# Set individual values
jaw config set apiKey=YOUR_API_KEY
jaw config set defaultChain=8453

# Set multiple values at once
jaw config set apiKey=YOUR_API_KEY defaultChain=8453 sessionExpiry=7

# Set optional features
jaw config set ens=yourname.eth
```

### Show current configuration

```bash
jaw config show
jaw config show -o json
```

The API key is always redacted in output.

### Configuration keys

| Key              | Required | Set via CLI | Description                                                                                  |
| ---------------- | -------- | ----------- | -------------------------------------------------------------------------------------------- |
| `apiKey`         | No       | Yes         | JAW API key. Obtain from `dashboard.jaw.id`. A CLI without one is handed a key during connect and keeps it. |
| `defaultChain`   | Yes      | Yes         | Default chain ID. E.g. `1` (Ethereum), `8453` (Base), `84532` (Base Sepolia).                |
| `keysUrl`        | No       | Yes         | JAW keys URL. Default: `https://keys.jaw.id`. Only change for self-hosted deployments.       |
| `ens`            | No       | Yes         | ENS domain for on-chain identity. Must be configured in the JAW dashboard before using here. |
| `relayUrl`       | No       | Yes         | Relay WebSocket URL. Default: `wss://relay.jaw.id`.                                          |
| `sessionExpiry`  | No       | Yes         | Session key expiry in days. Default: 7. Only used by a session.                              |
| `grantCeiling`   | No       | Yes         | The most any grant made from this machine may ask for, as `<amount>/<period>`. Unset means no ceiling. |
| `x402`           | No       | Dotted path | The spend caps and allow lists for payments. See <rules/x402.md>.                            |
| `paymasters`     | No       | Edit JSON   | Per-chain paymaster configuration. See below.                                                |
| `permissions`    | No       | Edit JSON   | Session key permission scope. See below. `jaw session setup --x402` builds one instead.      |

### Paymasters (nested — use config write or edit JSON)

Per-chain paymaster config. Each key is a chain ID:

```json
"paymasters": {
  "8453": { "url": "https://api.pimlico.io/v2/8453/rpc?apikey=..." },
  "84532": {
    "url": "https://api.pimlico.io/v2/84532/rpc?apikey=...",
    "context": { "sponsorshipPolicyId": "sp_my_policy" }
  }
}
```

- `url` — Paymaster RPC endpoint (required)
- `context` — Optional context passed to paymaster calls (e.g., Pimlico sponsorship policy)

Previously, `paymasterUrl` was a single string. It is automatically migrated to `paymasters[defaultChain]` on first load.

### Permissions (nested — use config write or edit JSON)

Defines the scope for a session key. `jaw session setup --x402 --limit 25/day` builds this from the asset registry instead, which is what most callers want:

```json
"permissions": {
  "calls": [
    { "target": "0x3232323232323232323232323232323232323232", "selector": "0xe0e0e0e0" }
  ],
  "spends": [
    { "token": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", "allowance": "0x16345785d8a0000", "unit": "day", "multiplier": 1 }
  ]
}
```

Call permission wildcards:
- `target: 0x3232...3232` = any contract
- `selector: 0x32323232` = any function
- `selector: 0xe0e0e0e0` = empty calldata only (ETH transfers)

Spend limit fields:
- `token` — `0xEeee...EEeE` for native ETH, or any ERC-20 address
- `allowance` — max amount in wei (hex string)
- `unit` — `minute`, `hour`, `day`, `week`, `month`, `year`, `forever`
- `multiplier` — number of periods

### Environment variables

Environment variables override the config file.

| Variable       | Equivalent config key                                         |
| -------------- | ------------------------------------------------------------- |
| `JAW_API_KEY`  | `apiKey`                                                      |
| `JAW_CHAIN_ID` | `defaultChain`                                                |
| `JAW_OUTPUT`   | Output format (`json` or `human`) — no config file equivalent |
| `JAW_SESSION`  | Sign with the session key (`true`), the same as `--session`   |

### External prerequisites

Three config values require setup outside the CLI before use:

- **`apiKey`** — Obtain from `dashboard.jaw.id`. Optional: a CLI that carries none is handed one during the connect it already makes. Set one to attribute usage to your own workspace.
- **`paymasters`** — Obtain paymaster URLs from your provider. Only if you are bringing your own: a session already pays for its own operations in USDC through JAW's paymaster, and configuring one that sponsors nothing in USDC puts the account back on native gas it does not hold.
- **`ens`** — Must be configured and verified in the JAW dashboard before setting it here.

### Key rules

- The spend caps under `x402` and `grantCeiling` are set by a human at a terminal. They are deliberately unreachable from the MCP tools, so an agent cannot raise its own limits.
- You MUST set `defaultChain` or pass `-c <chainId>` with every `jaw rpc call` command
- Use `jaw config write` for initial setup with nested config (paymasters, permissions)
- Use `jaw config set` for updating individual flat values
- Do NOT put `apiKey` directly in shell scripts — use the `JAW_API_KEY` environment variable instead
- You MUST NOT set `keysUrl` to a non-jaw.id domain — the CLI validates and rejects untrusted URLs
- Do NOT share or commit `~/.jaw/config.json` — it contains your API key
