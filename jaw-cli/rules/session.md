## Sessions

A session lets an agent act on a JAW account without a passkey per operation. A human approves once, granting a scoped permission on chain to a key stored on this machine. What that key can do afterwards is what the permission says, and a contract enforces it.

### How it works

1. **Grant, once, human required.** `jaw session setup` generates a key, opens the browser for the passkey that approves `wallet_grantPermissions`, and writes the keystore and the session config to `~/.jaw/` at mode `0600`.
2. **Act, autonomously.** `jaw rpc call ... --session` and `jaw x402 pay --pay` load that key, sign locally and send. No browser.
3. **End it, human required.** `jaw session revoke` opens the browser, revokes on chain, and deletes the local files.

### The session is the account

Every session is EIP-7702: the session key is the address the operations come from, and the delegation rides along with them. There is no second, counterfactual address, and nothing to fund separately.

A session created by an older CLI used a separate address that holds nothing. Those are refused with a message telling you to run `jaw session setup` again, because re-deriving one would produce a different address and fail against the permission that was granted to the old one.

### Gas

A session pays for its own operations in USDC, through JAW's ERC-20 paymaster. The account never needs a native token on any chain.

Two things keep that working, and neither needs configuration:

- The grant sends the session enough for its first operation, which is the most expensive one it makes.
- Every refill through the permission carries a reserve on top of what the payment needs, so the next operation has something to be charged against.

`paymasters[<chainId>]` in the config still wins if you bring your own. Do not configure one to "sponsor" a session: the default path is already gasless in the sense that matters, and a paymaster that sponsors nothing in USDC puts the account back on native gas it does not hold.

If the session address holds no USDC at all, the first send fails while sizing the paymaster approval. The CLI says so and names the address to fund.

### Granting

```bash
# The preset: a USDC transfer, capped per period, for paying APIs
jaw session setup --chain 8453 --x402 --limit 25/day --expiry 14
```

`--x402` builds the permission from the asset registry, so the USDC address and the function signature are not written by hand.

```bash
# A hand-written scope instead
jaw session setup --chain 8453 --permissions ./permissions.json
```

An agent with shell access can run `session setup` itself, and nothing but the browser approval screen bounds the number it picks. Set a ceiling once, at a terminal:

```bash
jaw config set grantCeiling 10/day
```

A grant is refused when it asks for more than that allowance, or when it resets more often than that period, since the same allowance on a shorter period is more money over the same time.

### Adding to a session

```bash
jaw session add --x402 --limit 50/day
```

One approval to grant the union, one to revoke the old permission. `createdAt` is preserved, so adding a capability does not hand back a fresh session budget.

### What session mode signs

| Method | Behaviour |
| --- | --- |
| `eth_requestAccounts` | The session address |
| `eth_accounts` | The same |
| `wallet_sendCalls` | Signs locally, injects the permission id, sends through the permission manager |
| `wallet_getCallsStatus` | Reads the status of a batch |

Everything else is refused. Two refusals are deliberate rather than missing:

- `personal_sign` and `eth_signTypedData_v4`. A signature the session makes is not a call, so it never reaches a spend cap or the ledger. An EIP-3009 transfer authorization over the session's own USDC is exactly this shape, and it would be indistinguishable from any other typed data until it settled. Run those through the browser.
- `wallet_grantPermissions` and `wallet_revokePermissions`, which are `jaw session setup` and `jaw session revoke`.

### Security model

If the session key is taken, the damage is what the permission allows:

- **Which calls.** Only the target and selector pairs in the grant.
- **How much.** The per-period allowance, metered on chain per permission, so every spender under it draws on the same counter.
- **Until when.** The permission expires on its own.
- **Revocation.** The owner can end it at any time with a passkey.

The keystore holds the private key as plaintext hex at mode `0600`, inside a directory at `0700`. There is no application-level encryption, and the on-chain permission is the boundary that matters. Do not copy that file.

### Errors

| Scenario | What you get |
| --- | --- |
| No session | `No session key. Run jaw session setup` |
| Expired locally | `Session expired on <ISO>. Run \`jaw session setup\` to create a new session.` |
| A method session mode does not sign | `Method <name> is not supported in auto mode.` |
| A signature asked of a session | `<method> is not available in auto mode: a signature the session makes is not a call, so it never reaches the spend caps or the ledger.` |
| Chain mismatch | `Session was created for chain <Y>, but --chain <X> was requested.` |
| Keystore and session config disagree | `Session key derives <A>, but the stored session address is <B>.` Recreate the session. |
| A session from an older CLI | A message naming the separate session address and telling you to run setup again |
| The session holds no USDC | `Could not size the ERC-20 paymaster approval ...` followed by the address to fund |
| Setup over an existing session, non-TTY stdin, no `--yes` | Refused upfront rather than risking a prompt that mutates on-chain state |

All errors exit non-zero. Match on a substring rather than the whole message.

### Rules

- You MUST run `jaw session setup` once, with a browser, before anything uses `--session`.
- You MUST pass `--session`, `-s` or `JAW_SESSION=true`. It is never inferred.
- You MUST pass `-o json -y` in an agent context.
- Do NOT pass `permissionId` to `wallet_sendCalls` yourself. Session mode injects it.
- Do NOT configure a paymaster to make a session work. It already pays in USDC.
- Editing `permissions` in the config does not change a live session. The scope is on chain.
- To change the scope: `jaw session add`, or revoke and set up again.
