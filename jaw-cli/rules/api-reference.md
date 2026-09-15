## API Reference

Full reference for all RPC methods supported by `jaw rpc call`. Pass `params` as a JSON string. If the native params is a single value or object, the CLI wraps it automatically, you do not need to add the outer array. If the native params is already an array (e.g. a list of permissions to revoke), pass it as-is.

Methods that require browser interaction (passkey confirmation) are marked **[browser]**. The four a session signs without one are marked **[session]**: signing methods are not among them, on purpose. See <rules/session.md>.

---

### eth_requestAccounts **[browser]** **[session]**

Request account access. Opens browser if not connected.

**Params:** none

**Returns:** `string[]` — array of account addresses

```bash
jaw rpc call eth_requestAccounts -o json
```

---

### eth_accounts **[session]**

Get connected account addresses without triggering a browser prompt.

**Params:** none

**Returns:** `string[]` — array of account addresses (empty if not connected)

```bash
jaw rpc call eth_accounts -o json
```

---

### eth_chainId

Get the current chain ID.

**Params:** none

**Returns:** `string` — hex-encoded chain ID (e.g. `"0x2105"` for Base)

```bash
jaw rpc call eth_chainId -o json
```

---

### net_version

Get the network ID as a decimal string.

**Params:** none

**Returns:** `string` — decimal chain ID (e.g. `"8453"`)

```bash
jaw rpc call net_version -o json
```

---

### wallet_connect **[browser]**

Connect the wallet. Opens browser for passkey authentication.

**Params:** none (or optional `{ capabilities?, silent? }` object)

**Returns:** `{ accounts: [{ address: string, capabilities?: {...} }] }`

```bash
jaw rpc call wallet_connect -o json
```

---

### wallet_disconnect

Disconnect the wallet.

**Params:** none

**Returns:** `null`

```bash
jaw rpc call wallet_disconnect -o json
```

---

### wallet_switchEthereumChain

Switch to a different chain. Does not require passkey confirmation.

**Params:** `{ chainId: string }` — hex-encoded chain ID

**Returns:** `null`

```bash
jaw rpc call wallet_switchEthereumChain '{"chainId":"0x2105"}' -o json -y
```

---

### wallet_sendCalls **[browser]** **[session]**

Send one or more calls. The primary transaction method.

**Params:**

```json
{
  "calls": [
    {
      "to": "0xADDRESS",
      "data": "0xCALLDATA",
      "value": "1000000000000000000"
    }
  ],
  "capabilities": {
    "paymasterService": {
      "url": "https://paymaster.example.com"
    }
  }
}
```

All call fields except `to` are optional. `value` is a decimal wei string (e.g. `"1000000000000000000"` for 1 ETH). `chainId` defaults to the configured chain.

**Returns:** `{ id: string, chainId: number }` — batch ID for status polling

```bash
# Send ETH
jaw rpc call wallet_sendCalls \
  '{"calls":[{"to":"0xRECIPIENT","value":"1000000000000000000"}]}' \
  -o json -y

# Batch two calls
jaw rpc call wallet_sendCalls \
  '{"calls":[{"to":"0xCONTRACT_1","data":"0xABCD"},{"to":"0xCONTRACT_2","data":"0xEF01"}]}' \
  -o json -y
```

---

### eth_sendTransaction **[browser]**

Send a single transaction. Prefer `wallet_sendCalls` for new integrations.

**Params:**

```json
{
  "to": "0xADDRESS",
  "data": "0xCALLDATA",
  "value": "1000000000000000000"
}
```

**Returns:** `string` — transaction hash

```bash
jaw rpc call eth_sendTransaction \
  '{"to":"0xRECIPIENT","value":"1000000000000000000"}' \
  -o json -y
```

---

### wallet_getCallsStatus **[session]**

Get the status of a batch submitted via `wallet_sendCalls`.

**Params:** `"0xBATCH_ID"` — the batch ID returned by `wallet_sendCalls`

**Returns:** EIP-5792 status object

```json
{
  "version": "2.0.0",
  "id": "0xBATCH_ID",
  "chainId": "0x2105",
  "status": 100,
  "atomic": true,
  "receipts": [...]
}
```

Status codes: `100` = pending, `200` = completed, `400` = offchain failure, `500` = onchain revert

```bash
jaw rpc call wallet_getCallsStatus '"0xBATCH_ID"' -o json
```

---

### wallet_getCallsHistory

Get the history of all submitted batches.

**Params:** none

**Returns:** array of batch objects with status and receipts

```bash
jaw rpc call wallet_getCallsHistory -o json
```

---

### personal_sign **[browser]**

Sign a message with the connected account. Params are `[message, address]`.

**Params:** `[message, address]` — UTF-8 string or hex-encoded bytes, plus the account address

**Returns:** `string` — hex signature

```bash
ADDRESS=$(jaw rpc call eth_accounts -o json | jq -r '.[0]')
jaw rpc call personal_sign "[\"Hello, World!\", \"$ADDRESS\"]" -o json -y

# Hex-encoded message
jaw rpc call personal_sign '["0x48656c6c6f", "0xYOUR_ADDRESS"]' -o json -y
```

---

### eth_signTypedData_v4 **[browser]**

