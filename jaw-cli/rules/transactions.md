## Transactions

Use `wallet_sendCalls` as the primary method for sending transactions. It supports single calls, batch calls, paymaster gas sponsorship, and permission-based execution.

### Send ETH

```bash
jaw rpc call wallet_sendCalls \
  '{"calls":[{"to":"0xRECIPIENT","value":"1000000000000000000"}]}' \
  -o json -y
```

`value` is the amount in wei as a decimal string.

Common values:
- 0.001 ETH = `"1000000000000000"`
- 0.01 ETH = `"10000000000000000"`
- 0.1 ETH = `"100000000000000000"`
- 1 ETH = `"1000000000000000000"`

### Send ERC-20 tokens

ERC-20 transfers use the `transfer(address,uint256)` function. You must ABI-encode the calldata.

**Using Foundry's cast (recommended):**

```bash
# Encode calldata for transfer(address,uint256)
CALLDATA=$(cast calldata "transfer(address,uint256)" 0xRECIPIENT 10000000)

jaw rpc call wallet_sendCalls \
  "{\"calls\":[{\"to\":\"0xTOKEN_ADDRESS\",\"data\":\"$CALLDATA\"}]}" \
  -o json -y
```

**USDC on Base (10 USDC = 10,000,000 with 6 decimals):**

```bash
jaw rpc call wallet_sendCalls \
  '{"calls":[{"to":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","data":"0xa9059cbb000000000000000000000000RECIPIENT_ADDRESS_WITHOUT_0x0000000000000000000000000000000000000000000000000000000000989680"}]}' \
  -o json -y
```

The calldata format: `0xa9059cbb` (function selector) + 32-byte padded address + 32-byte padded amount.

### Batch transactions

Send multiple calls atomically in a single transaction:

```bash
jaw rpc call wallet_sendCalls \
  '{"calls":[
    {"to":"0xCONTRACT_1","data":"0xCALLDATA_1"},
    {"to":"0xCONTRACT_2","data":"0xCALLDATA_2","value":"0"}
  ]}' \
  -o json -y
```

### Use a paymaster (sponsored gas)

Set `paymasterUrl` in config, then include the capability in the call:

```bash
jaw rpc call wallet_sendCalls \
  '{"calls":[{"to":"0xRECIPIENT","value":"1000000000000000000"}],"capabilities":{"paymasterService":{"url":"https://paymaster.example.com"}}}' \
  -o json -y
```

Or set it globally via config:

```bash
jaw config set paymasterUrl=https://paymaster.example.com
jaw rpc call wallet_sendCalls '{"calls":[{"to":"0xRECIPIENT","value":"0"}]}' -o json -y
```

### Check transaction status

`wallet_sendCalls` returns a batch ID. Use it to poll status:

```bash
jaw rpc call wallet_getCallsStatus '"0xBATCH_ID"' -o json
```

EIP-5792 status codes: `100` = pending, `200` = completed, `400` = offchain failure, `500` = onchain revert.

### Get transaction history

```bash
jaw rpc call wallet_getCallsHistory -o json
```

### Specify a chain per call

Override the default chain for a specific command:

```bash
jaw rpc call wallet_sendCalls '{"calls":[{"to":"0xRECIPIENT","value":"0"}]}' -c 1 -o json -y
```

### Send with a session (no browser)

If a session is set up, add `--session` to send without browser approval. The `permissionId` is auto-injected:

```bash
jaw rpc call wallet_sendCalls \
  '{"calls":[{"to":"0xRECIPIENT","value":"100000000000000000"}]}' \
  --session -o json -y
```

All the same patterns work, batching and ERC-20 included: add `--session`. See <rules/session.md> for setup.

### Key rules

- You MUST resolve ENS names to addresses before constructing any transaction — see <rules/ens-resolution.md>
- You MUST use `wallet_sendCalls` instead of `eth_sendTransaction` for new integrations — it supports batching, paymasters, and permissions
- You MUST encode `value` as a decimal wei string (e.g. `"1000000000000000000"` for 1 ETH)
- You MUST ABI-encode ERC-20 calldata — do not pass token amounts as plain numbers
- You MUST pass `-y` in AI agent contexts to skip confirmation prompts
- You MUST pass `-o json` when the output will be parsed programmatically
- Do NOT send `value` for ERC-20 transfers — the token amount goes in the ABI-encoded `data`, not `value`
- Do NOT omit `"to"` for contract calls — it is always required
- When using `--session`, do NOT pass `permissionId` manually — it is auto-injected from session config
