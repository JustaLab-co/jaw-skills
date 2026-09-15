## Signing

Sign messages and typed data with the passkey account. Signing always goes through the browser: a session cannot do it, and the refusal is deliberate.

### Sign a plain message (personal_sign)

Params are `[message, address]` — message first, connected account address second.

```bash
# Sign a UTF-8 string (get address from eth_accounts)
ADDRESS=$(jaw rpc call eth_accounts -o json | jq -r '.[0]')
jaw rpc call personal_sign "[\"Hello, World!\", \"$ADDRESS\"]" -o json -y

# Inline if you already know your address
jaw rpc call personal_sign '["Hello, World!", "0xYOUR_ADDRESS"]' -o json -y

# Sign hex-encoded bytes
jaw rpc call personal_sign '["0x48656c6c6f2c20576f726c6421", "0xYOUR_ADDRESS"]' -o json -y
```

Returns a hex signature string.

### Sign EIP-712 typed data (eth_signTypedData_v4)

Params are `[address, typedDataJsonString]` — address first, typed data as a **JSON-encoded string** (not an object). Use `jq` to encode it:

```bash
ADDRESS=$(jaw rpc call eth_accounts -o json | jq -r '.[0]')
TYPED_DATA='{"domain":{"name":"MyApp","version":"1","chainId":8453,"verifyingContract":"0xCONTRACT"},"types":{"Mail":[{"name":"from","type":"address"},{"name":"content","type":"string"}]},"primaryType":"Mail","message":{"from":"0xSENDER","content":"Hello"}}'

jaw rpc call eth_signTypedData_v4 \
  "$(jq -n --arg addr "$ADDRESS" --argjson td "$TYPED_DATA" '[$addr, ($td | tojson)]')" \
  -o json -y
```

Returns a hex signature string.

### Sign with wallet_sign (ERC-7871 unified method)

`wallet_sign` accepts a `request` object with a `type` field:
- `"0x45"` for personal sign (UTF-8 message)
- `"0x01"` for EIP-712 typed data

```bash
# Personal sign via wallet_sign
jaw rpc call wallet_sign \
  '{"request":{"type":"0x45","data":{"message":"Hello, World!"}}}' \
  -o json -y

# EIP-712 typed data via wallet_sign
jaw rpc call wallet_sign \
  '{"request":{"type":"0x01","data":{"domain":{"name":"MyApp","version":"1","chainId":8453},"types":{"Message":[{"name":"content","type":"string"}]},"primaryType":"Message","message":{"content":"Hello"}}}}' \
  -o json -y
```

Returns a hex signature string.

### A session cannot sign

`--session` refuses `personal_sign` and `eth_signTypedData_v4`:

```
personal_sign is not available in auto mode: a signature the session makes is not
a call, so it never reaches the spend caps or the ledger. Run it through the
browser instead.
```

That is the point rather than a gap. A spend cap and the payment ledger both measure calls. An EIP-3009 transfer authorization over the session's own USDC is a plain typed-data request, indistinguishable from any other until it settles, so a session that could sign one could move its balance with nothing counting it.

Sign through the browser, or, if what you want is to pay for an HTTP resource, use `jaw x402 pay`, which signs exactly that kind of authorization inside the caps that measure it.

### Key rules

- You MUST keep the browser tab open while signing: it needs a passkey confirmation
- Do NOT pass `--session` to a signing method. It is refused, and the reason is in this file.
- `personal_sign` params are `[message, address]` — always pass both; use `eth_accounts` to get the address
- `eth_signTypedData_v4` params are `[address, typedDataJsonString]` — the typed data must be a JSON-encoded **string**, not an object; use `jq` to encode: `($td | tojson)`
- `wallet_sign` uses `{request:{type:"0x45"|"0x01", data:{...}}}` — not `{account, data}`
- You MUST pass the full EIP-712 typed data object to `eth_signTypedData_v4` — domain, types, primaryType, and message are all required
