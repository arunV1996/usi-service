# Postman collections

Two collections are shipped with this repo:

| File | Purpose |
|---|---|
| `USI-Payout-Microservice.postman_collection.json` | Calls the **internal microservice** (`/v1/...`) using `x-api-key` or Bearer JWT. JSON request bodies; uniform `{ status, data, meta }` response envelope. |
| `USI-Money-Direct-API.postman_collection.json` | Calls the **upstream USI / RemitONE WebServices** directly (form-encoded `POST`s with `username`/`password`/`pin`). Useful for debugging or reproducing an issue outside the microservice. |

## Importing

1. Postman → **File → Import** → select the JSON file.
2. Open the collection → **Variables** tab → set values for your environment.
3. Send any request. Pre-request scripts inject auth fields automatically.

## Microservice collection variables

| Variable | Purpose |
|---|---|
| `baseUrl` | e.g. `http://localhost:8080` or your ALB DNS |
| `apiKey` | One of the values configured via `INTERNAL_API_KEYS` |
| `bearerToken` | Optional: paste a JWT signed by the internal auth service |
| `remitterId`, `beneficiaryId`, `transRef`, `agentTransRef`, `transSessionId` | Sample IDs for the example requests |

`createTransaction` includes a test script that auto-stores `trans_session_id`
into the `transSessionId` collection variable so the next `confirm` request
just works.

## Direct-API collection variables

| Variable | Purpose |
|---|---|
| `baseUrl` | e.g. `https://test4.remit.by/universalsecuritiestest/ws` |
| `username`, `password`, `pin` | Credentials for the WebServices user |
| `dataIntegrityKey` | If your WS user has Data Integrity Hashing enabled, set this. The pre-request script will compute SHA-256 over all non-credential params + this key and add `data_integrity_hash` automatically. Leave blank to skip. |

⚠️ **Do not commit real credentials.** Use a Postman environment file kept
outside source control, or override values at runtime.

## Hash verification

The direct collection already ships the SHA-256 hashing logic per the USI
spec section *Data Integrity Hashing*:

```
data_integrity_hash = SHA256( concat(every POST param except
   username/password/pin/id1_scan/id2_scan) + dataIntegrityKey )
```

Verifying a server response is symmetric — concatenate the inner
`<result>` payload (between the open and close tags), append the key, and
SHA-256 it.
