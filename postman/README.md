# Postman collections

Two collections are shipped with this repo:

| File | Purpose |
|---|---|
| `USI-Payout-Microservice.postman_collection.json` | Calls the **internal microservice** (`/v1/...`). Drives the **4-factor strong auth** (API key + secret-header pair + HMAC signature + Idempotency-Key for payouts). |
| `USI-Money-Direct-API.postman_collection.json` | Calls the **upstream USI / RemitONE WebServices** directly (form-encoded `POST`s with `username`/`password`/`pin`). For debugging or reproducing an issue outside the microservice. |

## Importing

1. Postman → **File → Import** → select the JSON file.
2. Open the collection → **Variables** tab → set the values.
3. Send any request. Pre-request scripts generate every required header.

---

## Microservice collection — strong-auth setup

The collection's pre-request script signs every request the same way the
server validates it (`src/middleware/auth.ts`). You only need to set five
variables — one per `INTERNAL_CLIENTS` entry on the server.

| Variable | Source on the server | Example |
|---|---|---|
| `baseUrl` | your deployment | `http://localhost:8080` |
| `apiKey` | `INTERNAL_CLIENTS[].apiKey` | `ak_live_8f3c...` |
| `secretHeaderName` | `INTERNAL_CLIENTS[].secretHeaderName` | `x-app-secret-token` |
| `secretHeaderValue` | `INTERNAL_CLIENTS[].secretHeaderValue` | `sv_live_4c1e...` |
| `signingSecret` | `INTERNAL_CLIENTS[].signingSecret` | `sk_live_9d2a...` |
| `idempotencyKey` | *optional* — pin a specific key for payout replays | empty (auto-UUID) |

### What the pre-request script does, per request

1. **Builds the canonical string** the server expects:

   ```
   METHOD \n PATH \n SORTED_QUERY \n SHA256_HEX(BODY) \n TIMESTAMP_MS \n NONCE
   ```

   - `PATH` is the URL pathname Postman is about to hit (e.g. `/v1/transactions/`).
   - `BODY` is the raw body **after** Postman variables are substituted.
   - `SORTED_QUERY` is the enabled `k=v` pairs joined with `&` after lexical sort.

2. **Computes** `HMAC-SHA256(signingSecret, canonical)` → `x-signature`.
3. **Sets** these headers automatically:
   - `x-api-key`
   - `<secretHeaderName>: <secretHeaderValue>`
   - `x-timestamp` (unix millis)
   - `x-nonce` (single-use)
   - `x-signature` (hex)
   - `x-correlation-id` (unless already set)
4. For payout endpoints (`POST /v1/transactions/`, `POST /v1/transactions/confirm`):
   - Adds `Idempotency-Key` (UUID) unless the `idempotencyKey` collection
     variable is set (pinning lets you exercise the replay / conflict paths
     deliberately).

Health endpoints (`/healthz`, `/readyz`) skip the auth machinery —
the script returns early for them.

**Audit endpoints (`/v1/audit/*`) only need `x-api-key`** — the script also
returns early after setting just the api-key + correlation id. No signature,
no nonce, no secret-header. This makes shell-based log inspection trivial:

```bash
curl "$BASE/v1/audit/external-calls/$AUDIT_ID" -H "x-api-key: $API_KEY"
```

### Exercising idempotency replays

To trigger a deliberate **replay**:
1. Set the `idempotencyKey` variable to a value like `MY-IDEM-1`.
2. Send `POST /v1/transactions/` — first response is processed and cached.
3. Send the same request again — response is replayed and the
   `x-idempotent-replay: true` header appears (visible in the test-script
   console).

To trigger a **conflict** (`422 IDEMPOTENCY_CONFLICT`):
1. Send with `idempotencyKey=MY-IDEM-1`.
2. Edit the body (e.g. change `amount_to_send`) and resend with the same key.

To trigger **in-progress** (`409 IDEMPOTENCY_IN_PROGRESS`): fire two
requests in parallel with the same key (use Postman's Collection Runner or
two windows).

### Capturing audit_id

A collection-level test script auto-stores `meta.audit_id` (or
`error.audit_id`) into the `auditId` variable so you can immediately call
`GET /v1/audit/external-calls/{{auditId}}` to inspect the encrypted
request/response for that upstream call.

### Debugging signature mismatches

If the server replies `401 UNAUTHORIZED`, uncomment the two `console.log`
lines at the bottom of the collection's pre-request script and check the
Postman console for the canonical string + computed signature, then look at
the server log for the matching `correlation_id` — the server-side reason
(`bad_signature`, `nonce_replay`, `timestamp_skew`, etc.) is recorded there
even though the HTTP response is intentionally generic.

---

## Direct-API collection

Unchanged. Pre-request script injects `username`/`password`/`pin` and,
when `dataIntegrityKey` is set, computes the SHA-256 `data_integrity_hash`
per the USI spec.

| Variable | Purpose |
|---|---|
| `baseUrl` | e.g. `https://test4.remit.by/universalsecuritiestest/ws` |
| `username`, `password`, `pin` | Credentials for the WebServices user |
| `dataIntegrityKey` | Optional; enables outbound hashing per USI spec |

⚠️ **Do not commit real credentials** for either collection.