Sign EIP-712 typed structured data. Params are `[address, typedDataJsonString]` — address first, typed data as a JSON-encoded **string**.

**Params:** `[address, typedDataJsonString]`

**Returns:** `string` — hex signature

```bash
ADDRESS=$(jaw rpc call eth_accounts -o json | jq -r '.[0]')
TYPED_DATA='{"domain":{"name":"MyApp","version":"1","chainId":8453},"types":{"Message":[{"name":"content","type":"string"}]},"primaryType":"Message","message":{"content":"Hello"}}'

jaw rpc call eth_signTypedData_v4 \
  "$(jq -n --arg addr "$ADDRESS" --argjson td "$TYPED_DATA" '[$addr, ($td | tojson)]')" \
  -o json -y
```

---

### wallet_sign **[browser]**

ERC-7871 unified signing method. Accepts a `request` object with `type` `"0x45"` (personal sign) or `"0x01"` (EIP-712).

**Params:**

```json
{
  "request": {
    "type": "0x45",
    "data": {
      "message": "UTF-8 message string"
    }
  },
  "chainId": "0x2105"
}
```

Or for EIP-712:

```json
{
  "request": {
    "type": "0x01",
    "data": {
      "domain": {...},
      "types": {...},
      "primaryType": "...",
      "message": {...}
    }
  }
}
```

**Returns:** `string` — hex signature

```bash
# Personal sign (type 0x45)
jaw rpc call wallet_sign \
  '{"request":{"type":"0x45","data":{"message":"Hello, World!"}}}' \
  -o json -y

# EIP-712 typed data (type 0x01)
jaw rpc call wallet_sign \
  '{"request":{"type":"0x01","data":{"domain":{"name":"MyApp","version":"1","chainId":8453},"types":{"Message":[{"name":"content","type":"string"}]},"primaryType":"Message","message":{"content":"Hello"}}}}' \
  -o json -y
```

---

### wallet_grantPermissions **[browser]**

Grant ERC-7715 permissions to allow third-party execution.

**Params:**

```json
{
  "expiry": 1893456000,
  "spender": "0xSPENDER_ADDRESS",
  "permissions": {
    "spends": [
      {
        "token": "0xTOKEN_ADDRESS",
        "allowance": "DECIMAL_TOKEN_UNITS",
        "unit": "day",
        "multiplier": 1
      }
    ],
    "calls": [
      {
        "target": "0xCONTRACT",
        "functionSignature": "transfer(address,uint256)"
      }
    ]
  }
}
```

- `spender` — address of the entity being granted execution rights (required)
- `token` — ERC-20 contract address, or `"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"` for native ETH
- `unit` options: `minute` | `hour` | `day` | `week` | `month` | `year` | `forever`
- For calls: provide either `selector` (4-byte hex) or `functionSignature` (human-readable)

**Returns:** `{ permissionId: string, spender, expiry, calls, spends, ... }` — use `permissionId` to revoke later

```bash
# ERC-20 spend permission (100 USDC/day) + call permission
jaw rpc call wallet_grantPermissions \
  '{"expiry":1893456000,"spender":"0xSPENDER_ADDRESS","permissions":{"spends":[{"token":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","allowance":"100000000","unit":"day","multiplier":1}],"calls":[{"target":"0xCONTRACT","selector":"0xSELECTOR"}]}}' \
  -o json -y

# Native ETH spend (0.1 ETH/day) + call permission
jaw rpc call wallet_grantPermissions \
  '{"expiry":1893456000,"spender":"0xSPENDER_ADDRESS","permissions":{"spends":[{"token":"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE","allowance":"100000000000000000","unit":"day","multiplier":1}],"calls":[{"target":"0xCONTRACT","selector":"0xSELECTOR"}]}}' \
  -o json -y
```

---

### wallet_revokePermissions **[browser]**

Revoke a previously granted permission. Use the `id` field (the `permissionId` from the grant response).

**Params:** `[{ "id": "0xPERMISSION_ID" }]`

**Returns:** `{ success: boolean }`

```bash
jaw rpc call wallet_revokePermissions \
  '[{"id":"0xPERMISSION_ID"}]' \
  -o json -y
```

---

### wallet_getPermissions

Get all active permissions for the connected account.

**Params:** none

**Returns:** array of active permission objects

```bash
jaw rpc call wallet_getPermissions -o json
```

---

### wallet_getCapabilities

Get the capabilities supported by the connected account and chain.

**Params:** none (or optional `[address, [chainIds]]`)

**Returns:** capabilities object keyed by chain ID

```bash
jaw rpc call wallet_getCapabilities -o json
```

---

### wallet_getAssets

Get the assets (tokens + balances) held by an account. `account` is required.

**Params:**

```json
{
  "account": "0xADDRESS",
  "chainFilter": ["0x2105", "0x1"],
  "assetTypeFilter": ["native", "erc20"]
}
```

`chainFilter` and `assetTypeFilter` are optional.

**Returns:** object keyed by chain ID (hex), each value is an array of asset objects with `address`, `balance`, `type`, and `metadata`

```bash
ADDRESS=$(jaw rpc call eth_accounts -o json | jq -r '.[0]')
jaw rpc call wallet_getAssets "{\"account\":\"$ADDRESS\"}" -o json
```

---

